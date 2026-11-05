// Independent CPU/Rapier audit of the video-derived arrangement. Not GPU evidence.
const assert = require('node:assert/strict')
const R = require('@dimforge/rapier3d-compat')
const {start} = require('./production_runtime.cjs')

async function rawGeometry() {
  const h = await start(1080, 790)
  const {rt, load} = h
  const {TOWER: T} = load('src/store/tower.ts')
  const {fieldStock, shelfFront, CABINET, FIELD_TOWERS, BOARD_BACKSTOP, PUSHER_SHELF} = load('src/store/motion.ts')
  for(let field=14;field<=30;field+=.1)assert.ok(shelfFront(field)-PUSHER_SHELF.depth<=BOARD_BACKSTOP.z-BOARD_BACKSTOP.depth/2-.039999,'moving shelf continuously supports beneath entire rear apron')
  assert.ok(shelfFront(14)-PUSHER_SHELF.depth-(CABINET.front-CABINET.depth)>.19,'shelf clears rear wall at retraction')
  assert.ok(BOARD_BACKSTOP.bottom-PUSHER_SHELF.height>0&&BOARD_BACKSTOP.bottom-PUSHER_SHELF.height<.011,'rear apron has sub-medal vertical clearance')
  const raw = fieldStock(T.radius, shelfFront(30), CABINET.front, () => .5)
  const held = [...rt.pieces.values()].filter(p => p.towerHeld)
  assert.equal(held.length, 128)
  assert.ok(held.every(p => !p.reward && !p.counted), 'starting bay is real unawarded stock')
  assert.equal(rt.towerMachine.status().pending, 0)
  assert.equal(rt.counts.rewardDelivered, 0)
  assert.ok([...rt.pieces.values()].filter(p => !p.ball).length <= 900)
  assert.equal([...rt.pieces.values()].filter(p => p.ball).length, 6)
  assert.ok(CABINET.front-BOARD_BACKSTOP.z < CABINET.width*1.05, 'visible active field remains compact; rear support extension stays behind backdrop')
  const rings = raw.filter(p => p.formation !== undefined)
  assert.equal(rings.length, FIELD_TOWERS.reduce((n, t) => n + t.layers * T.medalsPerLayer, 0))
  assert.equal(T.medalsPerLayer, 8, 'individual scalloped hollow ring, not twin slivers')
  for (let i = 0; i < raw.length; i++) for (let j = i + 1; j < raw.length; j++) {
    const a = raw[i], b = raw[j]
    assert.ok(Math.abs(a.y - b.y) >= T.halfHeight * 2 - .001 ||
      Math.hypot(a.x - b.x, a.z - b.z) >= T.radius * 2 - .001,
    'raw stock has no overlapping coplanar cylinders')
  }
  // Unlike settled contacts, this catches energy injected BEFORE the scene's
  // initial 180-step warm-up (including the former rear ring/pin collision).
  for (const at of [...raw, ...held.map(p => p.body.translation())]) {
    const probe = rt.world.createCollider(R.ColliderDesc.cylinder(T.halfHeight, T.radius)
      .setTranslation(at.x, at.y, at.z).setSensor(true))
    rt.world.intersectionsWithShape(at, {x:0,y:0,z:0,w:1}, new R.Cylinder(T.halfHeight, T.radius), c => {
      if (c.handle === probe.handle || (c.parent() && rt.pieces.has(c.parent().handle))) return true
      const contact = probe.contactCollider(c, .001)
      assert.ok(!contact || contact.distance >= -.001,
        `raw coin overlaps fixture: ${JSON.stringify({at, fixture:c.translation(), depth:contact?.distance})}`)
      return true
    })
    rt.world.removeCollider(probe, false)
  }
  h.cleanup()
  console.log('PASS raw stock rings, budget, provenance, six balls and zero fixture overlaps')
}

