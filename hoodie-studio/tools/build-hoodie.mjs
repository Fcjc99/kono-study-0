// Builds hoodie.glb: a hoodie shaped around an invisible mannequin, settled with a
// position-based cloth simulation so gravity forms natural folds, with ribbed trims,
// a hood rim, drawstrings, a kangaroo pocket and baked ambient occlusion.
//
//   cd hoodie-studio/tools && npm install && npm run build
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { Document, NodeIO } from '@gltf-transform/core';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../hoodie.glb', import.meta.url));
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

/* ------------------------------------------------------------------ */
/* Mannequin and garment signed distance fields                        */
/* ------------------------------------------------------------------ */
function sdEll(px, py, pz, c, r) {
  const x = (px - c[0]) / r[0], y = (py - c[1]) / r[1], z = (pz - c[2]) / r[2];
  const k0 = Math.hypot(x, y, z), k1 = Math.hypot(x / r[0], y / r[1], z / r[2]);
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(r[0], r[1], r[2]);
}
function sdCap(px, py, pz, a, b, ra, rb) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const qx = px - a[0], qy = py - a[1], qz = pz - a[2];
  const t = clamp((qx * bx + qy * by + qz * bz) / (bx * bx + by * by + bz * bz), 0, 1);
  return Math.hypot(qx - bx * t, qy - by * t, qz - bz * t) - (ra + (rb - ra) * t);
}
const SHOULDER = s => [0.6 * s, 0.6, -0.03];
const ELBOW = s => [1.06 * s, -0.05, 0.03];
const WRIST = s => [1.36 * s, -0.68, 0.12];
const armDir = s => new THREE.Vector3(...WRIST(s)).sub(new THREE.Vector3(...ELBOW(s))).normalize();
const EXT = s => { const w = WRIST(s), d = armDir(s); return [w[0] + d.x * 0.26, w[1] + d.y * 0.26, w[2] + d.z * 0.26]; };

function torsoD(x, y, z) {
  let d = sdEll(x, y, z, [0, 0.22, 0], [0.70, 0.55, 0.37]);
  d = smin(d, sdEll(x, y, z, [0, -0.45, 0], [0.64, 0.7, 0.35]), 0.25);
  d = smin(d, sdEll(x, y, z, [0, -1.0, 0], [0.68, 0.45, 0.37]), 0.25);
  d = smin(d, sdCap(x, y, z, [-0.5, 0.6, -0.03], [0.5, 0.6, -0.03], 0.16, 0.16), 0.2);
  d = smin(d, sdCap(x, y, z, [-0.48, 0.62, -0.03], [0, 0.8, -0.03], 0.13, 0.13), 0.15);
  d = smin(d, sdCap(x, y, z, [0.48, 0.62, -0.03], [0, 0.8, -0.03], 0.13, 0.13), 0.15);
  return d;
}
const neckD = (x, y, z) => sdCap(x, y, z, [0, 0.65, -0.03], [0, 1.08, 0.0], 0.17, 0.16);
const headD = (x, y, z) => sdEll(x, y, z, [0, 1.33, 0.03], [0.31, 0.38, 0.34]);
function armD(x, y, z, s, ext) {
  return Math.min(sdCap(x, y, z, SHOULDER(s), ELBOW(s), 0.155, 0.135), sdCap(x, y, z, ELBOW(s), ext ? EXT(s) : WRIST(s), 0.13, ext ? 0.095 : 0.10));
}
function bodySDF(x, y, z) {
  let d = smin(torsoD(x, y, z), neckD(x, y, z), 0.12);
  d = smin(d, headD(x, y, z), 0.08);
  d = smin(d, armD(x, y, z, 1, false), 0.08);
  return smin(d, armD(x, y, z, -1, false), 0.08);
}
function garmentSDF(x, y, z) {
  let d = smin(torsoD(x, y, z) - 0.12, neckD(x, y, z) - 0.13, 0.15);
  d = smin(d, headD(x, y, z) - 0.14, 0.12);
  d = smin(d, armD(x, y, z, 1, true) - 0.095, 0.06);
  return smin(d, armD(x, y, z, -1, true) - 0.095, 0.06);
}
function gradient(f, x, y, z, out, e = 1e-3) {
  return out.set(f(x + e, y, z) - f(x - e, y, z), f(x, y + e, z) - f(x, y - e, z), f(x, y, z + e) - f(x, y, z - e)).normalize();
}

