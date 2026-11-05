// Actual production camera/triangle checks. No WebGL pixel claim.
const assert=require('node:assert/strict'),THREE=require('three'),{start}=require('./production_runtime.cjs')
;(async()=>{
 for(const [width,height]of [[1080,790],[390,550]]){
  const saved={target:[.2,2.8,-1.3],distance:19,yaw:.1,pitch:.12,zoom:1.1,fov:44}
  const {rt,review,advance,cleanup,load,storage}=await start(width,height,{savedCamera:JSON.stringify(saved)})
  advance();const before=JSON.stringify(review.cameraPoseRef.current),stored=storage.getItem('kono-medal-cove.camera.v1')
  review.previewWholeRoute();rt.placeCamera();rt.scene.updateMatrixWorld(true)
  const framing=load('src/components/framing.ts'),PLINKO=load('src/store/motion.ts').PLINKO,camera=rt.camera
  for(const point of framing.WHOLE_ROUTE_BOUNDS){const p=new THREE.Vector3(...point).project(camera);assert.ok(Math.abs(p.x)<=.921&&p.y<=1-116/height+1e-6&&p.y>=-1+84/height-1e-6,`reference hull clips ${point} => ${p.toArray()}`)}
  const boats=[];let bay;rt.scene.traverse(o=>{if(o.name.startsWith('sanctuary-boat-target-'))boats.push(o);if(o.name==='reference-open-build-bay')bay=o})
  const opaque=[],pins=[],ray=new THREE.Raycaster();rt.scene.traverse(o=>{let visible=o.visible;for(let parent=o.parent;parent;parent=parent.parent)visible&&=parent.visible;if(!o.isMesh||!visible)return;const g=o.geometry.parameters;if(o.isInstancedMesh&&g?.radiusTop===.06&&g?.height===.42){pins.push(o);return}if(o!==rt.coins&&o!==rt.balls&&[].concat(o.material).some(m=>!m.transparent||m.opacity>.85))opaque.push(o)})
  // The oblique view may legitimately put a physical pin over a sampled board
  // point. Never hide pins/coins to turn natural occlusion into an artificial pass.
  let pinOcclusions=0
  for(const x of [-3,-2,-1,0,1,2,3])for(const y of [2,2.5,3,3.5,4,4.5]){const target=new THREE.Vector3(x,y+PLINKO.lift,PLINKO.z+.055),direction=target.clone().sub(camera.position);ray.set(camera.position,direction.clone().normalize());ray.far=direction.length()-.015;assert.equal(ray.intersectObjects(opaque,false).length,0,'opaque cabinet architecture must not hide rear pinboard '+JSON.stringify({x,y,hits:ray.intersectObjects(opaque,false).map(h=>({n:h.object.name,p:h.object.position.toArray(),type:h.object.geometry.type}))}));if(ray.intersectObjects(pins,false).length)pinOcclusions++}
  const targets=boats.map(boat=>{const own=[];boat.traverse(o=>{if(o.isMesh)own.push(o)});let visible=0,total=0
   for(const dx of [-.6,-.5,-.4,-.3,-.2,-.1,0,.1,.2,.3,.4,.5,.6])for(const y of [-.1,-.15,-.2,-.25,-.3,-.35,-.4]){const point=boat.localToWorld(new THREE.Vector3(dx,y,.25)),d=point.clone().sub(camera.position);ray.set(camera.position,d.clone().normalize());ray.far=d.length()+.1;if(!ray.intersectObjects(own,false).length)continue;total++;let hit=ray.intersectObjects([...opaque,...pins,rt.coins,rt.balls],false)[0]?.object;while(hit&&hit!==boat)hit=hit.parent;if(hit===boat)visible++}
   assert.ok(visible>=5,boat.name+' retains a genuinely visible cheek area, not necessarily its whole mouth');return {name:boat.name,visible,total}
  });console.log('  partly visible real boat silhouettes',targets,'natural pin occlusions',pinOcclusions,'/42')
  assert.equal(boats.length,3);assert.ok(bay,'right clear shaft exists')
  assert.equal(bay.children.length,7,'right shaft, enclosed wedge, external porch and two support legs; no transfer wall');assert.ok(bay.getObjectByName('reference-bay-contact-side-porch'),'external workshop has its own visible foundation')
  const wedge=bay.getObjectByName('reference-bay-contact-solid-wedge');assert.ok(wedge);assert.equal(wedge.userData.collider,'convexHull')
  const edges=new Map(),idx=wedge.geometry.index;for(let i=0;i<idx.count;i+=3)for(let j=0;j<3;j++){const a=idx.getX(i+j),b=idx.getX(i+(j+1)%3),key=[Math.min(a,b),Math.max(a,b)].join(':');edges.set(key,(edges.get(key)||0)+1)}assert.ok([...edges.values()].every(n=>n===2),'every wedge edge closes exactly two visible faces')
  assert.ok(bay.children[0].material.transparent&&bay.children[0].material.opacity<.1)
  assert.equal(JSON.stringify(review.cameraPoseRef.current),before);assert.equal(storage.getItem('kono-medal-cove.camera.v1'),stored)
  review.previewWholeRoute();rt.placeCamera();assert.equal(JSON.stringify(review.cameraPoseRef.current),before);assert.equal(storage.getItem('kono-medal-cove.camera.v1'),stored)
  console.log(`PASS ${width}×${height}: complete inset reference hull, 3 boats, open clear bay, exact saved-view restoration`)
  cleanup()
 }
})().catch(e=>{console.error(e);process.exit(1)})
