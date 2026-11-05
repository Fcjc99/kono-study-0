// Pure delivery contracts and genuine Rapier trajectories, without a browser/GPU.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const assert = require('node:assert/strict'), ts = require('typescript')
const root = path.resolve(__dirname, '..')
function load(relative) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, { module, exports: module.exports, Math, Number, Array, Infinity })
  return module.exports
}
const D = load('src/store/dispense.ts'), M = load('src/store/motion.ts').FIELD_MOTION
let passed = 0
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name) }

;(async () => {
  await test('gates preserve every award, release one at a time, and never burst after a pause', () => {
    let gate = D.enqueueDispense(D.createDispenser(9), 20), count = 0, last = -Infinity
    for (let frame = 0; frame < 600; frame++) {
      const room = frame >= 35 && frame < 160 ? 0 : 1
      const result = D.releaseDispense(gate, frame, room)
      if (result.released) { assert.ok(frame - last >= 9); last = frame; count++ }
      gate = result.state
      assert.equal(gate.queued + count, 20, 'no lost or duplicated medals')
      const twice = D.releaseDispense(gate, frame, room)
      assert.equal(twice.released, 0, 'same-frame calls cannot double dispense')
    }
    assert.equal(count, 20); assert.equal(gate.queued, 0)
    gate = D.enqueueDispense(gate, 40)
    const wake = D.releaseDispense(gate, 50000, 100)
    assert.equal(wake.released, 1); assert.equal(wake.state.queued, 39)
    assert.equal(D.releaseDispense(wake.state, 50000, 100).released, 0)
  })
  await test('independent channels retain their own cadence and blocked quantities', () => {
    const left = D.enqueueDispense(D.createDispenser(8), 4)
    const right = D.enqueueDispense(D.createDispenser(13), 3)
    const l = D.releaseDispense(left, 0, 0), r = D.releaseDispense(right, 0, 1)
    assert.equal(l.state.queued, 4); assert.equal(l.released, 0)
    assert.equal(r.state.queued, 2); assert.equal(r.released, 1)
    assert.equal(D.releaseDispense(r.state, 12, 1).released, 0)
    assert.equal(D.releaseDispense(r.state, 13, 1).released, 1)
  })
  await test('physical-time cadence remains coherent during slow motion', () => {
    let gate = D.enqueueDispense(D.createDispenser(9), 4), physicalFrame = 0
    const times = []
    for (let frame = 0; frame < 150; frame++) {
      physicalFrame += .32
      const result = D.releaseDispense(gate, physicalFrame, 1)
      gate = result.state
      if (result.released) times.push(physicalFrame)
    }
    assert.equal(times.length, 4)
    for (let n = 1; n < times.length; n++) assert.ok(times[n] - times[n - 1] >= 9)
    assert.equal(gate.queued, 0)
  })
  await test('only catch arrival awards medals; an airborne edge crossing is not a win', () => {
    for (const y of [0.2, -0.41, -1, -1.8]) assert.equal(D.capturePiece({ x: 0, y, z: 2.5 }, false), null)
    assert.equal(D.capturePiece({ x: 0, y: -1.94, z: 3.2 }, false), 'medal')
    assert.equal(D.capturePiece({ x: 0, y: -1.94, z: 7.2 }, false), null, 'the former long-cabinet tray coordinates no longer award medals')
    assert.equal(D.capturePiece({ x: 0, y: -1.56, z: 3.2 }, true), 'ball')
    assert.equal(D.capturePiece({ x: 0, y: -1.2, z: 3.2 }, true), null)
    assert.equal(D.capturePiece({ x: 5.5, y: -2.4, z: 2.8 }, false), 'lost')
    assert.equal(D.capturePiece({ x: 5.5, y: -2.4, z: 2.8 }, true), 'ball', 'original ball side return rule')
    assert.equal(D.capturePiece({ x: 0, y: -4, z: -5 }, false), 'lost')
    assert.equal(D.capturePiece({ x: NaN, y: -2, z: 3 }, false), null)
  })
  await test('tower growth preserves the full bank beyond the old 100-medal visual limit', () => {
    for (const bank of [0, 1, 20, 100, 105, 237, 1005]) {
      const slots = D.towerSlots(bank)
      assert.equal(slots.reduce((sum, s) => sum + s.medals, 0), bank)
      assert.equal(slots.length, Math.ceil(bank / 5))
      assert.ok(slots.every(s => s.medals > 0 && s.medals <= 5 && s.y <= 19 * .17))
      assert.equal(new Set(slots.map(s => `${s.x}/${s.y}/${s.z}`)).size, slots.length)
    }
    const old = D.towerSlots(100), grown = D.towerSlots(105)
    assert.equal(JSON.stringify(grown.slice(0, 20)), JSON.stringify(old), 'existing columns do not jump')
    assert.notEqual(grown[20].x, grown[0].x)
  })

  const R = require('@dimforge/rapier3d-compat')
  await R.init()
  // Match the actual side slide, its two raised rails, and the outer stop.
  function makeRamp(s) {
    const world = new R.World(M.gravity)
    world.integrationParameters.numSolverIterations = M.solverIterations
    world.timestep = M.timestep
    const dx = 6.6 - 5.12, dy = 2.6 - 1.58, len = Math.hypot(dx, dy), angle = Math.atan2(dy, dx)
    const rot = { x: 0, y: 0, z: Math.sin(s * angle / 2), w: Math.cos(s * angle / 2) }
    const normal = { x: -s * Math.sin(angle), y: Math.cos(angle), z: 0 }
    const mid = { x: s * (6.6 + 5.12) / 2, y: (2.6 + 1.58) / 2, z: -5.25 }
    const fixed = []
    function part(hx, hy, hz, n, z, friction) {
      fixed.push(world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(mid.x + normal.x * n, mid.y + normal.y * n, mid.z + z)
        .setRotation(rot).setFriction(friction).setFrictionCombineRule(R.CoefficientCombineRule.Min).setRestitution(.05)))
    }
    part(len / 2, .04, .52, -.04, 0, .08)
    part(len / 2, .16, .03, .12, -.49, .02)
    part(len / 2, .16, .03, .12, .49, .02)
    fixed.push(world.createCollider(R.ColliderDesc.cuboid(.04, .3, .52)
      .setTranslation(s * 6.65, 2.85, -5.25)))
    return { world, fixed, rot, dir: { x: -s * dx / len, y: -dy / len, z: 0 },
      at: x => 1.58 + (Math.abs(x) - 5.12) / dx * dy }
  }
  function rampPiece(ramp, p, ball) {
    const cfg = ball ? D.BALL_MOTION : D.COIN_MOTION
    const body = ramp.world.createRigidBody(R.RigidBodyDesc.dynamic()
      .setTranslation(p.x, p.y, p.z).setRotation(ramp.rot)
      .setLinearDamping(cfg.linearDamping).setAngularDamping(cfg.angularDamping).setCcdEnabled(true))
    const collider = ramp.world.createCollider((ball ? R.ColliderDesc.ball(.44) : R.ColliderDesc.cylinder(.055, .31))
      .setDensity(ball ? .6 : 1.4).setFriction(cfg.friction).setRestitution(cfg.restitution), body)
    body.setLinvel({ x: ramp.dir.x * 2.1, y: ramp.dir.y * 2.1, z: 0 }, true)
    return { body, collider }
  }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) }
  await test('real Rapier slides: 24 non-overlapping, gate-spaced medals exit cleanly on each side', () => {
    for (const s of [-1, 1]) {
      const ramp = makeRamp(s), live = [], p = { x: s * (6.6 - .28), y: 0, z: -5.25 }
      p.y = ramp.at(p.x) + .16
      let gate = D.enqueueDispense(D.createDispenser(13), 24), released = 0, exited = 0
      const releaseFrames = []
      for (let frame = 0; frame < 1200; frame++) {
        const clear = live.every(piece => distance(piece.body.translation(), p) > .68)
        const next = D.releaseDispense(gate, frame, clear ? 1 : 0); gate = next.state
        if (next.released) {
          const piece = rampPiece(ramp, p, false)
          for (const fixed of ramp.fixed) {
            const contact = piece.collider.contactCollider(fixed, .1)
            assert.ok(!contact || contact.distance >= -.001, `initial ramp penetration ${contact?.distance}`)
          }
          for (const old of live) {
            const contact = piece.collider.contactCollider(old.collider, .1)
            assert.ok(!contact || contact.distance >= -.001, `new medal overlaps existing medal: ${contact?.distance}`)
          }
          live.push({ ...piece, exited: false }); releaseFrames.push(frame); released++
        }
        ramp.world.step()
        for (let k = live.length - 1; k >= 0; k--) {
          const piece = live[k], at = piece.body.translation(), v = piece.body.linvel()
          assert.ok([at.x, at.y, at.z, v.x, v.y, v.z].every(Number.isFinite))
          if (!piece.exited && Math.abs(at.x) < 5.0) { piece.exited = true; exited++ }
          if (Math.abs(at.x) > 5.12 && at.y > 1.2) {
            assert.ok(Math.hypot(v.x, v.y, v.z) < 12, 'no explosive collision impulse in the chute')
            assert.ok(s * v.x < .6, 'no strong backwards kick into the magazine')
          }
          if (at.y < -3.5) { ramp.world.removeRigidBody(piece.body); live.splice(k, 1) }
        }
      }
      assert.equal(released, 24); assert.equal(exited, 24); assert.equal(gate.queued, 0)
      for (let n = 1; n < releaseFrames.length; n++) assert.ok(releaseFrames[n] - releaseFrames[n - 1] >= 13)
      ramp.world.free()
    }
  })
  await test('real Rapier ball handoff clears the outer stop and rolls from rail to slide', () => {
    const ramp = makeRamp(-1)
    const bad = rampPiece(ramp, { x: -6.35, y: 3.04, z: -5.25 }, true)
    const oldContacts = ramp.fixed.map(fixed => bad.collider.contactCollider(fixed, .1))
    assert.ok(oldContacts.some(contact => contact && contact.distance < -.1), 'regression fixture intersects original outer stop')
    ramp.world.removeRigidBody(bad.body)
    // Shift the visible rail endpoint inward with the handoff, rather than teleport
    // the ball or giving it an upward impulse to escape the magazine stop.
    const ball = rampPiece(ramp, { x: -6.12, y: 2.90, z: -5.25 }, true)
    // Preserve the descending rail's actual tangent at handoff. The ramp contact
    // then redirects the ball physically, rather than snapping its velocity.
    const lastDx = -6.12 - (-5.9), lastDy = 2.90 - 4.1, lastLen = Math.hypot(lastDx, lastDy)
    ball.body.setLinvel({ x: lastDx / lastLen * 1.8, y: lastDy / lastLen * 1.8, z: 0 }, true)
    for (const fixed of ramp.fixed) {
      const contact = ball.collider.contactCollider(fixed, .2)
      assert.ok(!contact || contact.distance >= -.001, `ball penetration ${contact?.distance}`)
    }
    let exited = false, maxSpeed = 0
    for (let frame = 0; frame < 120; frame++) {
      ramp.world.step()
      const at = ball.body.translation(), v = ball.body.linvel()
      assert.ok([at.x, at.y, at.z].every(Number.isFinite))
      if (at.x > -5) { exited = true; break }
      maxSpeed = Math.max(maxSpeed, Math.hypot(v.x, v.y, v.z))
    }
    assert.ok(exited, 'ball rolls into the field within two seconds')
    assert.ok(maxSpeed < 12, 'no explosive escape from stop penetration')
    ramp.world.free()
  })
  await test('active tower route is the tested same-body support machine, not the obsolete roof chute', () => {
    const source=fs.readFileSync(path.join(root,'src/components/MedalCove.tsx'),'utf8')
    assert.match(source,/createTowerMachine\(world/)
    assert.match(source,/towerMachine.enqueue\(t.n,t.source\?\?'prize'\)/)
    assert.match(source,/towerMachine.update\(physicsFrame\)/)
    assert.match(source,/pieces.get\(body.handle\)!\.towerHeld=false;if\(request.source!=='stock'\)rewardDelivered\+\+/)
    assert.doesNotMatch(source,/towerFeed|towerSources|towerGate|const outlet=\{x:0,y:BTOP/)
  })
  await test('same-frame rewards retain structured bank source, current quantity, and separate towers', () => {
    const P = load('src/store/pusher.ts')
    const layerSegment = P.WHEELS[0].findIndex(s => s.kind === 'layers')
    const lampSegment = P.WHEELS[1].findIndex(s => s.kind === 'lamp')
    const dishTower = P.DISH.findIndex(p => p.prize.kind === 'tower')
    let c = P.newCove(() => .4, 100, true)
    c = { ...c, bank: 125, steps: P.LAMPS - 1,
      spinning: { reels: ['🗼', '🗼', '🗼'], prize: { kind: 'tower', n: 20 }, at: -200 },
      wheels: [{ seg: layerSegment, at: -200 }, { seg: lampSegment, at: -200 }, null],
      dish: { pocket: dishTower, at: -300 } }
    c = P.step(c, () => .4)
    const expectedBank = 125 + P.WHEELS[0][layerSegment].n * P.LAYER
    assert.equal(c.towers.length, 3, 'lottery, bank, and dish rewards coexist')
    assert.equal(new Set(c.towers.map(t => t.at)).size, 1, 'all fixtures resolve in the same frame')
    const bankTower = c.towers.filter(t => t.source === 'bank')
    assert.equal(bankTower.length, 1)
    assert.equal(bankTower[0].n, expectedBank, 'same-frame layer award belongs in actual released bank')
    assert.equal(c.towers.reduce((n, t) => n + t.n, 0), 20 + expectedBank + P.DISH[dishTower].prize.n)
    assert.equal(c.bank, P.BANK_START)
    assert.equal(c.hand, 100, 'delivery awards are not prematurely collected')
    assert.doesNotMatch(c.events.at(-1).text, /BIG BONUS/, 'bank identity does not depend on the last message')
  })
  await test('actual tray top contacts capture upright medals and supported rim catches, not side hits', () => {
    for (const fixture of [
      { x: 0, y: -1.69, rz: Math.PI / 2, expected: 'medal' },
      { x: D.TRAY.halfWidth - .053, y: -1.945, rz: 0, expected: 'medal' },
      { x: D.TRAY.halfWidth + .31, y: -2.15, rz: 0, expected: null },
    ]) {
      const world = new R.World({ x: 0, y: -22, z: 0 })
      const tray = world.createCollider(R.ColliderDesc.cuboid(D.TRAY.halfWidth, .15, 1.3).setTranslation(0, -2.15, D.TRAY.center))
      const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(fixture.x, fixture.y, D.TRAY.center)
        .setRotation({ x: 0, y: 0, z: Math.sin(fixture.rz / 2), w: Math.cos(fixture.rz / 2) }))
      const collider = world.createCollider(R.ColliderDesc.cylinder(.055, .31), body)
      const contact = tray.contactCollider(collider, .012)
      const touching = !!contact && contact.distance <= .012 && contact.normal1.y > .4
      assert.equal(D.capturePiece(body.translation(), false, touching), fixture.expected)
      assert.equal(D.capturePiece(body.translation(), false, false), null, 'explicit no-contact never falls back to height credit')
      world.free()
    }
    assert.equal(D.capturePiece({ x: NaN, y: -2, z: 3 }, false, true), null)
    assert.equal(D.capturePiece({ x: 0, y: -4, z: 3 }, false, true), 'lost')
  })
  await test('stacked medals wait for real tray contact and collect after the lower medal clears', () => {
    const world = new R.World({ x: 0, y: -22, z: 0 })
    const tray = world.createCollider(R.ColliderDesc.cuboid(D.TRAY.halfWidth, .15, 1.3).setTranslation(0, -2.15, D.TRAY.center))
    function coin(y) {
      const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, y, D.TRAY.center).setCcdEnabled(true))
      const collider = world.createCollider(R.ColliderDesc.cylinder(.055, .31).setFriction(.52), body)
      return { body, collider }
    }
    function capture(piece) {
      const contact = tray.contactCollider(piece.collider, .012)
      const touching = !!contact && contact.distance <= .012 && contact.normal1.y > .4
      return D.capturePiece(piece.body.translation(), false, touching)
    }
    const lower = coin(-1.945), upper = coin(-1.835)
    for (let frame = 0; frame < 90; frame++) world.step()
    assert.equal(capture(lower), 'medal')
    assert.equal(capture(upper), null, 'upper coin has not touched the tray yet')
    world.removeRigidBody(lower.body); upper.body.wakeUp()
    for (let frame = 0; frame < 120; frame++) world.step()
    assert.equal(capture(upper), 'medal', 'the second medal is credited on its own catch contact')
    world.free()
  })
  await test('real Rapier material response: medal settles while the prize ball has a distinct bounce', () => {
    function trajectory(ball) {
      const world = new R.World({ x: 0, y: -22, z: 0 }), cfg = ball ? D.BALL_MOTION : D.COIN_MOTION
      world.createCollider(R.ColliderDesc.cuboid(5, .1, 5).setTranslation(0, -.1, 0).setRestitution(0))
      const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 3, 0)
        .setLinearDamping(cfg.linearDamping).setAngularDamping(cfg.angularDamping).setCcdEnabled(true))
      world.createCollider((ball ? R.ColliderDesc.ball(.44) : R.ColliderDesc.cylinder(.055, .31))
        .setFriction(cfg.friction).setRestitution(cfg.restitution), body)
      let hit = false, rebound = 0
      for (let n = 0; n < 240; n++) {
        world.step()
        if (body.translation().y < (ball ? .5 : .12)) hit = true
        if (hit) rebound = Math.max(rebound, body.linvel().y)
        assert.ok(Number.isFinite(body.translation().y))
      }
      const y = body.translation().y; world.free(); return { rebound, y }
    }
    const coin = trajectory(false), ball = trajectory(true)
    assert.ok(ball.rebound > coin.rebound + .5, JSON.stringify({ coin, ball }))
    assert.ok(Math.abs(coin.y - .055) < .02)
    assert.ok(Math.abs(ball.y - .44) < .02)
  })
  await test('real Rapier front-tray arrival detects both sizes once, after the drop', () => {
    for (const ball of [false, true]) {
      const world = new R.World({ x: 0, y: -22, z: 0 })
      world.createCollider(R.ColliderDesc.cuboid(D.TRAY.halfWidth, .15, 1.3).setTranslation(0, -2.15, D.TRAY.center))
      const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, -.3, 3.2).setCcdEnabled(true))
      world.createCollider(ball ? R.ColliderDesc.ball(.44) : R.ColliderDesc.cylinder(.055, .31), body)
      let arrival = null, arrivalFrame = -1
      for (let n = 0; n < 120; n++) {
        world.step()
        if (!arrival) { arrival = D.capturePiece(body.translation(), ball); if (arrival) arrivalFrame = n }
      }
      assert.equal(arrival, ball ? 'ball' : 'medal')
      assert.ok(arrivalFrame > 10, 'no credit during the early fall')
      assert.ok(body.translation().y > -2, 'body remains physically visible in tray')
      world.free()
    }
  })
  console.log(`${passed}/${passed} delivery and Rapier checks passed.`)
})().catch(error => { console.error('FAIL', error); process.exit(1) })
