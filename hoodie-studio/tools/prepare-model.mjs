// Prepares a downloaded garment GLB (e.g. a Sketchfab/CLO export) for the studio:
//  - flattens and merges the mesh chunks, scales and centres the garment
//  - bakes ambient occlusion into vertex colours
//  - precomputes a print surface for each placement (front, back, sleeves): the triangles
//    the print projector can actually see, with planar UVs
//  - quantizes and meshopt-compresses the result
//
//   node prepare-model.mjs <input.glb> [output.glb]
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { writeFileSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , input, output = fileURLToPath(new URL('../hoodie.glb', import.meta.url)), presetName = 'hoodie'] = process.argv;
if (!input) { console.error('usage: node prepare-model.mjs <input.glb> [output.glb] [hoodie|crewneck|tee]'); process.exit(1); }
const FAST = !!process.env.FAST; // skip the AO bake while tuning placements
// Per-product settings. Print areas are in studio space (the product spans y = -1.35 … 1.65).
// Sleeve prints run down the arm: `sleeve` gives the centre height, the arm's lean (dx per unit drop) and size.
// Source options: `group` picks OBJ groups by name, `keepUV` + `normalMap` keep a surface-detail map
// (e.g. golf ball dimples), `pieces: false` skips pattern pieces, `yaw` (degrees) replaces auto squaring-up.
const PRESETS = {
  hoodie: { front: [0.15, 1.05, 1.05], back: [0.2, 1.2, 1.3], sleeve: { x: 0.4, y: 0.25, lean: 0.18, w: 1.0, h: 0.42 } },
  crewneck: { front: [0.55, 1.0, 1.0], back: [0.5, 1.1, 1.3], sleeve: { x: 0.43, y: 0.2, lean: 0.12, w: 1.1, h: 0.4 } },
  tee: { front: [0.55, 1.0, 1.0], back: [0.55, 1.1, 1.3], sleeve: { x: 0.43, y: 1.0, lean: 0.9, w: 0.42, h: 0.34 } },
  cap: { pieces: false, keepUV: true, subdivide: 2, normalMap: 'cap-weave-normal.jpg', fitMax: 2.7, yawOffset: 90, front: [0.6, 1.2, 0.8], back: [0.7, 1.1, 0.6], areas: ['front', 'back'] },
  polo: { minPieceTris: 250, dropInner: true, front: [0.5, 1.0, 1.0], back: [0.5, 1.1, 1.3], sleeve: { x: 0.43, y: 0.95, lean: 0.9, w: 0.4, h: 0.32 } },
  tank: { front: [0.4, 0.9, 1.0], back: [0.4, 0.9, 1.2], areas: ['front', 'back'], rename: { 'Left cuff': 'Left armhole binding', 'Right cuff': 'Right armhole binding', Collar: 'Neck binding', 'Collar 2': 'Neck binding 2' } },
  // Team kits: top and bottom stay separate parts; `leg` is a print on the shorts' left leg
  basketball: { parts: [['jersey', /1001/], ['shorts', /1002/]], front: [0.95, 0.85, 0.8], back: [0.95, 0.9, 0.9], leg: { x: 0.28, y: -0.35, w: 0.45, h: 0.55 }, areas: ['front', 'back', 'left'] },
  soccer: { parts: [['jersey', /1001/], ['shorts', /1002/]], front: [1.05, 0.85, 0.75], back: [1.05, 0.9, 0.85], leg: { x: 0.24, y: 0.4, w: 0.35, h: 0.35 }, areas: ['front', 'back', 'left'] },
  ball: { group: /var1/, pieces: false, keepUV: true, normalMap: 'golf-ball-dimples-normal.jpg', yaw: 0, fitMax: 2.6, front: [0.15, 1.8, 1.8], back: [0.15, 1.8, 1.8], areas: ['front', 'back'] },
};
const PR = PRESETS[presetName];
if (!PR) throw new Error('unknown preset ' + presetName);
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

