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
import { MeshoptEncoder } from 'meshoptimizer';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [, , input, output = fileURLToPath(new URL('../hoodie.glb', import.meta.url)), presetName = 'hoodie'] = process.argv;
if (!input) { console.error('usage: node prepare-model.mjs <input.glb> [output.glb] [hoodie|crewneck|tee]'); process.exit(1); }
const FAST = !!process.env.FAST; // skip the AO bake while tuning placements
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

/* 1. Read and merge every primitive into one world-space geometry */
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const src = await io.read(input);
const credit = src.getRoot().getAsset().extras || {};
const pos = [], nrm = [], idx = [];
const m4 = new THREE.Matrix4(), n3 = new THREE.Matrix3(), v = new THREE.Vector3();
for (const node of src.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  m4.fromArray(node.getWorldMatrix()); n3.getNormalMatrix(m4);
  for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), I = prim.getIndices();
    const base = pos.length / 3, el = [];
    for (let i = 0; i < P.getCount(); i++) {
      v.fromArray(P.getElement(i, el)).applyMatrix4(m4); pos.push(v.x, v.y, v.z);
      v.fromArray(N.getElement(i, el)).applyMatrix3(n3).normalize(); nrm.push(v.x, v.y, v.z);
    }
    for (let i = 0; i < I.getCount(); i++) idx.push(base + I.getScalar(i));
  }
}
log('merged', pos.length / 3, 'verts', idx.length / 3, 'tris');

/* 2a. Square the garment up: its widest horizontal direction (the shoulder line) becomes x */
{
  let mx = 0, mz = 0; const n = pos.length / 3;
  for (let i = 0; i < pos.length; i += 3) { mx += pos[i]; mz += pos[i + 2]; }
  mx /= n; mz /= n;
  let sxx = 0, szz = 0, sxz = 0;
  for (let i = 0; i < pos.length; i += 3) { const x = pos[i] - mx, z = pos[i + 2] - mz; sxx += x * x; szz += z * z; sxz += x * z; }
  const yaw = 0.5 * Math.atan2(2 * sxz, sxx - szz); // angle of the principal axis from +x
  if (Math.abs(yaw) > 0.02) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const arr of [pos, nrm]) for (let i = 0; i < arr.length; i += 3) { const x = arr[i], z = arr[i + 2]; arr[i] = c * x + s * z; arr[i + 2] = -s * x + c * z; }
    log('squared up by', (yaw * 180 / Math.PI).toFixed(1), 'degrees');
  }
}
/* 2. Fit into the studio's space: ~3 units tall, centred, hem near y = -1.35 */
const box = new THREE.Box3().setFromArray(pos);
const size = box.getSize(new THREE.Vector3());
const S = 3.0 / size.y, cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
for (let i = 0; i < pos.length; i += 3) {
  pos[i] = (pos[i] - cx) * S; pos[i + 1] = (pos[i + 1] - box.min.y) * S - 1.35; pos[i + 2] = (pos[i + 2] - cz) * S;
}
const fitted = new THREE.Box3().setFromArray(pos);
log('fitted', fitted.min.toArray().map(x => +x.toFixed(2)), fitted.max.toArray().map(x => +x.toFixed(2)));

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
geo.setIndex(idx);
const bvh = new MeshBVH(geo);
const ray = new THREE.Ray();

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
// Print areas per garment, in studio space (the garment spans y = -1.35 … 1.65).
// Sleeve prints run down the arm: `sleeve` gives the centre height, the arm's lean (dx per unit drop) and size.
const PRESETS = {
  hoodie: { front: [0.15, 1.05, 1.05], back: [0.2, 1.2, 1.3], sleeve: { x: 0.4, y: 0.25, lean: 0.18, w: 1.0, h: 0.42 } },
  crewneck: { front: [0.55, 1.0, 1.0], back: [0.5, 1.1, 1.3], sleeve: { x: 0.43, y: 0.2, lean: 0.12, w: 1.1, h: 0.4 } },
  tee: { front: [0.55, 1.0, 1.0], back: [0.55, 1.1, 1.3], sleeve: { x: 0.43, y: 1.0, lean: 0.9, w: 0.42, h: 0.34 } },
};
const PR = PRESETS[presetName];
if (!PR) throw new Error('unknown preset ' + presetName);
const placements = {
  front: { origin: [0, PR.front[0], 0], dir: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], w: PR.front[1], h: PR.front[2] },
  back: { origin: [0, PR.back[0], 0], dir: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], w: PR.back[1], h: PR.back[2] },
};
for (const [key, s] of [['left', 1], ['right', -1]]) {
  const S2 = PR.sleeve;
  const along = new THREE.Vector3(S2.lean * s, -1, 0).normalize(), dir = new THREE.Vector3(1 * s, S2.lean, 0).normalize();
  const vAxis = dir.clone().cross(along);
  placements[key] = { origin: [W * S2.x * s, S2.y, 0], dir: dir.toArray(), u: along.toArray(), v: vAxis.toArray(), w: S2.w, h: S2.h };
}
const decals = {};
{
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ce = new THREE.Vector3(), fn = new THREE.Vector3(), p = new THREE.Vector3();
  for (const [key, F] of Object.entries(placements)) {
    const o = new THREE.Vector3(...F.origin), n = new THREE.Vector3(...F.dir), u = new THREE.Vector3(...F.u), vv = new THREE.Vector3(...F.v);
    const out = { pos: [], nrm: [], col: [], uv: [] };
    for (let t = 0; t < idx.length; t += 3) {
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
const scene = doc.createScene('garment').setExtras({ placements, credit, generator: 'hoodie-studio/tools/prepare-model.mjs' });
const body = doc.createPrimitive()
  .setAttribute('POSITION', acc('VEC3', Float32Array.from(pos)))
  .setAttribute('NORMAL', acc('VEC3', Float32Array.from(nrm)))
  .setAttribute('COLOR_0', acc('VEC3', col))
  .setIndices(acc('SCALAR', Uint32Array.from(idx)));
scene.addChild(doc.createNode('body').setMesh(doc.createMesh('body').addPrimitive(body)));
for (const [key, d] of Object.entries(decals)) {
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
