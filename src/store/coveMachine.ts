/** Medal Cove's machine (the plain prototype in components/CoveMachine): every medal is a coin in a Rapier
 * physics world, and nothing is paid out that the physics didn't do.
 *
 * - The shelf (the pusher) slides forward and back under a fixed scraper. Medals you drop land on it or in
 *   front of it; on the way back the scraper wipes what's on the shelf off its front edge onto the pile.
 * - A small hole rides on the shelf. A medal that drops into it goes to the tower: a feeder above the
 *   tower's guide drops one medal per layer onto it, so you see the tower grow and settle.
 * - When the tower is full, the guide's rods sink, the pedestal lowers it onto the field, and from then on
 *   it's just medals: the pile pushes it toward the edge, it leans and falls.
 * - Medals off the front land in the tray (yours); off the sides near the front are lost.
 *
 * Units: a medal is 0.62 across and 0.11 thick; the deck's top is y = 0 and the front edge is z = FRONT.
 * The physics runs at a fixed 60 steps a second; `save()`/`restore` keep the machine on this device. */
import type RAPIER_NS from '@dimforge/rapier3d-compat'

type Rapier = typeof RAPIER_NS
export const R = 0.31, HALF = 0.055
export const M = {
  W: 3.0,               // the field's half width (walls at ±(W+0.1))
  FRONT: 2.6,           // the front edge
  BACK: -5.6,           // the back wall
  SIDE_OPEN: 1.0,       // the side walls stop this far before the front: the side drops
  FACE_MIN: -2.2, FACE_MAX: -0.9, PERIOD: 200, // the shelf's front face, retracted to extended, and its cycle (frames)
  SHELF_TOP: 0.5, SHELF_DEPTH: 3.2,
  SCRAPER_Z: -3.7,
  DROP_Z: -2.9, DROP_Y: 2.4,
  HOLE_OFF: 1.35,       // the hole's distance behind the shelf's face
  HOLE_R: 0.4,
  TZ: 0.35, PED_R: 0.36, PED_UP: 0.6, ROD_R: 0.03, ROD_AT: 0.37, ROD_LEN: 2.5,
  TOWER_FULL: 16,       // medals in a full tower (two per layer)
  FEED_GAP: 16,         // frames between medals the feeder drops
  MAX: 240,             // medal bodies at once
  HAND: 60,             // medals to play with in a session
}
export const STEP = 1 / 60

export type Stage = 'build' | 'release' | 'lower' | 'free' | 'raise'
export type Contact = { kind: 'metal' | 'coin' | 'tray'; force: number; x: number; z: number }
export type Saved = { v: 1; hand: number; won: number; lost: number; towers: number; tower: number; feed: number; stage: Stage; t: number; frame: number; coins: number[][] }
export type Events = { won: number; lost: number; caught: number; fed: boolean; stageChanged: Stage | null; contacts: Contact[] }

/** The shelf's front face at frame `f`: eases forward and back. */
export const faceAt = (f: number) => M.FACE_MIN + (M.FACE_MAX - M.FACE_MIN) * (0.5 - 0.5 * Math.cos(f / M.PERIOD * Math.PI * 2))