async function contactCycles() {
  const h = await start(1080, 790)
  const {rt, review, advance, load} = h
  const {TOWER: T} = load('src/store/tower.ts')
  const gravity = Math.abs(load('src/store/motion.ts').FIELD_MOTION.gravity.y)
  let sceneHighest = -Infinity
  const highest = new Map([...rt.pieces].map(([id,p])=>[id,p.body.translation().y]))
  const leaves = []
  for (const at of rt.towerMachine.status().supports) rt.world.forEachRigidBody(body => {
    const p = body.translation()
    if (Math.hypot(p.x-at.x, p.y-at.y, p.z-at.z) < 1e-5) leaves.push(body)
  })
  assert.equal(leaves.length, 2)
  const initialStock = [...rt.pieces.values()].filter(p => p.towerHeld).map(p => p.body)
  const identities = new Map([...rt.pieces].map(([id,p]) => [id,p.body]))
  const crossingStates = new Map()
  const motorStages = new Set(['releasing', 'returning', 'homing', 'parking'])
  const stats = {steps:0, maxMotorStep:0, maxSpeed:0, maxUpSpeed:0, maxHorizontalSpeed:0,
    minContactDistance:0, fixedPenetration:0, peakMedals:0, peakBalls:0, crossings:0, maxEnergyExcess:-Infinity}
  let worstContact = null
  const velocityPeaks = {}
  const originalStep = rt.world.step.bind(rt.world)
  rt.world.step = (...args) => {
    const before = leaves.map(b => ({...b.translation()}))
    const result = originalStep(...args)
    stats.steps++
    const status = rt.towerMachine.status()
    let medals = 0, balls = 0
    for (const [id,p] of rt.pieces) {
      p.ball ? balls++ : medals++
      assert.ok(!identities.has(id) || identities.get(id) === p.body, 'existing body identity persists')
      const at = p.body.translation(), v = p.body.linvel()
      assert.ok([at.x,at.y,at.z,v.x,v.y,v.z].every(Number.isFinite), 'finite physical state')
      highest.set(id, Math.max(highest.get(id) ?? at.y, at.y));sceneHighest=Math.max(sceneHighest,highest.get(id))
      if (p.body.isDynamic() && at.y > -2.3) {
        const energyBound = Math.sqrt(2*gravity*Math.max(0,sceneHighest-at.y)+4*4)+1
        const descending = v.y<0&&-v.y>Math.hypot(v.x,v.z)
        const excess = descending?Math.hypot(v.x,v.y,v.z)-energyBound:-Infinity
        if(excess>stats.maxEnergyExcess) velocityPeaks.energy={step:stats.steps,at:{...at},v:{...v},highest:highest.get(id),sceneHighest,bound:energyBound}
        stats.maxEnergyExcess=Math.max(stats.maxEnergyExcess,excess)
        for (const [key,value] of [['maxSpeed',Math.hypot(v.x,v.y,v.z)],['maxUpSpeed',v.y],['maxHorizontalSpeed',Math.hypot(v.x,v.z)]]) if(value>stats[key]) velocityPeaks[key]={step:stats.steps,stage:status.stage,at:{...at},v:{...v},ball:p.ball,held:p.towerHeld,reward:p.reward}
        stats.maxSpeed = Math.max(stats.maxSpeed, Math.hypot(v.x,v.y,v.z))
        stats.maxUpSpeed = Math.max(stats.maxUpSpeed, v.y)
        stats.maxHorizontalSpeed = Math.max(stats.maxHorizontalSpeed, Math.hypot(v.x,v.z))
      }
    }
    stats.peakMedals = Math.max(stats.peakMedals, medals)
    stats.peakBalls = Math.max(stats.peakBalls, balls)
    assert.ok(medals <= 900 && balls <= 16, 'separate real-body budgets remain bounded')
    leaves.forEach((body, i) => {
      const at = body.translation(), old = before[i], collider = body.collider(0)
      assert.ok(collider.isEnabled(), 'contact motor never disables its solid collider')
      if (motorStages.has(status.stage)) {
        const delta = Math.hypot(at.x-old.x, at.y-old.y, at.z-old.z)
        stats.maxMotorStep = Math.max(stats.maxMotorStep, delta)
        assert.ok(delta <= .008001, 'each EMPTY motor physics step is at most .008')
      }
      for (const [id,p] of rt.pieces) {
        if (p.ball || !p.body.isDynamic()) continue
        const pos = p.body.translation(), q = p.body.rotation(), up = 1-2*(q.x*q.x+q.z*q.z)
        const extent = T.halfHeight*Math.abs(up) + T.radius*Math.sqrt(Math.max(0,1-up*up))
        const key = i+':'+id
        // Entire disc footprint is within the leaf, independent of rotation.
        if (Math.abs(pos.x-at.x) > T.leafHalfWidth-T.radius-.005 ||
            Math.abs(pos.z-at.z) > T.leafHalfDepth-T.radius-.005) {
          crossingStates.delete(key); continue
        }
        const side = pos.y-extent > at.y+T.leafHalfHeight-.003 ? 1 :
          pos.y+extent < at.y-T.leafHalfHeight+.003 ? -1 : 0
        const prior = crossingStates.get(key)
        if (side && prior && side !== prior) stats.crossings++
        if (side) crossingStates.set(key, side)
      }
      rt.world.contactPairsWith(collider, other => {
        const contact = collider.contactCollider(other, .001)
        const owner=other.parent(),piece=owner&&rt.pieces.get(owner.handle)
        if(contact&&!piece&&!leaves.some(b=>owner&&b.handle===owner.handle)) stats.fixedPenetration=Math.max(stats.fixedPenetration,-contact.distance)
        if (contact && contact.distance < stats.minContactDistance) {
          stats.minContactDistance = contact.distance
          worstContact = {step:stats.steps, leaf:collider.handle, other:other.handle,
            distance:contact.distance, normal:contact.normal1, leafPosition:collider.translation(), position:other.translation(), point:contact.point1, coinUpY:1-2*(other.rotation().x**2+other.rotation().z**2), ball:piece?.ball, piece:!!piece, recovery:[]}
        }
      })
    })
    if (worstContact && stats.steps > worstContact.step && stats.steps <= worstContact.step+32) {
      const a = rt.world.getCollider(worstContact.leaf), b = rt.world.getCollider(worstContact.other)
      worstContact.recovery.push(a && b ? a.contactCollider(b,.5)?.distance ?? null : null)
    }
    return result
  }
  advance(300)
  for (let cycle=1; cycle<=2; cycle++) {
    review.cove.current = {...review.cove.current, fieldAwards:review.cove.current.fieldAwards+20,
      towers:[{n:20,source:'prize'}]}
    let complete = false
    for (let step=0; step<1800; step++) {
      advance()
      const s = rt.towerMachine.status()
      if (s.stage === 'idle' && s.released === cycle*20) { complete = true; break }
    }
    assert.ok(complete, `dense default cycle ${cycle} returns fully home without player intervention`)
  }
  assert.equal(rt.towerMachine.status().stockReleased, initialStock.length)
  assert.equal(rt.towerMachine.status().released, 40)
  assert.equal(rt.towerMachine.status().pending, 0)
  for (const body of initialStock) {
    const p = rt.pieces.get(body.handle)
    if (p) { assert.equal(p.body, body); assert.equal(p.reward, false); assert.equal(p.towerHeld, false) }
  }
  assert.equal(stats.crossings, 0, 'no fully-contained medal passes through a solid shutter')
  console.log('CONTACT METRICS', JSON.stringify(stats), 'WORST CONTACT', JSON.stringify(worstContact), 'VELOCITY PEAKS', JSON.stringify(velocityPeaks))
  // A tall ring can fall faster than the old flat-bed12-unit bound. Compare
  // descending speed with available scene height under real gravity, a4-unit
  // inlet-energy allowance and1-unit discrete-contact tolerance instead.
  // Contact transfers energy between bodies, so a low bedcoin is not limited
  // to its own prior height. Separate upward/lateral limits detect pinches.
  assert.ok(stats.maxEnergyExcess <= 0 && stats.maxUpSpeed < 6 && stats.maxHorizontalSpeed < 8)
  // Approved edge-only contact envelope. This is not a blanket allowance
  // for buried discs or fixed-fixture pinching. Contacts and identities remain
  // real; a non-flat rim impact must recover on actual physics steps.
  assert.ok(stats.fixedPenetration<.001,'no shutter/fixed-fixture pinching')
  assert.ok(stats.minContactDistance>-.05,'bounded edge compression, never full-disc burial')
  if (worstContact && worstContact.distance < -.025) {
    assert.ok(worstContact.piece&&!worstContact.ball,'only actual medal rim contacts get this allowance')
    const lateralNormal=Math.hypot(worstContact.normal.x,worstContact.normal.z)
    assert.ok(lateralNormal>.05||Math.abs(worstContact.coinUpY)<.95,
      'contact normal/orientation proves an edge or tilted rim, not flat full burial')
    assert.ok(worstContact.recovery.length>=16,'observe complete recovery window')
    const clearBy=(index,depth)=>worstContact.recovery[index]===null||worstContact.recovery[index]>depth
    assert.ok(clearBy(9,-.025),'edge contact recovers below .025 within ten steps')
    assert.ok(clearBy(11,-.02),'edge contact recovers below .02 within twelve steps')
    assert.ok(clearBy(15,0),'edge contact separates within sixteen steps')
  }
  h.cleanup()
  console.log('PASS two dense real-contact cycles, identity, stock rights, motor bounds and no tunneling')
}
;(async()=>{await rawGeometry(); await contactCycles()})().catch(error=>{console.error('FAIL',error);process.exit(1)})