/* 1. Read and merge every primitive into one world-space geometry */
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const isOBJ = /\.obj(\.gz)?$/i.test(input);
const src = isOBJ ? null : await io.read(input);
const credit = isOBJ ? {} : src.getRoot().getAsset().extras || {};
const pos = [], nrm = [], idx = [], uvs = [], triPart = [];
const PART_NAMES = PR.parts ? PR.parts.map(p => p[0]) : ['body'];
const partOf = name => PR.parts ? Math.max(0, PR.parts.findIndex(([, re]) => re.test(name || ''))) : 0;
let hasUV = true; // CLO/Style3D exports keep the flat pattern layout in their UVs
const m4 = new THREE.Matrix4(), n3 = new THREE.Matrix3(), v = new THREE.Vector3();
if (isOBJ) {
  // A minimal OBJ reader (v, vt, vn, f, g/o): three's loader trips over CLO's curve records.
  // Each distinct v/vt/vn corner becomes one vertex, so UV seams between pattern pieces are kept.
  const V = [], VT = [], VN = [], corner = new Map();
  let keep = !PR.group;
  const raw = readFileSync(input), text = (/\.gz$/i.test(input) ? gunzipSync(raw) : raw).toString('utf8');
  let start = 0;
  while (start < text.length) {
    let end = text.indexOf('\n', start); if (end < 0) end = text.length;
    const line = text.slice(start, end).trim(); start = end + 1;
    if (!line || line[0] === '#') continue;
    const sp = line.indexOf(' '), tag = sp < 0 ? line : line.slice(0, sp), rest = sp < 0 ? '' : line.slice(sp + 1).trim();
    if (tag === 'v') { const a = rest.split(/\s+/); V.push(+a[0], +a[1], +a[2]); }
    else if (tag === 'vt') { const a = rest.split(/\s+/); VT.push(+a[0], +a[1]); }
    else if (tag === 'vn') { const a = rest.split(/\s+/); VN.push(+a[0], +a[1], +a[2]); }
    else if (tag === 'g' || tag === 'o') { if (PR.group) keep = PR.group.test(rest); }
    else if (tag === 'f' && keep) {
      const ids = rest.split(/\s+/).map(c => {
        const [vi, ti, ni] = c.split('/').map(x => x ? parseInt(x, 10) : 0);
        const v0 = (vi < 0 ? V.length / 3 + vi : vi - 1), t0 = ti ? (ti < 0 ? VT.length / 2 + ti : ti - 1) : -1;
        // weld by position + UV; per-face normals (Maya writes one per corner) are averaged below
        const key = v0 * 4194304 + t0 + 1;
        let id = corner.get(key);
        if (id === undefined) {
          id = pos.length / 3; corner.set(key, id);
          pos.push(V[v0 * 3], V[v0 * 3 + 1], V[v0 * 3 + 2]);
          if (t0 >= 0) uvs.push(VT[t0 * 2], VT[t0 * 2 + 1]); else { uvs.push(0, 0); hasUV = false; }
          nrm.push(0, 0, 0);
        }
        if (ni) { const n0 = (ni < 0 ? VN.length / 3 + ni : ni - 1) * 3; nrm[id * 3] += VN[n0]; nrm[id * 3 + 1] += VN[n0 + 1]; nrm[id * 3 + 2] += VN[n0 + 2]; }
        return id;
      });
      for (let k = 1; k + 1 < ids.length; k++) idx.push(ids[0], ids[k], ids[k + 1]);
    }
  }
  if (!VT.length) hasUV = false;
  for (let i = 0; i < nrm.length; i += 3) { const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]); if (l) { nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l; } else nrm[i] = NaN; }
  if (nrm.some(Number.isNaN)) { // no normals in the file: compute smooth ones by position
    const acc = new Float64Array(pos.length), key = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const kid = i => { const k = `${pos[i * 3].toFixed(5)},${pos[i * 3 + 1].toFixed(5)},${pos[i * 3 + 2].toFixed(5)}`; let r = key.get(k); if (r === undefined) key.set(k, r = i); return r; };
    for (let t = 0; t < idx.length; t += 3) {
      a.fromArray(pos, idx[t] * 3); b.fromArray(pos, idx[t + 1] * 3).sub(a); c.fromArray(pos, idx[t + 2] * 3).sub(a); b.cross(c);
      for (let k = 0; k < 3; k++) { const r = kid(idx[t + k]); acc[r * 3] += b.x; acc[r * 3 + 1] += b.y; acc[r * 3 + 2] += b.z; }
    }
    for (let i = 0; i < pos.length / 3; i++) { const r = kid(i), l = Math.hypot(acc[r * 3], acc[r * 3 + 1], acc[r * 3 + 2]) || 1; nrm[i * 3] = acc[r * 3] / l; nrm[i * 3 + 1] = acc[r * 3 + 1] / l; nrm[i * 3 + 2] = acc[r * 3 + 2] / l; }
  }
}
for (const node of isOBJ ? [] : src.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  m4.fromArray(node.getWorldMatrix()); n3.getNormalMatrix(m4);
  for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), I = prim.getIndices(), T = prim.getAttribute('TEXCOORD_0');
    if (!T) hasUV = false;
    const base = pos.length / 3, el = [];
    for (let i = 0; i < P.getCount(); i++) {
      v.fromArray(P.getElement(i, el)).applyMatrix4(m4); pos.push(v.x, v.y, v.z);
      v.fromArray(N.getElement(i, el)).applyMatrix3(n3).normalize(); nrm.push(v.x, v.y, v.z);
      if (T) { const t = T.getElement(i, el); uvs.push(t[0], t[1]); } else uvs.push(0, 0);
    }
    for (let i = 0; i < I.getCount(); i++) idx.push(base + I.getScalar(i));
    for (let i = 0; i < I.getCount() / 3; i++) triPart.push(partOf(mesh.getName() || node.getName()));
  }
}
while (triPart.length < idx.length / 3) triPart.push(0); // OBJ input: one part
log('merged', pos.length / 3, 'verts', idx.length / 3, 'tris');