if (process.env.PROBE) { for (const q of [[0.4,0.6,0],[0,0.9,0],[0,1.3,0],[0,1.75,0],[0.4,0.85,0],[0,0.2,0.5],[0,0.2,0.3]]) console.log(q, bodySDF(...q).toFixed(3), garmentSDF(...q).toFixed(3)); process.exit(0); }
/* ------------------------------------------------------------------ */
/* Surface nets → triangle mesh                                        */
/* ------------------------------------------------------------------ */
function surfaceNets(f, min, max, h) {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1, ny = Math.ceil((max[1] - min[1]) / h) + 1, nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const F = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => (k * ny + j) * nx + i;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
    F[id(i, j, k)] = f(min[0] + i * h, min[1] + j * h, min[2] + k * h);
  const cid = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
  const cellV = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const val = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { val[c] = F[id(i + corners[c][0], j + corners[c][1], k + corners[c][2])]; if (val[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((val[a] < 0) === (val[b] < 0)) continue;
      const t = val[a] / (val[a] - val[b]);
      sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
      sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
      sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
      n++;
    }
    cellV[cid(i, j, k)] = pos.length / 3;
    pos.push(min[0] + (i + sx / n) * h, min[1] + (j + sy / n) * h, min[2] + (k + sz / n) * h);
  }
  const tris = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tris.push(a, c, b, a, d, c); else tris.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = F[id(i, j, k)] < 0;
    if (v0 !== (F[id(i + 1, j, k)] < 0)) quad(cellV[cid(i, j - 1, k - 1)], cellV[cid(i, j, k - 1)], cellV[cid(i, j, k)], cellV[cid(i, j - 1, k)], v0);
    if (v0 !== (F[id(i, j + 1, k)] < 0)) quad(cellV[cid(i - 1, j, k - 1)], cellV[cid(i - 1, j, k)], cellV[cid(i, j, k)], cellV[cid(i, j, k - 1)], v0);
    if (v0 !== (F[id(i, j, k + 1)] < 0)) quad(cellV[cid(i - 1, j - 1, k)], cellV[cid(i, j - 1, k)], cellV[cid(i, j, k)], cellV[cid(i - 1, j, k)], v0);
  }
  return { pos, tris };
}

