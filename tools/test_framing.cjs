// Pure camera geometry plus Three's own projection: runs without a WebGL device.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),THREE=require('three')
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:n=>n.startsWith('.')?load(path.relative(path.join(__dirname,'..'),path.resolve(__dirname,'..',path.dirname(file),n))+'.ts'):require(n),Math,Number,Array,Infinity});return module.exports}
const {MACHINE_BOUNDS,FRONT_BOUNDS,REFERENCE_BUILD_BOUNDS,FRONT_EYE_HEIGHT,CAMERA_VIEWS,frameBoundsForView,towerFramePoints,fitMachineFrame}=load('src/components/framing.ts')
const {towerSlots}=load('src/store/dispense.ts'),{CABINET:K,PUSHER_SHELF:S}=load('src/store/motion.ts'),{TOWER:T}=load('src/store/tower.ts')
let passed=0
function test(name,fn){fn();passed++;console.log('PASS '+name)}
function project(points,width,height,yaw,pitch){const fov=width/height<.8?49:42,fit=fitMachineFrame(points,width/height,fov,yaw,pitch,FRONT_EYE_HEIGHT),camera=new THREE.PerspectiveCamera(fov,width/height,.1,fit.far);camera.position.set(...fit.position);camera.lookAt(...fit.target);camera.updateMatrixWorld();return {fit,camera,points:points.map(p=>new THREE.Vector3(...p).project(camera))}}
test('full machine hull fits at portrait, short landscape, desktop and resize extremes',()=>{
 const viewports=[[320,290],[390,550],[430,650],[540,290],[1080,790],[1440,650],[320,950],[1600,260],[280,1400]]
 let checks=0
 for(const [w,h]of viewports)for(const view of CAMERA_VIEWS)for(const bank of [0,25,100,500,1500]){
  const bounds=[...MACHINE_BOUNDS,...towerFramePoints(towerSlots(bank),bank>25)]
  const p=project(bounds,w,h,view.yaw,view.pitch)
  for(const point of p.points){assert.ok(Math.abs(point.x)<=.965001,`width clip at ${w}x${h} bank ${bank}: ${point.x}`);assert.ok(Math.abs(point.y)<=.950001,`height clip at ${w}x${h} bank ${bank}: ${point.y}`);assert.ok(point.z<1&&point.z>-1,'visible depth')}
  checks++
 }
 console.log(' ',checks,'complete-hull projections verified')
})
test('camera dragging and transitions never crop the essential hull',()=>{
 const bounds=[...MACHINE_BOUNDS,...towerFramePoints(towerSlots(500),true)]
 for(const aspect of [.35,.7,1,2,5])for(let yaw=-1.38;yaw<=1.39;yaw+=.23)for(let pitch=-.08;pitch<1.11;pitch+=.17){
  const {points}=project(bounds,aspect*500,500,yaw,pitch)
  assert.ok(points.every(p=>Math.abs(p.x)<.966&&Math.abs(p.y)<.951))
 }
})
test('full-hull fitter still uses the short actual tower and improves on the older fixed target',()=>{
 const bounds=[...MACHINE_BOUNDS,...towerFramePoints(towerSlots(25))],yaw=0,pitch=.47
 const old=[[-5.6,-2.3,8.8],[5.6,-2.3,8.8],[-5.4,1.6,4.4],[5.4,1.6,4.4],[-6.2,6.9,-7.8],[6.2,6.9,-7.8],[-7.25,6.6,-5.25],[-7.25,2.5,-5.25],[7.25,3.2,-5.25],[-3.7,10.7,-6.65],[3.7,10.7,-6.65]]
 for(const [w,h]of [[390,550],[1080,790],[540,290]]){
  const {fit}=project(bounds,w,h,yaw,pitch),fov=w/h<.8?49:42,ty=Math.tan(fov*Math.PI/360),tx=ty*w/h,forward=new THREE.Vector3(0,Math.sin(pitch),Math.cos(pitch)),right=new THREE.Vector3(1,0,0),up=new THREE.Vector3().crossVectors(forward,right)
  let oldDistance=14
  for(const point of old){const p=new THREE.Vector3(...point).sub(new THREE.Vector3(0,2.7,-.8)),depth=p.dot(forward);oldDistance=Math.max(oldDistance,depth+Math.abs(p.dot(right))/(tx*.92),depth+Math.abs(p.dot(up))/(ty*.9))}
  const oldPosition=new THREE.Vector3(0,2.7,-.8).addScaledVector(forward,oldDistance)
  const oldDepth=oldPosition.dot(forward),ratio=fit.distance/oldDepth
  assert.ok(ratio<.96,`expected closer framing, got ${ratio}`)
  console.log(`  ${w}x${h}: camera depth ${(100*(1-ratio)).toFixed(1)}% closer`)
 }
})
test('Front stands at coin-bed eye level and looks up without cropping the tray',()=>{
 const front=CAMERA_VIEWS[0],tower=towerFramePoints(towerSlots(20)),frontBounds=frameBoundsForView(0,tower)
 assert.equal(front.yaw,0);assert.ok(front.pitch<0&&front.pitch>-.08,'Front actually looks slightly upward, not down from overhead')
 assert.equal(frontBounds.length,FRONT_BOUNDS.length+tower.length+REFERENCE_BUILD_BOUNDS.length)
 assert.ok(FRONT_BOUNDS.length<MACHINE_BOUNDS.length,'side equipment no longer forces the default camera back')
 const width=camera=>new THREE.Vector3(K.halfWidth,0,K.front).project(camera).x-new THREE.Vector3(-K.halfWidth,0,K.front).project(camera).x
 for(const [w,h]of [[1080,790],[540,290],[1440,650]]){
  const previous=project([...MACHINE_BOUNDS,...tower],w,h,0,.47),current=project(frontBounds,w,h,front.yaw,front.pitch)
  const ratio=width(current.camera)/width(previous.camera)
  assert.ok(ratio>.99,`bed-front width is retained at ${w}x${h}, got ${ratio}`)
  assert.ok(Math.abs(current.fit.position[1]-FRONT_EYE_HEIGHT)<1e-8,'eye-height constraint prevents an underwater camera')
  assert.ok(current.fit.target[1]>current.fit.position[1],'look-at target is above standing eye height')
  console.log(`  ${w}x${h}: front edge ${(100*(ratio-1)).toFixed(1)}% wider than previous default`)
 }
 // The external construction bay now shares the horizontal frame with the
 // tray. Keep that deliberate side-by-side layout, not the obsolete95% tray target.
 const portrait=project(frontBounds,390,550,front.yaw,front.pitch),priorPortrait=project([...MACHINE_BOUNDS,...tower],390,550,0,.47)
 // The nearer real tray now determines the width fit; the intentionally
 // narrower bed sits2.8 units behind it, so do not project the obsolete10.4 bed.
 const trayWidth=camera=>new THREE.Vector3(K.halfWidth+.1,-2.3,K.front+2.8).project(camera).x-new THREE.Vector3(-K.halfWidth-.1,-2.3,K.front+2.8).project(camera).x
 console.log('  external bay Front portrait tray occupancy',trayWidth(portrait.camera)/2);assert.ok(trayWidth(portrait.camera)>1.6,'external workshop framing retains at least80% portrait width for tray')
 assert.ok(width(portrait.camera)/trayWidth(portrait.camera)>.80,'bed front retains at least80% of projected tray width')
 assert.ok(trayWidth(portrait.camera)/trayWidth(priorPortrait.camera)>.80,'side workshop overview retains at least80% of previous catcher width')
})
test('Front retains shelf, input, front edge, tray and every bank column across responsive sizes',()=>{
 const essential=[[-S.width/2,.6,-4.6],[S.width/2,.6,-4.6],[-S.width/2,.6,-6.2],[S.width/2,.6,-6.2],[-K.halfWidth,0,K.front],[K.halfWidth,0,K.front],[-K.boardWidth/2,5.3,-6.15],[K.boardWidth/2,5.3,-6.15],...FRONT_BOUNDS]
 let checks=0
 for(const [w,h]of [[320,290],[390,550],[430,650],[540,290],[1080,790],[1440,650],[320,950],[1600,260],[280,1400]])for(const bank of [0,20,100,500,1500]){
  const tower=towerFramePoints(towerSlots(bank),bank>20),view=CAMERA_VIEWS[0],bounds=frameBoundsForView(0,tower)
  const {camera}=project(bounds,w,h,view.yaw,view.pitch)
  for(const p of [...essential,...tower]){const point=new THREE.Vector3(...p).project(camera);assert.ok(Math.abs(point.x)<.966&&Math.abs(point.y)<.951&&point.z>-1&&point.z<1,`Front clips essential point ${p} at ${w}x${h}, bank ${bank}`)}
  // Overview must restore the complete machine, not retain the Front crop.
  const overview=frameBoundsForView(1,tower)
  assert.equal(overview.length,MACHINE_BOUNDS.length+tower.length+REFERENCE_BUILD_BOUNDS.length)
  assert.equal(frameBoundsForView(0,tower).length,bounds.length,'returning to Front restores close bounds')
  checks++
 }
 console.log(' ',checks,'front-playfield and tower projections verified')
})
test('physical construction head, lowered stacks and opened support leaves remain in Front',()=>{
 const outerZ=T.leafHalfDepth*2+T.opening,top=T.buildTop+T.halfHeight+(T.rows-1)*T.pitch+T.headClearance+.1,points=[...[T.dockX-T.leafHalfWidth,T.dockX+T.leafHalfWidth].flatMap(x=>[T.releaseTop-T.leafHalfHeight*2,T.resetTop+T.leafHalfHeight].flatMap(y=>[T.z-outerZ,T.z+outerZ].map(z=>[x,y,z]))),[T.x-1.2,top,T.z-T.leafHalfDepth*2],[T.x+1.2,top,T.z+T.leafHalfDepth*2]]
 for(const [w,h]of [[320,180],[390,450],[430,650],[540,290],[1080,790],[1440,650]]){
  const view=CAMERA_VIEWS[0],bounds=frameBoundsForView(0,towerFramePoints(towerSlots(20))),{camera}=project(bounds,w,h,view.yaw,view.pitch)
  for(const p of points){const v=new THREE.Vector3(...p).project(camera);assert.ok(Math.abs(v.x)<.966&&Math.abs(v.y)<.951,`Construction geometry clipped at ${w}x${h}: ${p}`)}
 }
})
test('fullscreen is explicit, drawer is modal, and test controls consume no stage row',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../src/main.tsx'),'utf8'),scene=fs.readFileSync(path.join(__dirname,'../src/components/MedalCove.tsx'),'utf8'),css=fs.readFileSync(path.join(__dirname,'../src/standalone.css'),'utf8')
 assert.match(app,/requestFullscreen\(\)/);assert.match(app,/exitFullscreen\(\)/);assert.match(app,/fullscreenchange/);assert.match(app,/doesn’t support fullscreen/)
 assert.match(app,/<dialog/);assert.match(app,/showModal\(\)/);assert.match(app,/onCancel=/)
 assert.match(scene,/createPortal\(<section className="cove-game-tools"/)
 assert.match(scene,/document.querySelector\('dialog\[open\], \[aria-modal="true"\]'\)/)
 assert.match(css,/height:100dvh/);assert.match(css,/safe-area-inset-bottom/);assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/)
 assert.match(css,/\.medal-cove>\.cove-stage\.cove-stage\{[^}]*min-height:0/)
})
test('quiet Sanctuary art keeps original focal objects, without duplicated garden decoration or camera shake',()=>{
 const scene=fs.readFileSync(path.join(__dirname,'../src/components/MedalCove.tsx'),'utf8')
 assert.match(scene,/sprite\('tree-blossom'/);assert.match(scene,/sprite\('tree-leafy'/)
 assert.match(scene,/lighthouse\.position\.set/);assert.match(scene,/garden\/kono\/anim/)
 assert.doesNotMatch(scene,/sprite\('light-arch'|sprite\('lantern-post'|sprite\('paper-lanterns'|sprite\('butterfly'|sprite\('bird'/)
 assert.doesNotMatch(scene,/camera\.position\.add\(new THREE.Vector3\(\(Math.random/)
 assert.match(scene,/const SPARKS=120/);assert.match(scene,/Math.min\(18,Math.ceil\(n\*\.18\)\)/)
})
console.log(`${passed}/${passed} fullscreen/framing checks passed.`)