/* 1a. CLO can export every stitch as its own tiny mesh (thousands of them, most of the triangles).
   Drop connected parts smaller than `minPieceTris` so only the fabric panels remain. */
if (PR.minPieceTris) {
  const nv = pos.length / 3, par = new Int32Array(nv).map((_, i) => i);
  const find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  for (let t = 0; t < idx.length; t += 3) { par[find(idx[t + 1])] = find(idx[t]); par[find(idx[t + 2])] = find(idx[t]); }
  const count = new Map();
  for (let t = 0; t < idx.length; t += 3) { const r = find(idx[t]); count.set(r, (count.get(r) || 0) + 1); }
  const keepT = [], keepP = [];
  for (let t = 0; t < idx.length; t += 3) if (count.get(find(idx[t])) >= PR.minPieceTris) { keepT.push(idx[t], idx[t + 1], idx[t + 2]); keepP.push(triPart[t / 3]); }
  const map = new Int32Array(nv).fill(-1), P2 = [], N2 = [], U2 = [];
  idx.length = 0;
  for (const i of keepT) { if (map[i] < 0) { map[i] = P2.length / 3; P2.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); N2.push(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]); U2.push(uvs[i * 2], uvs[i * 2 + 1]); } idx.push(map[i]); }
  pos.length = 0; nrm.length = 0; uvs.length = 0;
  for (const x of P2) pos.push(x); for (const x of N2) nrm.push(x); for (const x of U2) uvs.push(x);
  triPart.length = 0; for (const x of keepP) triPart.push(x);
  log('kept fabric panels:', idx.length / 3, 'tris in', [...count.values()].filter(c => c >= PR.minPieceTris).length, 'parts');
}

/* 1b. Very dense exports (CLO can write a million triangles) are simplified for the web.
   Panel edges are locked so the pattern pieces keep their exact outlines. */
if (PR.simplify) {
  await MeshoptSimplifier.ready;
  const [out] = MeshoptSimplifier.simplify(Uint32Array.from(idx), Float32Array.from(pos), 3, Math.floor(idx.length * PR.simplify / 3) * 3, 0.002, ['LockBorder']);
  const map = new Int32Array(pos.length / 3).fill(-1), P2 = [], N2 = [], T2 = [];
  idx.length = 0;
  for (const i of out) {
    if (map[i] < 0) { map[i] = P2.length / 3; P2.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); N2.push(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]); T2.push(uvs[i * 2], uvs[i * 2 + 1]); }
    idx.push(map[i]);
  }
  pos.splice(0, pos.length, ...[]); nrm.length = 0; uvs.length = 0;
  for (let i = 0; i < P2.length; i++) pos.push(P2[i]);
  for (let i = 0; i < N2.length; i++) nrm.push(N2[i]);
  for (let i = 0; i < T2.length; i++) uvs.push(T2[i]);
  triPart.length = 0; for (let t = 0; t < idx.length / 3; t++) triPart.push(0); // simplified models are single-part
  log('simplified to', pos.length / 3, 'verts', idx.length / 3, 'tris');
}

/* 1c. Low-poly models (e.g. a 3ds Max cap that relied on render-time smoothing) are subdivided
   and relaxed so curves read smooth. Open edges stay put so the brim and hems keep their line. */
