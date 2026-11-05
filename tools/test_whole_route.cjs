// Real production callbacks + Three projection/triangles. No GPU pixel claim.
const assert=require('node:assert/strict'),THREE=require('three'),{start}=require('./production_runtime.cjs')
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)},json=JSON.stringify
const nodes=(node,out=[])=>{if(!node||typeof node!=='object')return out;if(Array.isArray(node)){node.forEach(n=>nodes(n,out));return out}out.push(node);nodes(node.props?.children,out);return out}
;(async()=>{
 const pose={target:[.42,2.75,-.3],distance:31.75,yaw:.04,pitch:.34,zoom:1.55,fov:42}
 const saved=json({version:1,pose}),h=await start(390,550,{savedCamera:saved}),v=h.review,rt=h.rt
 const F=h.load('src/components/framing.ts'),D=h.load('src/store/dispense.ts'),C=h.load('src/components/cameraControl.ts')
 const snap=()=>json({position:rt.camera.position.toArray(),quaternion:rt.camera.quaternion.toArray(),fov:rt.camera.fov,zoom:rt.camera.zoom})
 const assertHull=(camera,top,bottom)=>{for(const p of F.WHOLE_ROUTE_BOUNDS){const n=new THREE.Vector3(...p).project(camera);assert.ok(Math.abs(n.x)<=.920001,`side route clipped: ${p} -> ${n.x}`);assert.ok(n.y<=1-2*top+.000001,`toolbar covers ${p}: ${n.y}`);assert.ok(n.y>=-1+2*bottom-.000001,`hint covers ${p}: ${n.y}`);assert.ok(n.z>-1&&n.z<1)}}
 test('complete route fits below toolbar and above hint across portrait/landscape stage sizes',()=>{
  for(const [width,height]of [[390,550],[878,1022],[320,290],[1080,790],[540,290],[1600,260],[280,140],[320,950]]){
   const top=58/height,bottom=42/height,f=F.fitWholeRouteFrame(width/height,{top,bottom,side:.04})
   const camera=new THREE.PerspectiveCamera(f.fov,width/height,.1,f.far);camera.zoom=f.zoom;camera.position.set(...f.position);camera.lookAt(...f.target);camera.updateProjectionMatrix();camera.updateMatrixWorld()
   assertHull(camera,top,bottom)
  }
 })
 test('actual Reference preview never mutates the exact saved preference or unlocks camera',()=>{
  const before=snap(),preference=json(v.cameraPoseRef.current)
  v.beginFeed('keyboard');assert.equal(v.feed.current.active,true)
  v.previewWholeRoute();assert.equal(v.routePreviewRef.current,true);assert.equal(v.feed.current.active,false);assert.equal(v.lookRef.current,false)
  rt.placeCamera();assert.notEqual(snap(),before);assert.equal(json(v.cameraPoseRef.current),preference);assert.equal(h.storage.getItem(C.CAMERA_STORAGE_KEY),saved)
  v.editCamera();v.selectView(1);assert.equal(v.lookRef.current,false);assert.equal(json(v.cameraPoseRef.current),preference)
  const dropped=v.cove.current.dropped;v.dropOne();assert.equal(v.cove.current.dropped,dropped+1,'normal play remains available during preview')
  v.previewWholeRoute();rt.placeCamera();assert.equal(snap(),before);assert.equal(h.storage.getItem(C.CAMERA_STORAGE_KEY),saved)
 })
 test('preview uses actual toolbar/hint layout; orientation refits preview only and return is exact',()=>{
  const before=snap(),preference=json(v.cameraPoseRef.current)
  h.host.querySelector=selector=>({offsetHeight:selector.includes('toolbar')?72:32})
  v.previewWholeRoute()
  for(const [width,height]of [[390,550],[878,1022],[900,320],[320,290]]){
   h.host.clientWidth=width;h.host.clientHeight=height;rt.resize();assertHull(rt.camera,86/height,46/height)
   assert.equal(json(v.cameraPoseRef.current),preference);assert.equal(h.storage.getItem(C.CAMERA_STORAGE_KEY),saved)
  }
  v.previewWholeRoute();rt.placeCamera();assert.equal(snap(),before,'orientation changes aspect, not the saved transform/lens')
  h.host.querySelector=undefined
 })
 test('actual React preview and return controls are explicit, reversible and do not save',()=>{
  const control=()=>nodes(h.render()).find(n=>n.props?.className==='cove-route-preview')
  assert.equal(control().props.children,'Reference view');control().props.onClick();assert.equal(v.routePreviewRef.current,true)
  assert.equal(control().props.children,'Return saved view');assert.equal(control().props['aria-pressed'],true)
  assert.equal(nodes(h.render()).some(n=>n.props?.className==='cove-camera-toggle'),false,'editing controls do not cover preview route')
  control().props.onClick();assert.equal(v.routePreviewRef.current,false);assert.equal(h.storage.getItem(C.CAMERA_STORAGE_KEY),saved)
 })
 test('hidden legacy bank diagram never substitutes for exact HUD reserve entitlement',()=>{
  for(const bank of [0,1,20,45,74,75,76,100,1500,1000000]){
   const d=D.reserveDisplay(bank);assert.equal(d.total,bank);assert.equal(d.visible+d.stored,bank);assert.ok(d.slots.length<=15)
   assert.equal(d.slots.reduce((n,s)=>n+s.medals,0),d.visible)
   assert.ok(d.slots.every(s=>Math.abs(s.x)<=1.48&&s.y<=.68&&s.z===0))
   v.cove.current={...v.cove.current,bank};h.advance(10)
   const mesh=rt.scene.getObjectByName('bounded-reserve-diagram');assert.ok(mesh);assert.equal(mesh.count,d.slots.length);assert.equal(mesh.visible,false,'legacy non-reward diagram stays hidden; real rings own field presentation')
   mesh.computeBoundingBox();assert.ok(mesh.boundingBox.max.y<=6.83||bank===0)
   assert.equal(v.cove.current.bank,bank,'display cannot consume or cap the bank')
  }
  const html=nodes(h.render()).find(n=>n.props?.className==='cove-pockets')
  assert.equal(html.props['aria-label'],'Tower reserve: 1000000 medals')
  assert.ok(json(html.props.children).includes('1000000'));assert.ok(json(html.props.children).includes('tower reserve'))
 })
 test('redundant miniature meshes are absent and rear gantry cannot mask the actual falling plane',()=>{
  const posts=[];rt.scene.traverse(o=>{if(o.name==='rear-gantry-post'||o.name==='rear-gantry-beam')posts.push(o)
   if(o.isMesh&&o.geometry?.type==='CircleGeometry')assert.notEqual(o.geometry.parameters.radius,.62)
  });assert.equal(posts.length,3);rt.scene.updateMatrixWorld(true)
  const origin=new THREE.Vector3(0,12.63,31.75),ray=new THREE.Raycaster()
  for(let yi=0;yi<=60;yi++)for(let xi=0;xi<=200;xi++){
   const target=new THREE.Vector3(-4.5+xi*9/200,1.8+yi*2.7/60,-6.095),dir=target.clone().sub(origin)
   ray.far=dir.length()-.01;ray.set(origin,dir.normalize());assert.equal(ray.intersectObjects(posts,false).length,0)
  }
  const dials=nodes(h.render()).filter(n=>n.type?.name==='WheelDial');assert.equal(dials.length,3)
  dials.forEach((dial,i)=>{assert.equal(dial.props.i,i);assert.equal(dial.props.segs.length,8);assert.equal(typeof dial.props.turn,'function')})
  const source=require('fs').readFileSync(require('path').join(__dirname,'../src/components/MedalCove.tsx'),'utf8')
  assert.match(source,/const miniWheels=WHEELS\.map\(\(\)=>/);assert.match(source,/dialEls\.current\[i\]\?\.setAttribute/)
 })
 h.cleanup()
 const empty=await start(390,550),original=json(empty.rt.camera.position.toArray())
 test('preview from an unsaved Front preset returns without creating a saved camera',()=>{
  empty.review.previewWholeRoute();empty.rt.placeCamera();assert.notEqual(json(empty.rt.camera.position.toArray()),original)
  const control=nodes(empty.render()).find(n=>n.props?.className==='cove-route-preview');assert.equal(control.props.children,'Return previous view')
  empty.review.previewWholeRoute();empty.rt.placeCamera();assert.equal(json(empty.rt.camera.position.toArray()),original);assert.equal(empty.review.cameraPoseRef.current,null);assert.equal(empty.storage.getItem(C.CAMERA_STORAGE_KEY),null)
 })
 empty.cleanup();console.log(`${passed}/${passed} whole-route/compaction checks passed (CPU geometry and production callbacks; not GPU pixels).`)
})().catch(e=>{console.error('FAIL',e);process.exit(1)})