/* ------------------------------------------------------------------ */
/* Mesh utilities                                                      */
/* ------------------------------------------------------------------ */
const P = (m, i) => new THREE.Vector3(m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]);
function centroid(m, f) {
  const a = m.tris[f * 3], b = m.tris[f * 3 + 1], c = m.tris[f * 3 + 2];
  return new THREE.Vector3((m.pos[a * 3] + m.pos[b * 3] + m.pos[c * 3]) / 3, (m.pos[a * 3 + 1] + m.pos[b * 3 + 1] + m.pos[c * 3 + 1]) / 3, (m.pos[a * 3 + 2] + m.pos[b * 3 + 2] + m.pos[c * 3 + 2]) / 3);
}
// Orient every face so its normal agrees with the field gradient (outward).
function orientFaces(m, f) {
  const g = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  for (let t = 0; t < m.tris.length / 3; t++) {
    const [a, b, c] = [m.tris[t * 3], m.tris[t * 3 + 1], m.tris[t * 3 + 2]];
    const pa = P(m, a); ab.copy(P(m, b)).sub(pa); ac.copy(P(m, c)).sub(pa);
    const n = ab.cross(ac); const ce = centroid(m, t);
    gradient(f, ce.x, ce.y, ce.z, g);
    if (n.dot(g) < 0) { m.tris[t * 3 + 1] = c; m.tris[t * 3 + 2] = b; }
  }
}
// Splits all triangles crossing the plane n·p = d, snapping near-plane vertices first to avoid slivers.
function splitByPlane(m, n, d, snap) {
  const N = new THREE.Vector3(...n).normalize();
  const sd = i => N.x * m.pos[i * 3] + N.y * m.pos[i * 3 + 1] + N.z * m.pos[i * 3 + 2] - d;
  const nv = m.pos.length / 3;
  const s = new Float64Array(nv);
  for (let i = 0; i < nv; i++) {
    s[i] = sd(i);
    if (Math.abs(s[i]) < snap) { m.pos[i * 3] -= N.x * s[i]; m.pos[i * 3 + 1] -= N.y * s[i]; m.pos[i * 3 + 2] -= N.z * s[i]; s[i] = 0; }
  }
  const cut = new Map();
  const edgeVert = (a, b) => {
    const key = a < b ? a * 1e7 + b : b * 1e7 + a;
    let v = cut.get(key);
    if (v === undefined) {
      const t = s[a] / (s[a] - s[b]);
      v = m.pos.length / 3;
      m.pos.push(lerp(m.pos[a * 3], m.pos[b * 3], t), lerp(m.pos[a * 3 + 1], m.pos[b * 3 + 1], t), lerp(m.pos[a * 3 + 2], m.pos[b * 3 + 2], t));
      cut.set(key, v);
    }
    return v;
  };
  const sv = i => (i < nv ? s[i] : 0);
  const out = [];
  for (let t = 0; t < m.tris.length / 3; t++) {
    const tri = [m.tris[t * 3], m.tris[t * 3 + 1], m.tris[t * 3 + 2]];
    const ss = tri.map(sv);
    if (!(ss.some(x => x > 0) && ss.some(x => x < 0))) { out.push(...tri); continue; }
    const pos = [], neg = [];
    for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3], sa = ss[k], sb = ss[(k + 1) % 3];
      if (sa >= 0) pos.push(a); if (sa <= 0) neg.push(a);
      if ((sa > 0 && sb < 0) || (sa < 0 && sb > 0)) { const v = edgeVert(a, b); pos.push(v); neg.push(v); }
    }
    for (const poly of [pos, neg]) for (let k = 1; k + 1 < poly.length; k++) out.push(poly[0], poly[k], poly[k + 1]);
  }
  m.tris = out;
}
function removeFaces(m, pred) {
  const out = [];
  for (let t = 0; t < m.tris.length / 3; t++) if (!pred(centroid(m, t))) out.push(m.tris[t * 3], m.tris[t * 3 + 1], m.tris[t * 3 + 2]);
  m.tris = out;
}
function compact(m, extra = []) {
  const map = new Int32Array(m.pos.length / 3).fill(-1); const pos = [];
  const ex = extra.map(() => []);
  m.tris = m.tris.map(i => {
    if (map[i] < 0) { map[i] = pos.length / 3; pos.push(m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]); extra.forEach((arr, k) => ex[k].push(arr[i])); }
    return map[i];
  });
  m.pos = pos;
  return ex;
}
function keepLargestComponent(m) {
  const nv = m.pos.length / 3, parent = new Int32Array(nv).map((_, i) => i);
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let t = 0; t < m.tris.length; t += 3) { const a = find(m.tris[t]); parent[find(m.tris[t + 1])] = a; parent[find(m.tris[t + 2])] = a; }
  const count = new Map();
  for (let t = 0; t < m.tris.length; t += 3) { const r = find(m.tris[t]); count.set(r, (count.get(r) || 0) + 1); }
  const best = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const out = [];
  for (let t = 0; t < m.tris.length; t += 3) if (find(m.tris[t]) === best) out.push(m.tris[t], m.tris[t + 1], m.tris[t + 2]);
  m.tris = out;
}
function boundaryLoops(m) {
  const cnt = new Map();
  for (let t = 0; t < m.tris.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = m.tris[t + k], b = m.tris[t + (k + 1) % 3];
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    const e = cnt.get(key); if (e) e.n++; else cnt.set(key, { n: 1, a, b });
  }
  const next = new Map();
  for (const e of cnt.values()) if (e.n === 1) next.set(e.a, e.b);
  const loops = [], seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = []; let v = start;
    while (v !== undefined && !seen.has(v)) { seen.add(v); loop.push(v); v = next.get(v); }
    loops.push(loop);
  }
  return loops;
}
function vertexNormals(pos, tris) {
  const n = new Float32Array(pos.length);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < tris.length; t += 3) {
    const [i, j, k] = [tris[t], tris[t + 1], tris[t + 2]];
    a.fromArray(pos, i * 3); b.fromArray(pos, j * 3).sub(a); c.fromArray(pos, k * 3).sub(a);
    b.cross(c);
    for (const v of [i, j, k]) { n[v * 3] += b.x; n[v * 3 + 1] += b.y; n[v * 3 + 2] += b.z; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

/* ------------------------------------------------------------------ */
/* 1. Garment surface                                                  */
/* ------------------------------------------------------------------ */
const H = 0.026;
const mesh = surfaceNets(garmentSDF, [-1.75, -1.45, -0.8], [1.75, 1.95, 0.8], H);
log('surface nets', mesh.pos.length / 3, 'verts', mesh.tris.length / 3, 'tris');
{ // project onto the iso-surface
  const g = new THREE.Vector3();
  for (let it = 0; it < 3; it++) for (let i = 0; i < mesh.pos.length; i += 3) {
    const d = garmentSDF(mesh.pos[i], mesh.pos[i + 1], mesh.pos[i + 2]);
    gradient(garmentSDF, mesh.pos[i], mesh.pos[i + 1], mesh.pos[i + 2], g);
    mesh.pos[i] -= g.x * d; mesh.pos[i + 1] -= g.y * d; mesh.pos[i + 2] -= g.z * d;
  }
}
orientFaces(mesh, garmentSDF);

// Openings and seams, as planes [normal, d]
const HEM_Y = -1.12;
const PLANES = {
  hem: [[0, -1, 0], -HEM_Y],
  faceFront: [[0, 0.15, 1], null], faceV1: [[-0.9, 1, 0], 0.98], faceV2: [[0.9, 1, 0], 0.98],
  hoodSeam: [[0, 1, -0.25], null],
};
const unit = v => new THREE.Vector3(...v).normalize();
PLANES.faceFront[1] = unit(PLANES.faceFront[0]).dot(new THREE.Vector3(0, 1.25, 0.2));
PLANES.hoodSeam[1] = unit(PLANES.hoodSeam[0]).dot(new THREE.Vector3(0, 0.92, 0));
PLANES.faceV1[1] = PLANES.faceV1[1] / Math.hypot(0.9, 1); PLANES.faceV2[1] = PLANES.faceV2[1] / Math.hypot(0.9, 1);
for (const s of [1, -1]) {
  const dir = armDir(s), w = new THREE.Vector3(...WRIST(s)).addScaledVector(dir, 0.12);
  PLANES['cuff' + s] = [dir.toArray(), dir.dot(w)];
  const an = unit([0.98 * s, 0.18, 0]);
  PLANES['arm' + s] = [an.toArray(), an.dot(new THREE.Vector3(0.67 * s, 0.5, 0))];
}
const side = (name, p) => { const [n, d] = PLANES[name]; return unit(n).dot(p) - d; };
for (const k of Object.keys(PLANES)) splitByPlane(mesh, PLANES[k][0], PLANES[k][1], H * 0.3);
const isSleeve = (p, s) => side('arm' + s, p) > 0 && p.x * s > 0.5;
removeFaces(mesh, p =>
  side('hem', p) > 0 ||
  (side('faceFront', p) > 0 && side('faceV1', p) > 0 && side('faceV2', p) > 0) ||
  [1, -1].some(s => isSleeve(p, s) && side('cuff' + s, p) > 0));
keepLargestComponent(mesh);
compact(mesh);
log('garment', mesh.pos.length / 3, 'verts', mesh.tris.length / 3, 'tris');

// Regions: 0 body, 1 left sleeve (+x), 2 right sleeve, 3 hood
const REGION = { body: 0, sleeveL: 1, sleeveR: 2, hood: 3 };
const faceRegion = new Uint8Array(mesh.tris.length / 3);
for (let t = 0; t < faceRegion.length; t++) {
  const c = centroid(mesh, t);
  faceRegion[t] = isSleeve(c, 1) ? 1 : isSleeve(c, -1) ? 2 : side('hoodSeam', c) > 0 ? 3 : 0;
}

const loops = boundaryLoops(mesh).map(l => {
  const c = l.reduce((acc, i) => acc.add(P(mesh, i)), new THREE.Vector3()).divideScalar(l.length);
  return { verts: l, c };
});
const hemLoop = loops.find(l => l.c.y < -1.0);
const cuffLoops = { 1: loops.find(l => l.c.x > 0.9 && l.c.y < -0.4), [-1]: loops.find(l => l.c.x < -0.9 && l.c.y < -0.4) };
const faceLoop = loops.find(l => l.c.y > 0.8);
log('loops', loops.map(l => `${l.verts.length}@(${l.c.x.toFixed(2)},${l.c.y.toFixed(2)},${l.c.z.toFixed(2)})`).join(' '));
if (!hemLoop || !cuffLoops[1] || !cuffLoops[-1] || !faceLoop || loops.length !== 4) throw new Error('unexpected openings');

/* ------------------------------------------------------------------ */
/* 2. Cloth simulation (position based dynamics)                       */
/* ------------------------------------------------------------------ */
const NV = mesh.pos.length / 3;
const x = Float64Array.from(mesh.pos), p = new Float64Array(x), v = new Float64Array(NV * 3);
const invMass = new Float64Array(NV).fill(1);
const pinStart = new Map(), pinEnd = new Map();
// The rib bands hold a short strip of body fabric above each opening; pin that strip so slack gathers above it
for (let i = 0; i < NV; i++) {
  const q = P(mesh, i);
  if (q.y < HEM_Y + 0.07) {
    invMass[i] = 0; pinStart.set(i, q.clone());
    pinEnd.set(i, new THREE.Vector3(q.x * 0.9, q.y, hemLoop.c.z + (q.z - hemLoop.c.z) * 0.9));
    continue;
  }
  for (const s of [1, -1]) {
    const L = cuffLoops[s], dir = armDir(s);
    if (!isSleeve(q, s) || side('cuff' + s, q) < -0.07) continue;
    invMass[i] = 0; pinStart.set(i, q.clone());
    pinEnd.set(i, q.clone().sub(L.c).multiplyScalar(0.78).add(L.c).addScaledVector(dir, -0.13));
  }
}
// The hood rim (doubled fabric with a drawcord) keeps its shape around the face
for (const i of faceLoop.verts) { invMass[i] = 0; const q = P(mesh, i); pinStart.set(i, q.clone()); pinEnd.set(i, q.clone().add(new THREE.Vector3(0, -0.02, -0.02))); }
// constraints
const edgeSet = new Map(), opp = new Map();
for (let t = 0; t < mesh.tris.length; t += 3) for (let k = 0; k < 3; k++) {
  const a = mesh.tris[t + k], b = mesh.tris[t + (k + 1) % 3], c = mesh.tris[t + (k + 2) % 3];
  const key = a < b ? a * 1e7 + b : b * 1e7 + a;
  if (!edgeSet.has(key)) edgeSet.set(key, [Math.min(a, b), Math.max(a, b)]);
  (opp.get(key) || opp.set(key, []).get(key)).push(c);
}
const dist = (i, j) => Math.hypot(x[i * 3] - x[j * 3], x[i * 3 + 1] - x[j * 3 + 1], x[i * 3 + 2] - x[j * 3 + 2]);
const stretch = [], bend = [];
for (const [a, b] of edgeSet.values()) stretch.push(a, b, dist(a, b));
for (const [key, cs] of opp) if (cs.length === 2) bend.push(cs[0], cs[1], dist(cs[0], cs[1]));
// The hood rim is doubled fabric with a drawcord: stiffen bending within a band around it
const rimDist = new Float64Array(NV).fill(9);
{ const rim = faceLoop.verts.map(i => P(mesh, i));
  for (let i = 0; i < NV; i++) { const q = P(mesh, i); let m = 9; for (const r of rim) m = Math.min(m, q.distanceToSquared(r)); rimDist[i] = Math.sqrt(m); } }
const bendRim = [], bendRest = [];
for (let c = 0; c < bend.length; c += 3) (rimDist[bend[c]] < 0.09 && rimDist[bend[c + 1]] < 0.09 ? bendRim : bendRest).push(bend[c], bend[c + 1], bend[c + 2]);
const S = Float64Array.from(stretch), B = Float64Array.from(bendRest), BR = Float64Array.from(bendRim);
log('constraints', S.length / 3, 'stretch', B.length / 3, 'bend');

function project(C, kStretch, kCompress) {
  for (let c = 0; c < C.length; c += 3) {
    const i = C[c], j = C[c + 1], rest = C[c + 2];
    const wi = invMass[i], wj = invMass[j], w = wi + wj; if (!w) continue;
    const dx = p[j * 3] - p[i * 3], dy = p[j * 3 + 1] - p[i * 3 + 1], dz = p[j * 3 + 2] - p[i * 3 + 2];
    const len = Math.hypot(dx, dy, dz) || 1e-9, err = len - rest;
    const k = err > 0 ? kStretch : kCompress;
    const s = k * err / (len * w);
    p[i * 3] += dx * s * wi; p[i * 3 + 1] += dy * s * wi; p[i * 3 + 2] += dz * s * wi;
    p[j * 3] -= dx * s * wj; p[j * 3 + 1] -= dy * s * wj; p[j * 3 + 2] -= dz * s * wj;
  }
}
const FRAMES = +(process.env.FRAMES || 300), SUB = 3, ITERS = 6, DT = 1 / 60 / SUB, GRAV = 22, THICK = 0.016;
const g = new THREE.Vector3();
const cuffDir = { 1: unit(PLANES.cuff1[0]), [-1]: unit(PLANES['cuff-1'][0]) };
for (let f = 0; f < FRAMES; f++) {
  const a = clamp(f / (FRAMES * 0.35), 0, 1), ease = a * a * (3 - 2 * a);
  let contacts = 0;
  for (let sub = 0; sub < SUB; sub++) {
    for (let i = 0; i < NV; i++) {
      if (!invMass[i]) { const q = pinStart.get(i).clone().lerp(pinEnd.get(i), ease); p[i * 3] = q.x; p[i * 3 + 1] = q.y; p[i * 3 + 2] = q.z; continue; }
      v[i * 3 + 1] -= GRAV * DT;
      for (let k = 0; k < 3; k++) { v[i * 3 + k] *= 0.992; p[i * 3 + k] = x[i * 3 + k] + v[i * 3 + k] * DT; }
    }
    for (let it = 0; it < ITERS; it++) { project(S, 1, 0.85); project(B, 0.06, 0.06); project(BR, 0.7, 0.7); }
    // shelves: bloused fabric rests on top of the rib bands instead of sagging into them
    for (let i = 0; i < NV; i++) {
      if (!invMass[i]) continue;
      if (p[i * 3 + 1] < HEM_Y + 0.075) p[i * 3 + 1] = HEM_Y + 0.075;
      for (const s of [1, -1]) {
        if (p[i * 3] * s < 0.9) continue;
        const [n, d0] = PLANES['cuff' + s], dir = cuffDir[s];
        const over = dir.x * p[i * 3] + dir.y * p[i * 3 + 1] + dir.z * p[i * 3 + 2] - (d0 - 0.13 * ease - 0.075);
        if (over > 0) { p[i * 3] -= dir.x * over; p[i * 3 + 1] -= dir.y * over; p[i * 3 + 2] -= dir.z * over; }
      }
    }
    for (let i = 0; i < NV; i++) {
      if (!invMass[i]) continue;
      const d = bodySDF(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]) - THICK;
      if (d < 0) {
        contacts++;
        gradient(bodySDF, p[i * 3], p[i * 3 + 1], p[i * 3 + 2], g);
        p[i * 3] -= g.x * d; p[i * 3 + 1] -= g.y * d; p[i * 3 + 2] -= g.z * d;
        // friction: damp sliding along the body
        const mx = p[i * 3] - x[i * 3], my = p[i * 3 + 1] - x[i * 3 + 1], mz = p[i * 3 + 2] - x[i * 3 + 2];
        const nm = mx * g.x + my * g.y + mz * g.z;
        p[i * 3] -= (mx - nm * g.x) * 0.85; p[i * 3 + 1] -= (my - nm * g.y) * 0.85; p[i * 3 + 2] -= (mz - nm * g.z) * 0.85;
      }
    }
    for (let i = 0; i < NV * 3; i++) { v[i] = (p[i] - x[i]) / DT; x[i] = p[i]; }
  }
  if (f % 10 === 0) { let my = -9; for (let i = 1; i < NV * 3; i += 3) my = Math.max(my, x[i]); log('sim frame', f, 'contacts', contacts, 'maxY', my.toFixed(3)); }
}
mesh.pos = Array.from(x);
log('simulated');

/* ------------------------------------------------------------------ */
/* 3. Finishing: smoothing, seams, trims, rim, strings, pocket          */
/* ------------------------------------------------------------------ */
const nbrs = Array.from({ length: NV }, () => []);
for (const [a, b] of edgeSet.values()) { nbrs[a].push(b); nbrs[b].push(a); }
const onBoundary = new Uint8Array(NV);
for (const L of [hemLoop, cuffLoops[1], cuffLoops[-1], faceLoop]) for (const i of L.verts) onBoundary[i] = 1;
function smoothPass(lambda) {
  const np = mesh.pos.slice();
  for (let i = 0; i < NV; i++) {
    if (onBoundary[i]) continue;
    let ax = 0, ay = 0, az = 0; for (const j of nbrs[i]) { ax += mesh.pos[j * 3]; ay += mesh.pos[j * 3 + 1]; az += mesh.pos[j * 3 + 2]; }
    const n = nbrs[i].length;
    for (const [k, a] of [[0, ax], [1, ay], [2, az]]) np[i * 3 + k] += lambda * (a / n - mesh.pos[i * 3 + k]);
  }
  mesh.pos = np;
}
// Gather the fabric into the rib bands: nothing near a band may stick out past a radius that
// grows smoothly from the band's own radius, which turns crumpled frills into soft gathers.
const vRegion = new Uint8Array(NV);
for (let t = 0; t < faceRegion.length; t++) for (let k = 0; k < 3; k++) vRegion[mesh.tris[t * 3 + k]] = faceRegion[t];
function gatherInto(loop, axis, band0, region) {
  const ring = loop.verts.map(i => P(mesh, i));
  const c = ring.reduce((acc, q) => acc.add(q), new THREE.Vector3()).divideScalar(ring.length);
  const e1 = new THREE.Vector3(1, 0, 0).sub(axis.clone().multiplyScalar(axis.x)).normalize(), e2 = axis.clone().cross(e1);
  const BINS = 72, R = new Float64Array(BINS);
  const polar = q => { const d = q.clone().sub(c); const h = d.dot(axis); d.addScaledVector(axis, -h); return { h, r: d.length(), a: Math.atan2(d.dot(e2), d.dot(e1)), d }; };
  for (const q of ring) { const pp = polar(q); const b = Math.floor((pp.a + Math.PI) / (2 * Math.PI) * BINS) % BINS; R[b] = Math.max(R[b], pp.r); }
  for (let k = 0; k < BINS; k++) if (!R[k]) { // fill empty bins from the nearest filled ones
    let a = 1, b = 1; while (!R[(k - a + BINS) % BINS] && a < BINS) a++; while (!R[(k + b) % BINS] && b < BINS) b++;
    R[k] = lerp(R[(k - a + BINS) % BINS], R[(k + b) % BINS], a / (a + b));
  }
  for (let i = 0; i < NV; i++) {
    if (onBoundary[i] || vRegion[i] !== region) continue;
    const q = P(mesh, i), pp = polar(q);
    const up = -pp.h - band0; // distance above the top of the band (axis points into the band)
    if (up > 0.25 || pp.h > 0.02) continue;
    const f = (pp.a + Math.PI) / (2 * Math.PI) * BINS, k0 = Math.floor(f) % BINS, k1 = (k0 + 1) % BINS;
    const rb = lerp(R[k0], R[k1], f - Math.floor(f)) * 1.03;
    const rmax = rb + Math.max(0, up) * 0.9;
    if (pp.r > rmax) { const nq = c.clone().addScaledVector(axis, pp.h).addScaledVector(pp.d.normalize(), rmax); mesh.pos[i * 3] = nq.x; mesh.pos[i * 3 + 1] = nq.y; mesh.pos[i * 3 + 2] = nq.z; }
  }
}
gatherInto(hemLoop, new THREE.Vector3(0, -1, 0), 0.085, REGION.body);
for (const s of [1, -1]) gatherInto(cuffLoops[s], armDir(s), 0.085, s > 0 ? REGION.sleeveL : REGION.sleeveR);
for (let k = 0; k < 2; k++) { smoothPass(0.5); smoothPass(-0.53); }
// extra smoothing where bloused fabric meets the rib bands
{
  const near = new Uint8Array(NV);
  for (let i = 0; i < NV; i++) {
    if (onBoundary[i]) continue;
    const q = P(mesh, i);
    if (q.y < HEM_Y + 0.2) near[i] = 1;
    for (const s of [1, -1]) if (q.x * s > 0.9 && unit(PLANES['cuff' + s][0]).dot(q) - PLANES['cuff' + s][1] > -0.36) near[i] = 1;
  }
  for (let k = 0; k < 8; k++) {
    const np = mesh.pos.slice();
    for (let i = 0; i < NV; i++) {
      if (!near[i] || invMass[i] === 0) continue;
      let ax = 0, ay = 0, az = 0; for (const j of nbrs[i]) { ax += mesh.pos[j * 3]; ay += mesh.pos[j * 3 + 1]; az += mesh.pos[j * 3 + 2]; }
      const n = nbrs[i].length, l = k % 2 ? -0.52 : 0.5;
      np[i * 3] += l * (ax / n - mesh.pos[i * 3]); np[i * 3 + 1] += l * (ay / n - mesh.pos[i * 3 + 1]); np[i * 3 + 2] += l * (az / n - mesh.pos[i * 3 + 2]);
    }
    mesh.pos = np;
  }
}

// Seams: sink vertices where two panels meet so stitching reads as a soft groove
{
  const vRegions = Array.from({ length: NV }, () => new Set());
  for (let t = 0; t < faceRegion.length; t++) for (let k = 0; k < 3; k++) vRegions[mesh.tris[t * 3 + k]].add(faceRegion[t]);
  const nrm = vertexNormals(mesh.pos, mesh.tris);
  for (let i = 0; i < NV; i++) if (vRegions[i].size > 1 && !onBoundary[i]) for (let k = 0; k < 3; k++) mesh.pos[i * 3 + k] -= nrm[i * 3 + k] * 0.007;
}
const garmentNormals = vertexNormals(mesh.pos, mesh.tris);

const parts = []; // { name, pos, nrm, uv, idx }
function addPart(name, pos, nrm, idx, uv = null) { parts.push({ name, pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), idx: Uint32Array.from(idx), uv: uv && Float32Array.from(uv) }); }
for (const [name, r] of Object.entries(REGION)) {
  const map = new Map(), pos = [], nrm = [], idx = [];
  for (let t = 0; t < faceRegion.length; t++) {
    if (faceRegion[t] !== r) continue;
    for (let k = 0; k < 3; k++) {
      const i = mesh.tris[t * 3 + k];
      if (!map.has(i)) { map.set(i, pos.length / 3); pos.push(mesh.pos[i * 3], mesh.pos[i * 3 + 1], mesh.pos[i * 3 + 2]); nrm.push(garmentNormals[i * 3], garmentNormals[i * 3 + 1], garmentNormals[i * 3 + 2]); }
      idx.push(map.get(i));
    }
  }
  addPart(name, pos, nrm, idx);
}