for (let round = 0; round < (PR.subdivide || 0); round++) {
  const mid = new Map(), I2 = [], T2 = [];
  const midpoint = (a, b) => {
    const k = a < b ? a * 4194304 + b : b * 4194304 + a;
    let m = mid.get(k);
    if (m === undefined) {
      m = pos.length / 3; mid.set(k, m);
      for (let j = 0; j < 3; j++) { pos.push((pos[a * 3 + j] + pos[b * 3 + j]) / 2); nrm.push(0); }
      uvs.push((uvs[a * 2] + uvs[b * 2]) / 2, (uvs[a * 2 + 1] + uvs[b * 2 + 1]) / 2);
    }
    return m;
  };
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]], ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    I2.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca); for (let k = 0; k < 4; k++) T2.push(triPart[t / 3]);
  }
  idx.length = 0; for (const x of I2) idx.push(x);
  triPart.length = 0; for (const x of T2) triPart.push(x);
  // weld by position (UV seams split corners), find open edges, then relax interior points (Taubin)
  const key = new Map(), weld = new Int32Array(pos.length / 3);
  for (let i = 0; i < weld.length; i++) { const k = `${pos[i * 3].toFixed(5)},${pos[i * 3 + 1].toFixed(5)},${pos[i * 3 + 2].toFixed(5)}`; let r = key.get(k); if (r === undefined) key.set(k, r = i); weld[i] = r; }
  const edgeCount = new Map(), nb = new Map();
  for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = weld[idx[t + k]], b = weld[idx[t + (k + 1) % 3]], e = a < b ? a * 4194304 + b : b * 4194304 + a;
    edgeCount.set(e, (edgeCount.get(e) || 0) + 1);
    (nb.get(a) || nb.set(a, new Set()).get(a)).add(b); (nb.get(b) || nb.set(b, new Set()).get(b)).add(a);
  }
  const fixed = new Set();
  for (const [e, n] of edgeCount) if (n === 1) { fixed.add(Math.floor(e / 4194304)); fixed.add(e % 4194304); }
  for (const lambda of [0.5, -0.53, 0.5, -0.53]) {
    const next = new Map();
    for (const [r, set] of nb) {
      if (fixed.has(r)) continue;
      let x = 0, y = 0, z = 0; for (const q of set) { x += pos[q * 3]; y += pos[q * 3 + 1]; z += pos[q * 3 + 2]; }
      const n = set.size; next.set(r, [pos[r * 3] + lambda * (x / n - pos[r * 3]), pos[r * 3 + 1] + lambda * (y / n - pos[r * 3 + 1]), pos[r * 3 + 2] + lambda * (z / n - pos[r * 3 + 2])]);
    }
    for (const [r, v3] of next) { pos[r * 3] = v3[0]; pos[r * 3 + 1] = v3[1]; pos[r * 3 + 2] = v3[2]; }
  }
  for (let i = 0; i < weld.length; i++) if (weld[i] !== i) for (let j = 0; j < 3; j++) pos[i * 3 + j] = pos[weld[i] * 3 + j];
  // smooth normals over welded positions
  const acc = new Float64Array(pos.length), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    A.fromArray(pos, idx[t] * 3); B.fromArray(pos, idx[t + 1] * 3).sub(A); C.fromArray(pos, idx[t + 2] * 3).sub(A); B.cross(C);
    for (let k = 0; k < 3; k++) { const r = weld[idx[t + k]]; acc[r * 3] += B.x; acc[r * 3 + 1] += B.y; acc[r * 3 + 2] += B.z; }
  }
  nrm.length = pos.length;
  for (let i = 0; i < weld.length; i++) { const r = weld[i], l = Math.hypot(acc[r * 3], acc[r * 3 + 1], acc[r * 3 + 2]) || 1; nrm[i * 3] = acc[r * 3] / l; nrm[i * 3 + 1] = acc[r * 3 + 1] / l; nrm[i * 3 + 2] = acc[r * 3 + 2] / l; }
  log('subdivided to', pos.length / 3, 'verts', idx.length / 3, 'tris');
}

/* 2. (Z-up exports, e.g. from Autodesk tools, are turned Y-up first) */
if (PR.zUp) for (const arr of [pos, nrm]) for (let i = 0; i < arr.length; i += 3) { const y = arr[i + 1], z = arr[i + 2]; arr[i + 1] = z; arr[i + 2] = -y; }

/* 2a. Square the garment up: its widest horizontal direction (the shoulder line) becomes x */
{
  let mx = 0, mz = 0; const n = pos.length / 3;
  for (let i = 0; i < pos.length; i += 3) { mx += pos[i]; mz += pos[i + 2]; }
  mx /= n; mz /= n;
  let sxx = 0, szz = 0, sxz = 0;
  for (let i = 0; i < pos.length; i += 3) { const x = pos[i] - mx, z = pos[i + 2] - mz; sxx += x * x; szz += z * z; sxz += x * z; }
  const yaw = PR.yaw !== undefined ? PR.yaw * Math.PI / 180 : 0.5 * Math.atan2(2 * sxz, sxx - szz) + (PR.yawOffset || 0) * Math.PI / 180; // angle of the principal axis from +x
  if (Math.abs(yaw) > 0.02) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const arr of [pos, nrm]) for (let i = 0; i < arr.length; i += 3) { const x = arr[i], z = arr[i + 2]; arr[i] = c * x + s * z; arr[i + 2] = -s * x + c * z; }
    log('squared up by', (yaw * 180 / Math.PI).toFixed(1), 'degrees');
  }
}
/* 2. Fit into the studio's space: ~3 units tall, centred, hem near y = -1.35 */
const box = new THREE.Box3().setFromArray(pos);
const size = box.getSize(new THREE.Vector3());
// garments: 3 units tall from y = -1.35; accessories (`fitMax`): largest side fitMax, centred at y = 0.15
const S = PR.fitMax ? PR.fitMax / Math.max(size.x, size.y, size.z) : 3.0 / size.y, cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
const y0 = PR.fitMax ? 0.15 - size.y * S / 2 : -1.35;
for (let i = 0; i < pos.length; i += 3) {
  pos[i] = (pos[i] - cx) * S; pos[i + 1] = (pos[i + 1] - box.min.y) * S + y0; pos[i + 2] = (pos[i + 2] - cz) * S;
}
const fitted = new THREE.Box3().setFromArray(pos);
log('fitted', fitted.min.toArray().map(x => +x.toFixed(2)), fitted.max.toArray().map(x => +x.toFixed(2)));

let geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
geo.setIndex(idx);
let bvh = new MeshBVH(geo);
const ray = new THREE.Ray();

/* 4b. Pattern pieces: each connected panel of a CLO-style export is one sewing pattern piece,
   and its UVs are that piece laid flat. Lay the pieces out side by side (keeping their real
   relative size) and give every vertex a UV in that layout, so the studio can paint colours,
   patterns and prints per piece in 2D. */
let pieces = null, layout = null;
const auv = new Float32Array(pos.length / 3 * 2);
if (hasUV && PR.pieces !== false) {
  const nv = pos.length / 3, par = new Int32Array(nv).map((_, i) => i);
  const find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  for (let t = 0; t < idx.length; t += 3) { const r = find(idx[t]); par[find(idx[t + 1])] = r; par[find(idx[t + 2])] = find(idx[t]); }
  const comps = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const r = find(idx[t]);
    let c = comps.get(r); if (!c) comps.set(r, c = { tris: [], verts: new Set() });
    c.tris.push(t); for (let k = 0; k < 3; k++) c.verts.add(idx[t + k]);
  }
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  let list = [...comps.values()].map(c => {
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity, cx = 0, cy = 0, cz = 0, area = 0, uvArea = 0;
    for (const i of c.verts) { const u = uvs[i * 2], w = uvs[i * 2 + 1]; u0 = Math.min(u0, u); v0 = Math.min(v0, w); u1 = Math.max(u1, u); v1 = Math.max(v1, w); cx += pos[i * 3]; cy += pos[i * 3 + 1]; cz += pos[i * 3 + 2]; }
    for (const t of c.tris) { const a = idx[t] * 3; ab.set(pos[idx[t + 1] * 3] - pos[a], pos[idx[t + 1] * 3 + 1] - pos[a + 1], pos[idx[t + 1] * 3 + 2] - pos[a + 2]); ac.set(pos[idx[t + 2] * 3] - pos[a], pos[idx[t + 2] * 3 + 1] - pos[a + 1], pos[idx[t + 2] * 3 + 2] - pos[a + 2]); area += ab.cross(ac).length() / 2;
      const [i0, i1, i2] = [idx[t], idx[t + 1], idx[t + 2]]; uvArea += Math.abs((uvs[i1 * 2] - uvs[i0 * 2]) * (uvs[i2 * 2 + 1] - uvs[i0 * 2 + 1]) - (uvs[i2 * 2] - uvs[i0 * 2]) * (uvs[i1 * 2 + 1] - uvs[i0 * 2 + 1])) / 2; }
    const n = c.verts.size;
    return { ...c, u0, v0, u1, v1, w: u1 - u0, h: v1 - v0, c: [cx / n, cy / n, cz / n], area, uvArea };
  }).filter(c => c.w > 0 && c.h > 0);
  // does UV v grow with height? if not, flip pieces so they lie upright in the layout
  let cov = 0;
  for (const c of list) for (const i of c.verts) cov += (uvs[i * 2 + 1] - (c.v0 + c.v1) / 2) * (pos[i * 3 + 1] - c.c[1]);
  const vUp = cov >= 0;
  // double-layer exports repeat each piece (inner and outer fabric layer): same flat size,
  // nearly the same place on the body → one entry, one place in the layout
  const groupsList = [];
  for (const c of [...list].sort((a, b) => b.area - a.area)) {
    const g = groupsList.find(g => { const o = g[0]; return Math.abs(o.w - c.w) / o.w < 0.02 && Math.abs(o.h - c.h) / o.h < 0.02 && Math.hypot(o.c[0] - c.c[0], o.c[1] - c.c[1], o.c[2] - c.c[2]) < 0.15; });
    if (g) g.push(c); else groupsList.push([c]);
  }
  const groups = new Map(groupsList.map((g, i) => [i, g]));
  const uniq = [...groups.values()].map(g => ({ members: g, w: g[0].w, h: g[0].h, area: g.reduce((s, c) => s + c.area, 0) / g.length, uvArea: g[0].uvArea, c: g[0].c }));
  // shelf-pack, tallest first
  const maxDim = Math.max(...uniq.map(p => Math.max(p.w, p.h))), m = maxDim * 0.06;
  const rowW = Math.sqrt(uniq.reduce((s, p) => s + (p.w + m) * (p.h + m), 0)) * 1.5;
  let x = m, y = m, rowH = 0, W = 0;
  for (const p of [...uniq].sort((a, b) => b.h - a.h)) {
    if (x + p.w + m > rowW && x > m) { x = m; y += rowH + m; rowH = 0; }
    p.x = x; p.y = y; x += p.w + m; rowH = Math.max(rowH, p.h); W = Math.max(W, x);
  }
  const H = y + rowH + m;
  // names from where each piece sits on the garment (left = the wearer's left = +x)
  const totalArea = uniq.reduce((s, p) => s + p.area, 0), big = Math.max(...uniq.map(p => p.area));
  const used = new Map();
  const nameOf = p => {
    const [x0, y0, z0] = p.c, share = p.area / big;
    let n;
    if (share > 0.45 && Math.abs(x0) < 0.4) n = y0 > 1.2 ? 'Hood' : z0 >= 0 ? 'Front' : 'Back';
    else if (share > 0.25 && y0 > 1.15 && Math.abs(x0) < 0.5) n = 'Hood';
    else if (share > 0.1 && Math.abs(x0) > 0.45) n = x0 > 0 ? 'Left sleeve' : 'Right sleeve';
    else if (Math.abs(x0) > 0.55) n = x0 > 0 ? 'Left cuff' : 'Right cuff';
    else if (y0 < -1.0) n = 'Hem band';
    else if (y0 > 1.2) n = 'Collar';
    else if (z0 > 0 && y0 < 0) n = 'Pocket';
    else n = 'Trim';
    const k = (used.get(n) || 0) + 1; used.set(n, k);
    const full = k > 1 ? `${n} ${k}` : n;
    return PR.rename?.[full] || full;
  };
  // outline of each piece: its longest boundary loop, in layout space (x right, y down, 0…1)
  const toLayout = (p, c, i) => {
    const lu = uvs[i * 2] - c.u0, lv = vUp ? c.v1 - uvs[i * 2 + 1] : uvs[i * 2 + 1] - c.v0; // distance from the piece's top
    return [(p.x + lu) / W, (p.y + lv) / H];
  };
  pieces = [];
  uniq.sort((a, b) => b.area - a.area).forEach((p, id) => {
    for (const c of p.members) for (const i of c.verts) { const [lx, ly] = toLayout(p, c, i); auv[i * 2] = lx; auv[i * 2 + 1] = 1 - ly; }
    const c = p.members[0], cnt = new Map();
    for (const t of c.tris) for (let k = 0; k < 3; k++) { const a = idx[t + k], b = idx[t + (k + 1) % 3], key = a < b ? a * 1e7 + b : b * 1e7 + a; const e = cnt.get(key); if (e) e.n++; else cnt.set(key, { n: 1, a, b }); }
    const next = new Map(); for (const e of cnt.values()) if (e.n === 1) next.set(e.a, e.b);
    let best = [];
    const seen = new Set();
    for (const s0 of next.keys()) { if (seen.has(s0)) continue; const loop = []; let v0 = s0; while (v0 !== undefined && !seen.has(v0)) { seen.add(v0); loop.push(v0); v0 = next.get(v0); } if (loop.length > best.length) best = loop; }
    const step = Math.max(1, Math.floor(best.length / 160));
    const outline = best.filter((_, k) => k % step === 0).map(i => toLayout(p, c, i).map(n => +n.toFixed(4)));
    pieces.push({ id, name: nameOf(p), rect: [p.x / W, p.y / H, p.w / W, p.h / H].map(n => +n.toFixed(4)), outline, area: +(p.area / totalArea).toFixed(4), hidden: p.area / totalArea < 0.004 });
  });
  // studio units per layout unit, from 3D area vs flat area, so pattern scale matches the 3D garment
  const k = Math.sqrt(uniq.reduce((s, p) => s + p.area, 0) / uniq.reduce((s, p) => s + p.uvArea, 0));
  if (process.env.DEBUG_PIECES) for (const p of uniq.slice().sort((a, b) => b.area - a.area).slice(0, 15)) log('group', p.members.length, 'members', p.members.map(c => `${c.tris.length}t a=${c.area.toFixed(3)} c=${c.c.map(x => x.toFixed(2))}`).join(' | '));
  if (PR.dropInner) {
    // "thick" CLO exports carry an inner fabric layer that pokes through the outer one: keep the outer only
    const drop = new Set();
    for (const p of uniq) for (const c of p.members.slice(1)) for (const t of c.tris) drop.add(t);
    const I2 = [], P2 = [];
    for (let t = 0; t < idx.length; t += 3) if (!drop.has(t)) { I2.push(idx[t], idx[t + 1], idx[t + 2]); P2.push(triPart[t / 3]); }
    log('dropped inner layer:', drop.size, 'of', idx.length / 3, 'tris');
    idx.splice(0, idx.length, ...[]); for (const x of I2) idx.push(x);
    triPart.length = 0; for (const x of P2) triPart.push(x);
    geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    bvh = new MeshBVH(geo);
  }
  layout = { aspect: +(W / H).toFixed(4), size: [+(W * k).toFixed(3), +(H * k).toFixed(3)] };
  log('pattern pieces', pieces.length, pieces.filter(p => !p.hidden).map(p => p.name).join(', '));
} else log(hasUV ? 'pattern pieces not used for this product' : 'no UVs: no pattern pieces for this model');

