// Actual Three scene triangle/projection tests. GPU pixels remain unverified.
const assert=require('node:assert/strict'),THREE=require('three'),{start}=require('./production_runtime.cjs')
let passed=0
function test(name,fn){fn();passed++;console.log('PASS '+name)}
;(async()=>{
 for(const [width,height]of[[1080,790],[390,550]]){
  const {rt,review,advance,cleanup,load}=await start(width,height)
  advance();rt.scene.updateMatrixWorld(true)
  const {CABINET:compact,PUSHER_SHELF:shelf}=load('src/store/motion.ts')
  const camera=rt.camera,origin=camera.position.clone(),ray=new THREE.Raycaster(),opaque=[]
  rt.scene.traverse(o=>{if(o.isMesh&&o!==rt.coins&&o!==rt.balls&&[].concat(o.material).some(m=>m.visible&&(!m.transparent||m.opacity>=.85)))opaque.push(o)})
  function blocking(target,objects){const dir=target.clone().sub(origin);ray.far=dir.length()-.015;ray.set(origin,dir.normalize());return ray.intersectObjects(objects,false).find(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent}return true})}
  test(`${width}×${height}: one eye-level camera looks up, with real falling-coin plane unobstructed`,()=>{
   assert.ok(Math.abs(camera.position.y-1.7)<1e-6);assert.ok(camera.getWorldDirection(new THREE.Vector3()).y>.03)
   assert.equal(rt.coins.frustumCulled,false);assert.equal(rt.balls.frustumCulled,false)
   // Start above the real pocket mouths: natural catcher occlusion at the
   // very bottom is expected, unlike an opaque gantry hiding falling medals.
   for(const y of [1.8,2,2.5,3,3.5,4,4.5])for(const x of [-4,-3,-2,-1,0,1,2,3,4].map(x=>x*compact.aimHalfWidth/4)){
    const target=new THREE.Vector3(x,y,-6.095),hit=blocking(target,opaque),ndc=target.clone().project(camera)
    assert.ok(!hit,`opaque ${hit?.object.geometry.type} blocks actual medal plane at ${x},${y}`)
    assert.ok(Math.abs(ndc.x)<.966&&Math.abs(ndc.y)<.951,'full pegboard stays within view')
   }
   assert.equal(rt.pusherMesh.geometry.parameters.depth,shelf.depth);assert.ok(Math.abs(rt.pusherBody.collider(0).halfExtents().z-shelf.depth/2)<1e-6)
  })
  test(`${width}×${height}: Reference view shows actual tower rims, sides and loose front medals`,()=>{
   review.previewWholeRoute();rt.placeCamera();camera.updateMatrixWorld();origin.copy(camera.position)
   const {FIELD_TOWERS}=load('src/store/motion.ts'),{TOWER}=load('src/store/tower.ts')
   const centers=[...FIELD_TOWERS.map(t=>({x:t.x,z:t.z})),{x:TOWER.x,z:TOWER.z}]
   // Rear ring follows its real moving shelf; use its actual upper-field cluster.
   const groups=[[],[],[]],loose=[];let instanceId=0
   for(const p of rt.pieces.values()){
    if(p.ball)continue
    const at=p.body.translation(),item={p,at,instanceId:instanceId++}
    const group=p.towerHeld?2:centers.findIndex((c,i)=>i<2&&Math.hypot(at.x-c.x,at.z-c.z)<1.16)
    if(group>=0)groups[group].push(item);else if(!p.board&&at.y<.4&&at.z>compact.front-1.5)loose.push(item)
   }
   const visible=(item,side=false)=>{
    const q=item.p.body.rotation(),normal=side?new THREE.Vector3(camera.position.x-item.at.x,0,camera.position.z-item.at.z).normalize().multiplyScalar(.31):new THREE.Vector3(0,.055,0).applyQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w))
    const target=new THREE.Vector3(item.at.x,item.at.y,item.at.z).add(normal),ndc=target.clone().project(camera)
    if(Math.abs(ndc.x)>=.96||Math.abs(ndc.y)>=.95||blocking(target,opaque))return false
    const hit=blocking(target,[rt.coins,rt.balls]);return !hit||(hit.object===rt.coins&&hit.instanceId===item.instanceId)
   }
   const counts=groups.map((group,i)=>{assert.ok(group.length>=100,`tower ${i} contains real medal bodies`);const top=Math.max(...group.map(p=>p.at.y)),rims=group.filter(p=>p.at.y>top-.06),rimVisible=rims.filter(p=>visible(p)).length,sideVisible=group.filter(p=>visible(p,true)).length;assert.ok(rimVisible>=2,`tower ${i}: only ${rimVisible} rim medals visible`);assert.ok(sideVisible>=8,`tower ${i}: only ${sideVisible} side medals visible`);return {bodies:group.length,rimVisible,rimSamples:rims.length,sideVisible}})
   const looseVisible=loose.filter(p=>visible(p)).length;assert.ok(looseVisible>=4,`only ${looseVisible} loose front medals visible`)
   assert.equal(rt.coins.layers.mask,1);assert.equal(rt.balls.layers.mask,1)
   console.log('  actual tower samples',counts,'loose front',looseVisible,'/',loose.length,'(foreground tower naturally occludes rear lower coins)')
   review.previewWholeRoute();rt.placeCamera()
   const {frameBoundsForView,RESERVE_BOUNDS}=load('src/components/framing.ts')
   for(const view of [1,0]){review.viewRef.current=view;rt.placeCamera();camera.updateMatrixWorld();for(const point of frameBoundsForView(view,RESERVE_BOUNDS)){const v=new THREE.Vector3(...point).project(camera);assert.ok(Math.abs(v.x)<.966&&Math.abs(v.y)<.951,'Overview and return preserve required hull')}}
   assert.ok(Math.abs(camera.position.y-1.7)<1e-6,'returning to Front restores standing eye height')
  })

  cleanup()
 }
 console.log(`${passed}/${passed} actual-scene geometry checks passed (not GPU screenshots).`)
})().catch(e=>{console.error('FAIL',e);process.exit(1)})