// Ribbed band hanging off a boundary loop (hem or cuff)
function ribBand(name, loop, along, height) {
  const ring = loop.verts.map(i => P(mesh, i));
  const c = ring.reduce((a, q) => a.add(q), new THREE.Vector3()).divideScalar(ring.length);
  // follow the garment's winding so faces point outward
  const n = ring.length, R = 10, pos = [], uv = [], idx = [];
  const profile = k => { const t = k / R; return { s: 1.035 + 0.01 * Math.sin(t * Math.PI) - (t > 0.86 ? (t - 0.86) * 0.45 : 0), d: -0.085 + (height + 0.085) * t }; };
  for (let k = 0; k <= R; k++) {
    const { s, d } = profile(k);
    for (let i = 0; i <= n; i++) {
      const q = ring[i % n];
      const pnt = q.clone().sub(c).multiplyScalar(s).add(c).addScaledVector(along, d);
      pos.push(pnt.x, pnt.y, pnt.z); uv.push(i / n, k / R);
    }
  }
  for (let k = 0; k < R; k++) for (let i = 0; i < n; i++) {
    const a = k * (n + 1) + i, b = a + 1, cc = a + n + 1, dd = cc + 1;
    idx.push(a, cc, b, b, cc, dd);
  }
  // orient outward
  let nrm = vertexNormals(pos, idx);
  const probe = new THREE.Vector3(pos[0], pos[1], pos[2]).sub(c);
  if (probe.dot(new THREE.Vector3(nrm[0], nrm[1], nrm[2])) < 0) { for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]]; nrm = vertexNormals(pos, idx); }
  addPart(name, pos, nrm, idx, uv);
}
ribBand('hem', hemLoop, new THREE.Vector3(0, -1, 0), 0.17);
ribBand('cuffL', cuffLoops[1], armDir(1), 0.15);
ribBand('cuffR', cuffLoops[-1], armDir(-1), 0.15);