/* 3. Ambient occlusion */
const K = FAST ? 0 : 28, MAXD = 0.5, col = new Float32Array(pos.length);
{
  const dirs = [];
  for (let k = 0; k < K; k++) { const u = (k + 0.5) / K, phi = k * 2.399963, r = Math.sqrt(u); dirs.push(new THREE.Vector3(r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - u))); }
  const q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), n = new THREE.Vector3();
  for (let i = 0; i < pos.length / 3; i++) {
    n.fromArray(nrm, i * 3); q.setFromUnitVectors(Z, n);
    ray.origin.fromArray(pos, i * 3).addScaledVector(n, 0.004);
    let occ = 0;
    for (const d of dirs) {
      ray.direction.copy(d).applyQuaternion(q);
      const h = bvh.raycastFirst(ray, THREE.DoubleSide, 0, MAXD);
      if (h) occ += 1 - h.distance / MAXD * 0.6;
    }
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = K ? Math.min(1, Math.max(0.15, 1 - occ / K * 1.1)) : 1;
    if (i % 50000 === 0) log('ao', i);
  }
}
log('ao baked');

/* 4. Print placements (frames in studio space) and their visible surfaces */
const W = fitted.max.x - fitted.min.x;
const placements = {
  front: { origin: [0, PR.front[0], 0], dir: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], w: PR.front[1], h: PR.front[2] },
  back: { origin: [0, PR.back[0], 0], dir: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], w: PR.back[1], h: PR.back[2] },
};
for (const [key, s] of PR.sleeve ? [['left', 1], ['right', -1]] : []) {
  const S2 = PR.sleeve;
  const along = new THREE.Vector3(S2.lean * s, -1, 0).normalize(), dir = new THREE.Vector3(1 * s, S2.lean, 0).normalize();
  const vAxis = dir.clone().cross(along);
  placements[key] = { origin: [W * S2.x * s, S2.y, 0], dir: dir.toArray(), u: along.toArray(), v: vAxis.toArray(), w: S2.w, h: S2.h };
}
if (PR.leg) placements.left = { origin: [PR.leg.x, PR.leg.y, 0], dir: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], w: PR.leg.w, h: PR.leg.h, part: 'shorts' };
for (const F of Object.values(placements)) F.targets = [F.part || PART_NAMES[0]];
const decals = {};
{
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ce = new THREE.Vector3(), fn = new THREE.Vector3(), p = new THREE.Vector3();
  for (const [key, F] of Object.entries(placements)) {
    const o = new THREE.Vector3(...F.origin), n = new THREE.Vector3(...F.dir), u = new THREE.Vector3(...F.u), vv = new THREE.Vector3(...F.v);
    const out = { pos: [], nrm: [], col: [], uv: [] };
    for (let t = 0; t < idx.length; t += 3) {
      if (PART_NAMES[triPart[t / 3]] !== F.targets[0]) continue;
      a.fromArray(pos, idx[t] * 3); b.fromArray(pos, idx[t + 1] * 3); c.fromArray(pos, idx[t + 2] * 3);
      ce.copy(a).add(b).add(c).divideScalar(3);
      p.copy(ce).sub(o);
      if (Math.abs(p.dot(u)) > F.w * 0.56 || Math.abs(p.dot(vv)) > F.h * 0.56) continue;
      fn.set(0, 0, 0); for (let k = 0; k < 3; k++) fn.x += nrm[idx[t + k] * 3], fn.y += nrm[idx[t + k] * 3 + 1], fn.z += nrm[idx[t + k] * 3 + 2];
      const facing = fn.normalize().dot(n);
      if (Math.abs(facing) < 0.1) continue;
      // visible to the projector: the first surface hit coming in along -dir is this one
      ray.origin.copy(ce).addScaledVector(n, 3); ray.direction.copy(n).negate();
      const h = bvh.raycastFirst(ray, THREE.DoubleSide);
      if (!h || h.distance < 3 - 0.012) continue;
      // exports can mix windings: keep each copied face (and its normals) turned toward the projector
      const order = facing > 0 ? [0, 1, 2] : [0, 2, 1];
      for (const k of order) {
        const i = idx[t + k];
        p.fromArray(pos, i * 3); const nn = new THREE.Vector3().fromArray(nrm, i * 3);
        if (nn.dot(n) < 0) nn.negate();
        p.addScaledVector(nn, 0.002);
        out.pos.push(p.x, p.y, p.z); out.nrm.push(nn.x, nn.y, nn.z); out.col.push(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
        p.sub(o); out.uv.push(p.dot(u) / F.w + 0.5, p.dot(vv) / F.h + 0.5);
      }
    }
    decals[key] = out;
    log('print surface', key, out.pos.length / 9, 'tris');
  }
}

/* 5. Write */
const doc = new Document(); const buf = doc.createBuffer();
const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
const scene = doc.createScene('garment').setExtras({ placements, pieces, layout, credit, areas: PR.areas || Object.keys(placements), generator: 'hoodie-studio/tools/prepare-model.mjs' });
const body = doc.createPrimitive()
  .setAttribute('POSITION', acc('VEC3', Float32Array.from(pos)))
  .setAttribute('NORMAL', acc('VEC3', Float32Array.from(nrm)))
  .setAttribute('COLOR_0', acc('VEC3', col))
  .setIndices(acc('SCALAR', Uint32Array.from(idx)));
if (pieces) body.setAttribute('TEXCOORD_0', acc('VEC2', auv));
else if (PR.keepUV && hasUV) body.setAttribute('TEXCOORD_0', acc('VEC2', Float32Array.from(uvs)));
if (PR.normalMap && hasUV && !pieces) {
  // surface detail only (weave, dimples); colour textures are never carried over
  const img = readFileSync(join(dirname(input), PR.normalMap));
  const tex = doc.createTexture('detail').setImage(img).setMimeType('image/jpeg');
  body.setMaterial(doc.createMaterial('detail').setNormalTexture(tex));
}
if (PART_NAMES.length === 1) scene.addChild(doc.createNode('body').setMesh(doc.createMesh('body').addPrimitive(body)));
else PART_NAMES.forEach((name, k) => {
  // one mesh per part, so each can take its own colour
  const map = new Map(), P2 = [], N2 = [], C2 = [], I2 = [];
  for (let t = 0; t < idx.length; t += 3) {
    if (triPart[t / 3] !== k) continue;
    for (let j = 0; j < 3; j++) {
      const i = idx[t + j];
      if (!map.has(i)) { map.set(i, P2.length / 3); P2.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); N2.push(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]); C2.push(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]); }
      I2.push(map.get(i));
    }
  }
  const prim = doc.createPrimitive().setAttribute('POSITION', acc('VEC3', Float32Array.from(P2))).setAttribute('NORMAL', acc('VEC3', Float32Array.from(N2)))
    .setAttribute('COLOR_0', acc('VEC3', Float32Array.from(C2))).setIndices(acc('SCALAR', Uint32Array.from(I2)));
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
});
for (const [key, d] of Object.entries(decals)) {
  if (!d.pos.length) { console.warn('warning: print area', key, 'covers nothing on this model'); continue; }
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc('VEC3', Float32Array.from(d.pos)))
    .setAttribute('NORMAL', acc('VEC3', Float32Array.from(d.nrm)))
    .setAttribute('COLOR_0', acc('VEC3', Float32Array.from(d.col)))
    .setAttribute('TEXCOORD_0', acc('VEC2', Float32Array.from(d.uv)));
  scene.addChild(doc.createNode('print_' + key).setMesh(doc.createMesh('print_' + key).addPrimitive(prim)));
}
await MeshoptEncoder.ready;
await doc.transform(
  quantize({ pattern: /^(POSITION|NORMAL|COLOR_0)$/, quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
const glb = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder }).writeBinary(doc);
writeFileSync(output, glb);
log('wrote', output, (glb.byteLength / 1e6).toFixed(2), 'MB');