export function createMachine(RAPIER: Rapier, saved: Saved | null = null, random = Math.random) {
  const world = new RAPIER.World({ x: 0, y: -22, z: 0 })
  world.timestep = STEP
  world.integrationParameters.numSolverIterations = 8
  const kinds = new Map<number, Contact['kind']>()
  const queue = new RAPIER.EventQueue(true)
  const fixed = (hx: number, hy: number, hz: number, x: number, y: number, z: number, kind: Contact['kind'] = 'metal', friction = 0.4) => {
    const c = world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(friction)); kinds.set(c.handle, kind); return c
  }
  const { W, FRONT, BACK } = M
  fixed(W + 0.1, 0.2, (FRONT - BACK) / 2, 0, -0.2, (FRONT + BACK) / 2)              // the deck
  const wallLen = (FRONT - M.SIDE_OPEN - BACK) / 2, wallZ = (FRONT - M.SIDE_OPEN + BACK) / 2
  fixed(0.1, 1.2, wallLen, -W - 0.1, 1.0, wallZ); fixed(0.1, 1.2, wallLen, W + 0.1, 1.0, wallZ) // side walls
  fixed(W + 0.1, 1.5, 0.15, 0, 1.3, BACK - 0.15)                                          // back wall
  fixed(W, 0.5, 0.1, 0, M.SHELF_TOP + 0.06 + 0.5, M.SCRAPER_Z)                            // the scraper
  fixed(W + 0.2, 0.15, 1.1, 0, -1.85, FRONT + 1.4, 'tray', 0.9)                          // the tray, and its sides
  fixed(0.1, 0.5, 1.1, -W - 0.3, -1.4, FRONT + 1.4, 'tray'); fixed(0.1, 0.5, 1.1, W + 0.3, -1.4, FRONT + 1.4, 'tray'); fixed(W + 0.4, 0.5, 0.1, 0, -1.4, FRONT + 2.6, 'tray')
  // The shelf: a kinematic block whose top is the shelf.
  const hy = M.SHELF_TOP / 2, hz = M.SHELF_DEPTH / 2
  const shelf = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, hy, faceAt(0) - hz))
  kinds.set(world.createCollider(RAPIER.ColliderDesc.cuboid(W - 0.02, hy, hz).setFriction(0.3), shelf).handle, 'metal')
  // The tower's pedestal and the guide's four rods, both kinematic so they can rise and sink through the deck.
  const pedestal = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, M.PED_UP - 0.3, M.TZ))
  kinds.set(world.createCollider(RAPIER.ColliderDesc.cylinder(0.3, M.PED_R).setFriction(0.6), pedestal).handle, 'metal')
  const rods = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, M.PED_UP + M.ROD_LEN / 2, M.TZ))
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; kinds.set(world.createCollider(RAPIER.ColliderDesc.cylinder(M.ROD_LEN / 2, M.ROD_R).setTranslation(Math.cos(a) * M.ROD_AT, 0, Math.sin(a) * M.ROD_AT).setFriction(0), rods).handle, 'metal') }

  type Piece = { body: RAPIER_NS.RigidBody; counted: number }
  const pieces = new Map<number, Piece>()
  const flat = (yaw: number) => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
  const addCoin = (x: number, y: number, z: number, rot = flat(random() * 6), vel = { x: 0, y: 0, z: 0 }) => {
    if (pieces.size >= M.MAX) { const old = [...pieces.entries()].find(([, p]) => p.counted) ?? [...pieces.entries()][0]; if (old) { world.removeRigidBody(old[1].body); pieces.delete(old[0]) } }
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(rot).setLinvel(vel.x, vel.y, vel.z).setLinearDamping(0.1).setAngularDamping(0.3).setCcdEnabled(false))
    const col = world.createCollider(RAPIER.ColliderDesc.cylinder(HALF, R).setDensity(1.4).setFriction(0.45).setRestitution(0.05)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(30), body)
    kinds.set(col.handle, 'coin'); pieces.set(body.handle, { body, counted: 0 }); return body
  }

  // ---- The state that's saved ----
  const s = { hand: M.HAND, won: 0, lost: 0, towers: 0, tower: 0, feed: 0, stage: 'build' as Stage, t: 0, frame: 0, feedAt: 0 }
  if (saved && saved.v === 1) {
    Object.assign(s, { hand: saved.hand, won: saved.won, lost: saved.lost, towers: saved.towers, tower: saved.tower, feed: saved.feed, stage: saved.stage, t: saved.t, frame: saved.frame })
    for (const c of saved.coins) addCoin(c[0], c[1], c[2], { x: c[3], y: c[4], z: c[5], w: c[6] })
  } else {
    // A modest pile to start: a full layer out to the edge, most of a second on it and a few on the shelf,
    // settled before you play.
    for (let layer = 0; layer < 3; layer++) for (let z = M.FACE_MAX + 0.36; z < FRONT - 0.1; z += R * 1.75) for (let x = -W + 0.33; x <= W - 0.33; x += R * 1.9) {
      if (Math.hypot(x, z - M.TZ) < M.PED_R + R + 0.04) continue
      if (layer === 0 || random() < (layer === 1 ? 0.7 : 0.25)) addCoin(x + (random() - .5) * 0.08 + (layer % 2) * R * 0.9, HALF + 0.01 + layer * (HALF * 2 + 0.03), z + (random() - .5) * 0.08 + (layer % 2) * R * 0.8)
    }
    for (let i = 0; i < 14; i++) addCoin((random() - .5) * 2 * (W - 0.4), M.SHELF_TOP + HALF + 0.02 + (i % 2) * 0.12, M.SCRAPER_Z + 0.4 + random() * 1.0)
  }
  // Where the pedestal and rods sit for the stage (t counts frames into it).
  const PED_FRAMES = 90, ROD_FRAMES = 60
  const poses = () => {
    const k = (n: number) => Math.min(1, s.t / n), ease = (x: number) => x * x * (3 - 2 * x)
    let ped = 1, rod = 1 // 1 = up / extended
    if (s.stage === 'release') { rod = 1 - ease(k(ROD_FRAMES)) }
    else if (s.stage === 'lower') { rod = 0; ped = 1 - ease(k(PED_FRAMES)) }
    else if (s.stage === 'free') { rod = 0; ped = 0 }
    else if (s.stage === 'raise') { const a = ease(k(PED_FRAMES)); ped = a; rod = s.t > PED_FRAMES ? ease(Math.min(1, (s.t - PED_FRAMES) / ROD_FRAMES)) : 0 }
    const pedTop = ped * M.PED_UP, rodTop = pedTop + rod * M.ROD_LEN
    return { pedTop, rodTop }
  }
  const placeKinematic = (next: boolean) => {
    const face = faceAt(s.frame), { pedTop, rodTop } = poses()
    const sh = { x: 0, y: hy, z: face - hz }, pe = { x: 0, y: pedTop - 0.3, z: M.TZ }, ro = { x: 0, y: rodTop - M.ROD_LEN / 2 - 0.02, z: M.TZ }
    if (next) { shelf.setNextKinematicTranslation(sh); pedestal.setNextKinematicTranslation(pe); rods.setNextKinematicTranslation(ro) }
    else { shelf.setTranslation(sh, true); pedestal.setTranslation(pe, true); rods.setTranslation(ro, true) }
  }
  placeKinematic(false)
  if (!saved) {
    for (let i = 0; i < 120; i++) world.step()
    for (const [h, p] of pieces) if (p.body.translation().y < -0.2) { world.removeRigidBody(p.body); pieces.delete(h) } // what fell while settling isn't anyone's
  }

  const towerCoins = () => { let n = 0; for (const p of pieces.values()) { const t = p.body.translation(); if (!p.counted && Math.hypot(t.x, t.z - M.TZ) < M.PED_R + 0.12 && t.y > 0.3) n++ } return n }

  /** One step (1/60 s). `drop` is where to drop a medal this step (x), if anywhere. */
  function step(dropX: number | null = null): Events {
    const ev: Events = { won: 0, lost: 0, caught: 0, fed: false, stageChanged: null, contacts: [] }
    s.frame++; s.t++
    if (dropX !== null && s.hand > 0) {
      s.hand--
      const x = Math.max(-W + 0.35, Math.min(W - 0.35, dropX))
      addCoin(x, M.DROP_Y, M.DROP_Z, { x: Math.sin(0.6) * 0.3, y: 0, z: 0, w: Math.cos(0.3) }, { x: 0, y: -1, z: 0 })
    }
    // The tower: the feeder drops one medal at a time onto it while it's building.
    const change = (to: Stage) => { s.stage = to; s.t = 0; ev.stageChanged = to }
    if (s.stage === 'build') {
      if (s.feed > 0 && s.tower < M.TOWER_FULL && s.frame - s.feedAt >= M.FEED_GAP) {
        s.feed--; s.tower++; s.feedAt = s.frame; ev.fed = true
        addCoin((random() - .5) * 0.02, M.PED_UP + Math.min(2.6, s.tower * HALF * 2 + 0.6), M.TZ, flat(random() * 6), { x: 0, y: -2, z: 0 })
      }
      if (s.tower >= M.TOWER_FULL && s.frame - s.feedAt > 70) change('release')
    } else if (s.stage === 'release') { if (s.t >= ROD_FRAMES + 40) change('lower') }
    else if (s.stage === 'lower') { if (s.t >= PED_FRAMES) { change('free'); s.towers++ } }
    else if (s.stage === 'free') {
      // A new tower starts once the old one's gone from the spot.
      if (s.t > 240 && towerCoins() === 0) { s.tower = 0; change('raise') }
    } else if (s.stage === 'raise') { if (s.t >= PED_FRAMES + ROD_FRAMES) change('build') }
    placeKinematic(true)
    world.step(queue)
    queue.drainContactForceEvents(e => {
      const a = kinds.get(e.collider1()), b = kinds.get(e.collider2()); if (!a || !b) return
      const kind: Contact['kind'] = a === 'tray' || b === 'tray' ? 'tray' : a === 'coin' && b === 'coin' ? 'coin' : 'metal'
      const body = world.getCollider(a === 'coin' ? e.collider1() : e.collider2())?.parent()?.translation()
      if (body && ev.contacts.length < 24) ev.contacts.push({ kind, force: e.totalForceMagnitude(), x: body.x, z: body.z })
    })
    // The hole on the shelf: a medal over it falls in and goes to the tower.
    const face = faceAt(s.frame), hx = 0, hz2 = face - M.HOLE_OFF
    for (const [h, p] of pieces) {
      const t = p.body.translation()
      if (!p.counted && t.y > M.SHELF_TOP && t.y < M.SHELF_TOP + 0.16 && Math.hypot(t.x - hx, t.z - hz2) < M.HOLE_R - 0.12 && t.z < face) {
        world.removeRigidBody(p.body); pieces.delete(h); ev.caught++
        if (s.tower + s.feed < M.TOWER_FULL && s.stage === 'build') s.feed += 2
        else s.hand++ // the tower's full or on its way: the hole gives the medal back
        continue
      }
      if (!p.counted && t.y < -0.35) {
        p.counted = s.frame
        if (t.z > FRONT - 0.1 && Math.abs(t.x) < W + 0.3) { ev.won++; s.won++; s.hand++ } else { ev.lost++; s.lost++ }
      }
      if (p.counted && (s.frame - p.counted > 150 || t.y < -4)) { world.removeRigidBody(p.body); pieces.delete(h) }
    }
    return ev
  }

  /** Everything needed to come back to this machine (the medals still in play, not the ones counted). */
  function save(): Saved {
    const coins: number[][] = []
    for (const p of pieces.values()) { if (p.counted) continue; const t = p.body.translation(), r = p.body.rotation(); coins.push([t.x, t.y, t.z, r.x, r.y, r.z, r.w].map(v => Math.round(v * 1000) / 1000)) }
    return { v: 1, hand: s.hand, won: s.won, lost: s.lost, towers: s.towers, tower: s.tower, feed: s.feed, stage: s.stage, t: s.t, frame: s.frame, coins }
  }
  /** Nothing moving that could still pay out (to end a session once the hand is empty). */
  const quiet = () => s.feed === 0 && (s.stage === 'build' || s.stage === 'free') && [...pieces.values()].every(p => { const v = p.body.linvel(); return p.counted || Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z) < 0.05 })
  return {
    world, state: s, pieces, step, save, quiet, poses, towerCoins,
    hole: () => ({ x: 0, z: faceAt(s.frame) - M.HOLE_OFF }),
    face: () => faceAt(s.frame),
    free: () => { queue.free(); world.free() },
  }
}
export type Machine = ReturnType<typeof createMachine>

/** The save, if there's a good one, from text. */
export function readSaved(text: string | null): Saved | null {
  if (!text) return null
  try {
    const v = JSON.parse(text) as Saved
    if (v?.v !== 1 || !Array.isArray(v.coins) || !Number.isFinite(v.hand)) return null
    if (!v.coins.every(c => Array.isArray(c) && c.length === 7 && c.every(Number.isFinite))) return null
    return v
  } catch { return null }
}

/** The machine kept on this device (localStorage only, never synced). */
export const MACHINE_KEY = 'kono-cove-machine:v1'
export function readMachine() { try { return readSaved(localStorage.getItem(MACHINE_KEY)) } catch { return null } }
export function clearMachine() { try { localStorage.removeItem(MACHINE_KEY) } catch { /* storage unavailable */ } }