function tubePart(name, curve, segs, radius, radial, closed) {
  const g = new THREE.TubeGeometry(curve, segs, radius, radial, closed);
  addPart(name, g.attributes.position.array, g.attributes.normal.array, g.index.array, g.attributes.uv.array);
}
// Hood rim: a rolled edge around the face opening
const rimPts = faceLoop.verts.map(i => P(mesh, i));
for (let it = 0; it < 4; it++) { const c = rimPts.map(q => q.clone()); for (let i = 0; i < c.length; i++) rimPts[i] = c[(i + c.length - 1) % c.length].clone().add(c[(i + 1) % c.length]).multiplyScalar(0.25).addScaledVector(c[i], 0.5); }
tubePart('hoodRim', new THREE.CatmullRomCurve3(rimPts, true), 240, 0.034, 12, true);

// Raycasting against the finished garment
const garmentGeo = new THREE.BufferGeometry();
garmentGeo.setAttribute('position', new THREE.Float32BufferAttribute(mesh.pos, 3));
garmentGeo.setIndex(mesh.tris);
const garmentBVH = new MeshBVH(garmentGeo);
const ray = new THREE.Ray();
function frontHit(x0, y0) {
  ray.origin.set(x0, y0, 3); ray.direction.set(0, 0, -1);
  return garmentBVH.raycastFirst(ray, THREE.DoubleSide);
}
const hitNormal = h => { const a = h.face.a, b = h.face.b, c = h.face.c; return new THREE.Vector3(garmentNormals[a * 3] + garmentNormals[b * 3] + garmentNormals[c * 3], garmentNormals[a * 3 + 1] + garmentNormals[b * 3 + 1] + garmentNormals[c * 3 + 1], garmentNormals[a * 3 + 2] + garmentNormals[b * 3 + 2] + garmentNormals[c * 3 + 2]).normalize(); };

