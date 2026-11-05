/** Reference-inspired compact two-level cabinet. Medal dimensions and award
 * tables are unchanged; the shorter field is a deliberate physical layout change. */
export const CABINET = {
 width:8.4, halfWidth:4.2, depth:10.25, front:2,
 wallX:4.05, boardWallX:4.0, boardWidth:8.2, aimHalfWidth:3.5,
 stockHalfWidth:3.5, sideShift:1.0,
} as const

/** One physical clock and material contract for the renderer and Rapier regressions.
 * The wooden bed is visibly flat: gravity has no invisible forward component.
 * Contacts with the visible shelf/dropped medals are the only playfield drive.
 * Tuning values are simulation choices, not measured metal material constants.
 * See README for the Rapier documentation behind this setup. */
export const FIELD_MOTION = {
  gravity: { x: 0, y: -22, z: 0 },
  timestep: 1 / 60,
  solverIterations: 8,
  deckFriction: 0.58,
  shelfFriction: 0.45,
} as const

/** Raised upper tier. The launch, every pin, physical side wall and ship capture
 * line share this contract. Misses continue down the same world to the shelf. */
export const PLINKO={z:-6.15,top:9,bottom:6.05,lift:4.5} as const

/** A slight, visible offset in the staggered pin layout prevents a perfectly centered
 * default feed from balancing indefinitely on the first pin. Both meshes and
 * colliders use these positions; this is geometry, not a hidden velocity kick. */
export const PIN_POSITIONS: [number, number][] = []
for (let row = 0; row < 5; row++) {
  for (let col = -4; col <= 4; col++) {
    const x = col * 1.2 + (row % 2 ? 0.73 : 0.13)
    // Leave a complete medal-width opening between every outer pin and wall.
    if (Math.abs(x) < CABINET.boardWallX-.8) PIN_POSITIONS.push([x, PLINKO.top-.45 - row * 0.52])
  }
}

/** Real upper shelf, broad enough to carry the rear starting ring. The original
 * 1.6-unit stroke/cadence remains; its new front travels -3.75 through -2.15.
 * Its rear still passes beneath the unchanged pin-board apron with .005 clearance. */
export const PUSHER_SHELF = {
 width: CABINET.width-.4, height: .6, depth: 4.3, frontOffset: .85,
} as const
/** The painted pin-board back and its visible lower apron are one rear stop.
 * The old .45 opening below the art (and .26 below the farther-back scraper)
 * let flat shelf medals ride backward out of sight. The apron leaves .005
 * mechanical clearance over the moving shelf, not enough for a .11 medal.
 * Its front stays behind the edge-on pin-board route; there is no front wall
 * across the normal forward handoff. Meshes and colliders share these slabs. */
export const BOARD_BACKSTOP = {
 width:CABINET.boardWidth, depth:.12, z:-6.35,
 bottom:PUSHER_SHELF.height+.005, seam:PLINKO.bottom-.5, top:PLINKO.top+.6,
} as const
export const shelfFront = (fieldPosition:number) => fieldPosition*.1-6+PUSHER_SHELF.frontOffset
export const shelfCenter = (fieldPosition:number) => shelfFront(fieldPosition)-PUSHER_SHELF.depth/2

export const FIELD_TOWERS = [
 {x:-1.15,z:-4.75,base:.6,layers:24},
 {x:-1.15,z:.5,base:0,layers:36},
] as const

/** Settled starting stock, not an award. Near-touching staggered rows carry a
 * contact chain; the old .6572 square grid left .0372 gaps in every row and
 * began just .01 inside the shelf's maximum reach. That absorbed the stroke
 * before it could reach the front. A .15 first-row engagement is small enough
 * to settle without an opening payout; later advances still require contacts.
 * The sparse, offset upper layer avoids mechanically independent heavy columns.
 * Spacing exceeds the medal diameter, so no explosive initial overlap is used. */
export function fieldStock(radius:number,extendedFront:number,front:number,random:()=>number=Math.random,includeTowers=true,rearShelfZ:number=shelfCenter(14)){
 const points:{x:number;y:number;z:number;formation?:number}[]=[],pitch=radius*2.006
 for(let layer=0;layer<3;layer++)for(let row=0,z=extendedFront+radius-.15;z<front-.35;row++,z+=pitch*Math.sqrt(3)/2){
  for(let x=-CABINET.stockHalfWidth+(row%2)*pitch/2;x<=CABINET.stockHalfWidth;x+=pitch)if(layer<2||random()<.55){
   const at={x:x+(layer?.14:0)+(random()-.5)*.001,y:.055+layer*.112,z:z+(layer?.12:0)+(random()-.5)*.001}
   if(includeTowers&&FIELD_TOWERS.some(t=>Math.hypot(at.x-t.x,at.z-t.z)<.82+radius*2+.04))continue
   if(at.x>1.15&&at.z> -1.8)continue // real clear forward delivery cover
   points.push(at)
  }
 }
 // Loose medals on the genuine upper shelf, clear of its ring and backplate.
 for(let row=0,z=Math.max(rearShelfZ-1,BOARD_BACKSTOP.z+BOARD_BACKSTOP.depth/2+radius+.03);z<=rearShelfZ+PUSHER_SHELF.depth/2-radius-.15;row++,z+=pitch*Math.sqrt(3)/2)for(let x=-CABINET.stockHalfWidth+(row%2)*pitch/2;x<=CABINET.stockHalfWidth;x+=pitch){
  if(Math.hypot(x-FIELD_TOWERS[0].x,z-(rearShelfZ+PUSHER_SHELF.depth/2-1))<.82+radius*2+.04)continue
  if(x>1.2&&z> -4.3)continue
  points.push({x,y:PUSHER_SHELF.height+.055,z})
 }
 // Real, unawarded hollow starting towers. No proxy mesh, lock or force.
 if(includeTowers)for(const [formation,tower] of FIELD_TOWERS.entries())for(let layer=0;layer<tower.layers;layer++)for(let i=0;i<8;i++){
  const angle=i*Math.PI/4+layer*Math.PI/8
  points.push({x:tower.x+.82*Math.cos(angle),y:tower.base+.055+layer*.112,z:(formation===0?rearShelfZ+PUSHER_SHELF.depth/2-1:tower.z)+.82*Math.sin(angle),formation})
 }
 return points
}
