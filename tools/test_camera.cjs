// View math, saved preference and actual production event/loop tests, without GPU pixels.
const assert=require('node:assert/strict'),THREE=require('three'),{start}=require('./production_runtime.cjs')
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)},json=JSON.stringify
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`)
;(async()=>{
 let h=await start(390,550),C=h.load('src/components/cameraControl.ts')
 const p={target:[0,3,0],distance:30,yaw:0,pitch:.2,zoom:1.25,fov:49}
 test('saved camera validates version, finite types, bounded coordinates and browser storage failure',()=>{
  const store=h.storage,key=C.CAMERA_STORAGE_KEY
  assert.equal(C.readCameraPose(store),null)
  for(const data of ['broken','null','{}',json({version:2,pose:p}),json({version:1,pose:{...p,zoom:'2'}}),json({version:1,pose:{...p,target:[0,null,0]}})]){store.setItem(key,data);assert.equal(C.readCameraPose(store),null)}
  assert.equal(C.validateCameraPose({...p,pitch:Infinity}),null);assert.equal(C.validateCameraPose({...p,zoom:NaN}),null)
  const bounded=C.validateCameraPose({...p,target:[1e100,-1e100,1e100],distance:1e100,pitch:1e100,yaw:-1e100,zoom:1e100,fov:-1e100})
  assert.equal(json(bounded),json({target:[12,-2,12],distance:220,yaw:-1.15,pitch:1.1,zoom:3,fov:35}))
  assert.equal(C.saveCameraPose(store,p),true);assert.equal(json(C.readCameraPose(store)),json(p))
  const blocked={getItem(){throw Error('SecurityError')},setItem(){throw Error('QuotaExceededError')},removeItem(){throw Error('SecurityError')}}
  assert.equal(C.readCameraPose(blocked),null);assert.equal(C.saveCameraPose(blocked,p),false);assert.equal(C.saveCameraPose(blocked,null),false)
  C.saveCameraPose(store,null);assert.equal(C.readCameraPose(store),null)
 })
 test('camera pan follows its right/up axes; zoom expands projection without changing camera position',()=>{
  const frame=C.cameraPoseFrame(p),camera=new THREE.PerspectiveCamera(p.fov,.7,.1,frame.far);camera.position.set(...frame.position);camera.lookAt(...p.target);camera.zoom=p.zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld()
  const before=new THREE.Vector3(2,3,0).project(camera).x;camera.zoom=2.5;camera.updateProjectionMatrix();close(new THREE.Vector3(2,3,0).project(camera).x,before*2)
  const moved=C.panCamera({...p,yaw:.6},1,1);assert.ok(moved.target[0]>0&&moved.target[1]>3&&moved.target[2]<0)
  assert.equal(json(C.cameraPoseFrame({...p,zoom:3}).position),json(frame.position))
 })
 test('one-finger move/angle and two-finger pinch rebase safely after up/cancel',()=>{
  let pose=p,mode='pan';const g=C.createCameraGesture(()=>pose,next=>pose=next,()=>mode,()=>550)
  g.down(1,100,100);g.move(1,120,100);assert.ok(pose.target[0]<0);g.cancel()
  mode='orbit';pose=p;g.down(1,100,100);g.move(1,120,120);close(pose.yaw,-.12);close(pose.pitch,.32)
  g.down(2,220,120);assert.equal(g.down(3,40,40),false);const prior=pose;g.move(2,270,120);close(pose.zoom,prior.zoom*1.5)
  g.up(2);const after=pose;g.move(1,120,120);assert.equal(json(pose),json(after),'pinch release must not jump')
  g.cancel();g.move(1,900,900);assert.equal(json(pose),json(after));g.down(8,NaN,1);g.move(8,1,1);assert.equal(json(pose),json(after))
 })
 const v=h.review,rt=h.rt,canvas=rt.canvas,snap=()=>json({position:rt.camera.position.toArray(),quaternion:rt.camera.quaternion.toArray(),zoom:rt.camera.zoom,fov:rt.camera.fov})
 const pointer=(type,id,x,y)=>canvas.dispatch(type,{pointerId:id,clientX:x,clientY:y})
 test('actual camera editing stops held feed and blocks all drop/aim/keyboard paths',()=>{
  v.beginFeed('keyboard');assert.equal(v.feed.current.active,true)
  v.editCamera();assert.equal(v.feed.current.active,false);assert.equal(v.lookRef.current,true);assert.equal(v.cameraPoseRef.current.zoom,1.25)
  const hand=v.cove.current.hand,aim=v.aim.current
  v.dropOne();v.beginFeed('pointer:3');v.tapDrop();h.win.dispatch('keydown',{code:'Space'});h.win.dispatch('keydown',{code:'ArrowRight'})
  h.advance(30);assert.equal(v.cove.current.hand,hand);assert.equal(v.aim.current,aim)
  pointer('pointerdown',1,180,180);pointer('pointermove',1,230,190);assert.notEqual(v.cameraPoseRef.current.target[0],0);assert.equal(v.aim.current,aim)
  const beforeCancel=json(v.cameraPoseRef.current);pointer('pointercancel',1,230,190);pointer('pointermove',1,300,100);assert.equal(json(v.cameraPoseRef.current),beforeCancel)
  pointer('pointerdown',1,180,180);pointer('pointerdown',2,280,180);pointer('pointermove',2,320,180);assert.ok(v.cameraPoseRef.current.zoom>1.25)
  const beforeLost=json(v.cameraPoseRef.current);pointer('lostpointercapture',2,320,180);pointer('pointermove',2,500,180);assert.equal(json(v.cameraPoseRef.current),beforeLost)
  h.win.dispatch('blur');pointer('pointermove',1,340,200);assert.equal(json(v.cameraPoseRef.current),beforeLost)
 })
 test('Lock freezes the exact production pose through tower growth, pointer input, feeding and resize',()=>{
  v.adjustCamera({yaw:.3,pitch:.22,zoom:1.6});rt.placeCamera();const chosen=snap();v.lockCamera();assert.equal(v.lookRef.current,false);rt.placeCamera();assert.equal(snap(),chosen)
  const P=h.load('src/store/pusher.ts');v.cove.current={...v.cove.current,bank:1500}
  h.advance(45);assert.equal(snap(),chosen,'tower growth cannot auto-fit custom camera')
  pointer('pointermove',1,800,800);canvas.dispatch('wheel',{deltaY:100});assert.equal(snap(),chosen)
  h.host.clientWidth=900;h.host.clientHeight=360;rt.resize();assert.equal(snap(),chosen,'orientation changes only aspect, never pose/fov/zoom')
  assert.equal(rt.camera.aspect,2.5);const auto=v.aim.current;h.win.dispatch('keydown',{code:'ArrowRight'});assert.equal(v.aim.current,auto);h.advance(6);assert.notEqual(v.aim.current,auto)
  v.dropOne();assert.equal(v.cove.current.dropped,2);rt.placeCamera();assert.equal(snap(),chosen)
  assert.equal(json(C.readCameraPose(h.storage)),json(v.cameraPoseRef.current))
 })
 test('Unlock is jump-free, Escape locks, preset preserves preference and fitting returns',()=>{
  rt.placeCamera();const locked=snap();v.editCamera();rt.placeCamera();assert.equal(snap(),locked)
  pointer('pointerdown',9,100,100);h.win.dispatch('keydown',{code:'Escape'});const after=json(v.cameraPoseRef.current);pointer('pointermove',9,350,350);assert.equal(json(v.cameraPoseRef.current),after);assert.equal(v.lookRef.current,false)
  v.editCamera();v.selectView(1);assert.equal(v.cameraPoseRef.current,null);assert.equal(v.lookRef.current,false);assert.ok(C.readCameraPose(h.storage),'preset preserves exact saved view for restoration')
  for(let i=0;i<160;i++)rt.placeCamera();assert.equal(rt.camera.zoom,1);assert.equal(rt.camera.fov,42)
  v.selectView(0);for(let i=0;i<160;i++)rt.placeCamera();close(rt.camera.position.y,1.7)
 })
 test('actual React control callbacks expose editing, zoom, position, lock and always-reachable reset',()=>{
  const nodes=(node,result=[])=>{if(!node||typeof node!=='object')return result;if(Array.isArray(node)){node.forEach(x=>nodes(x,result));return result}result.push(node);nodes(node.props?.children,result);return result}
  const find=predicate=>{const node=nodes(h.render()).find(predicate);assert.ok(node,'expected actual control');return node}
  find(n=>n.props?.className==='cove-camera-toggle').props.onClick();assert.equal(v.lookRef.current,true)
  assert.equal(find(n=>n.props?.className?.startsWith?.('cove-drop')).props.disabled,true)
  assert.equal(nodes(h.render()).some(n=>/Aim along|Drag the feed/.test(n.props?.['aria-label']||'')),false,'manual aim controls removed')
  find(n=>n.props?.['aria-label']==='Camera zoom').props.onChange({target:{value:'1.9'}});assert.equal(v.cameraPoseRef.current.zoom,1.9)
  const before=v.cameraPoseRef.current.target[1];find(n=>n.props?.['aria-label']==='Move camera up').props.onClick();assert.ok(v.cameraPoseRef.current.target[1]>before)
  find(n=>n.props?.className==='cove-camera-toggle').props.onClick();assert.equal(v.lookRef.current,false)
  assert.equal(nodes(h.render()).some(n=>n.props?.className==='cove-aim'),false)
  find(n=>n.props?.className==='cove-camera-toggle').props.onClick();find(n=>n.props?.['aria-label']==='Reset view to Tiered').props.onClick();assert.equal(v.cameraPoseRef.current,null)
 })
 v.editCamera();v.adjustCamera({zoom:2.1,pitch:.4,yaw:-.32});v.lockCamera();rt.placeCamera();const persisted=json(v.cameraPoseRef.current),position=rt.camera.position.toArray();h.cleanup()
 h=await start(820,380,{keepStorage:true})
 test('reload restores the locked pose at a new orientation without starting edit or saving the round',()=>{
  assert.equal(json(h.review.cameraPoseRef.current),persisted);assert.equal(h.review.lookRef.current,false);assert.equal(h.review.cove.current.hand,100)
  h.rt.camera.position.toArray().forEach((n,i)=>close(n,position[i]));assert.equal(h.rt.camera.zoom,2.1)
  h.review.editCamera();h.review.gestureStop.current();h.review.lockCamera();h.advance();assert.equal(json(h.review.cameraPoseRef.current),persisted)
 })
 h.cleanup();
 h=await start(390,427.8,{savedCamera:JSON.stringify({version:1,pose:p}),savedMode:false});
 test('old saved camera migrates to Tiered without erasing its exact pose',()=>{assert.equal(h.review.viewRef.current,4);assert.equal(h.review.cameraPoseRef.current,null);assert.equal(json(C.readCameraPose(h.storage)),json(p));h.review.restoreSavedView();assert.equal(json(h.review.cameraPoseRef.current),json(p));assert.equal(h.storage.getItem('kono-medal-cove.tier-view.v1'),'saved');h.review.selectView(4);assert.equal(h.review.cameraPoseRef.current,null);assert.equal(json(C.readCameraPose(h.storage)),json(p));h.review.restoreSavedView();assert.equal(json(h.review.cameraPoseRef.current),json(p))});
 h.cleanup();console.log(`${passed}/${passed} camera checks passed (CPU projection/production events, not GPU screenshots).`)
})().catch(e=>{console.error('FAIL',e);process.exit(1)})