// Drawstrings from the bottom of the hood opening
{
  const minY = Math.min(...rimPts.map(q => q.y));
  for (const [sx, name] of [[1, 'L'], [-1, 'R']]) {
    const cand = rimPts.filter(q => q.y < minY + 0.2 && q.z > 0);
    const start = cand.sort((a, b) => Math.abs(a.x - sx * 0.08) - Math.abs(b.x - sx * 0.08))[0].clone();
    const pts = [start.clone().add(new THREE.Vector3(0, 0, 0.03))];
    const len = 0.8, steps = 8;
    for (let k = 1; k <= steps; k++) {
      const y = start.y - 0.05 - (len - 0.05) * k / steps, xx = start.x + sx * 0.02 * k / steps;
      const h = frontHit(xx, y);
      pts.push(new THREE.Vector3(xx, y, (h ? h.point.z : start.z) + 0.024));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    tubePart('string' + name, curve, 64, 0.0115, 8, false);
    const end = curve.getPointAt(1), tan = curve.getTangentAt(1);
    const ag = new THREE.CylinderGeometry(0.0165, 0.015, 0.08, 14);
    ag.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), tan));
    ag.translate(end.x + tan.x * 0.035, end.y + tan.y * 0.035, end.z + tan.z * 0.035);
    addPart('aglet' + name, ag.attributes.position.array, ag.attributes.normal.array, ag.index.array);
  }
}

// Kangaroo pocket: a puffed patch laid onto the front
{
  const Y0 = -0.95, Y1 = -0.4, NS = 44, NT = 26, pos = [], idx = [];
  const half = t => 0.3 + 0.18 * Math.cos(t * Math.PI / 2) ** 1.2;
  for (let j = 0; j <= NT; j++) for (let i = 0; i <= NS; i++) {
    const t = j / NT, s = i / NS, y = lerp(Y0, Y1, t), xx = (2 * s - 1) * half(t);
    const h = frontHit(xx, y);
    const edge = Math.min(s, 1 - s, t, 1 - t);
    const q = h.point.clone().addScaledVector(hitNormal(h), 0.004 + 0.016 * Math.sin(Math.min(1, edge / 0.12) * Math.PI / 2));
    pos.push(q.x, q.y, q.z);
  }
  for (let j = 0; j < NT; j++) for (let i = 0; i < NS; i++) {
    const a = j * (NS + 1) + i, b = a + 1, c = a + NS + 1, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  let nrm = vertexNormals(pos, idx);
  if (nrm[(Math.floor(NT / 2) * (NS + 1) + NS / 2) * 3 + 2] < 0) { for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]]; nrm = vertexNormals(pos, idx); }
  addPart('pocket', pos, nrm, idx);
}
log('parts', parts.map(p => `${p.name}:${p.pos.length / 3}`).join(' '));

/* ------------------------------------------------------------------ */
/* 4. Ambient occlusion bake (vertex colours)                          */
/* ------------------------------------------------------------------ */
{
  const all = new THREE.BufferGeometry(); const P3 = [], I = []; let base = 0;
  for (const pt of parts) { P3.push(...pt.pos); for (const i of pt.idx) I.push(i + base); base += pt.pos.length / 3; }
  all.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); all.setIndex(I);
  const bvh = new MeshBVH(all);
  const K = 48, MAXD = 0.55;
  const dirs = []; // cosine-weighted hemisphere around +z, rotated per vertex
  for (let k = 0; k < K; k++) { const u = (k + 0.5) / K, phi = k * 2.399963; const r = Math.sqrt(u); dirs.push(new THREE.Vector3(r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - u))); }
  const q = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), n = new THREE.Vector3(), d = new THREE.Vector3();
  for (const pt of parts) {
    const col = new Float32Array(pt.pos.length);
    for (let i = 0; i < pt.pos.length / 3; i++) {
      n.fromArray(pt.nrm, i * 3); q.setFromUnitVectors(Z, n);
      ray.origin.fromArray(pt.pos, i * 3).addScaledVector(n, 0.006);
      let occ = 0;
      for (const dir of dirs) {
        ray.direction.copy(d.copy(dir).applyQuaternion(q));
        const h = bvh.raycastFirst(ray, THREE.DoubleSide, 0, MAXD);
        if (h && h.distance < MAXD) occ += 1 - h.distance / MAXD * 0.6;
      }
      const ao = clamp(1 - occ / K * 1.15, 0.12, 1);
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao;
    }
    pt.col = col;
  }
  log('ao baked');
}

/* ------------------------------------------------------------------ */
/* 5. Export                                                           */
/* ------------------------------------------------------------------ */
const v3 = a => new THREE.Vector3(...a);
function sleeveFrame(s) {
  const S0 = v3(SHOULDER(s)), W0 = v3(WRIST(s)), a = W0.clone().sub(S0).normalize();
  const n0 = new THREE.Vector3(s, 0, 0), n = n0.sub(a.clone().multiplyScalar(n0.dot(a))).normalize();
  const vAxis = n.clone().cross(a);
  return { origin: S0.lerp(W0, 0.5).toArray(), dir: n.toArray(), u: a.toArray(), v: vAxis.toArray(), w: 1.15, h: 0.46, targets: [s > 0 ? 'sleeveL' : 'sleeveR'] };
}
const placements = {
  front: { origin: [0, 0.1, 0], dir: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], w: 1.05, h: 1.05, targets: ['body', 'pocket'] },
  back: { origin: [0, 0.08, 0], dir: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], w: 1.2, h: 1.25, targets: ['body'] },
  left: sleeveFrame(1), right: sleeveFrame(-1),
};
const doc = new Document(); const buf = doc.createBuffer();
const scene = doc.createScene('hoodie').setExtras({ placements, generator: 'hoodie-studio/tools/build-hoodie.mjs' });
for (const pt of parts) {
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pt.pos).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(pt.nrm).setBuffer(buf))
    .setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(pt.col).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(pt.idx).setBuffer(buf));
  if (pt.uv) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(pt.uv).setBuffer(buf));
  scene.addChild(doc.createNode(pt.name).setMesh(doc.createMesh(pt.name).addPrimitive(prim)));
}
const glb = await new NodeIO().writeBinary(doc);
writeFileSync(OUT, glb);
log('wrote', OUT, (glb.byteLength / 1e6).toFixed(2), 'MB');
