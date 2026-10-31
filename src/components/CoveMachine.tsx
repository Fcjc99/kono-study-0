import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import * as THREE from 'three'
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js'
import RAPIER from '@dimforge/rapier3d-compat'
import {HALF,M,MACHINE_KEY,R,clearMachine,createMachine,readMachine,type Contact,type Machine,type Stage} from '../store/coveMachine'
import CoveFail,{type CoveFailure} from './CoveFail'
import {webglWorks} from './webgl'
import type {GameHandle} from './GameScreen'

/** Medal Cove's machine, the plain prototype (physics in store/coveMachine): no artwork yet, just the
 * shelf, the pile, the hole and the tower, to get the coins feeling right first.
 * The view is the machine from a little above the front; the controls sit under it: drag the slider to
 * move the chute, Drop to drop a medal (hold to keep dropping), and the camera button changes the view.
 * The machine is saved on this device (not synced) as it plays, so leaving and coming back finds it as it
 * was; it's cleared when the session ends, so nothing is paid twice. */
const VIEWS:{name:string;pos:number[];look:number[]}[]=[{name:'Front',pos:[0,6.0,7.2],look:[0,0.1,-0.7]},{name:'Above',pos:[0,9.5,3.6],look:[0,0,-1.2]},{name:'Side',pos:[6.2,4.4,5.2],look:[0,0.4,-0.8]}]
const STAGE_TEXT:Record<Stage,string>={build:'Building',release:'Guide sinking',lower:'Lowering',free:'On the field',raise:'New tower rising'}
export type MachineResult={hand:number;won:number;towers:number}

export default function CoveMachine({ref,sound,fresh,onEnd,onFail}:{ref:Ref<GameHandle>;sound:boolean;fresh:boolean;onEnd:(r:MachineResult)=>void;onFail:()=>void}){
 const host=useRef<HTMLDivElement>(null),machine=useRef<Machine|null>(null)
 const aim=useRef(0),wantDrop=useRef(false),holding=useRef(false),lastDrop=useRef(0)
 const [hud,setHud]=useState({hand:M.HAND,won:0,tower:0,feed:0,stage:'build' as Stage,towers:0})
 const [aimX,setAimX]=useState(0),[view,setView]=useState(0),viewRef=useRef(0)
 const [ready,setReady]=useState(false),[fail,setFail]=useState<CoveFailure|null>(null),[tries,setTries]=useState(0)
 const [gain,setGain]=useState<{id:number;n:number}|null>(null)
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound),freshRef=useRef(fresh)
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 useEffect(()=>{viewRef.current=view},[view])
 // Ending: the save goes first, then the result, so a reload can never pay the same medals again.
 const finish=()=>{if(ended.current)return;ended.current=true;const s=machine.current?.state;clearMachine();onEndRef.current({hand:s?.hand??0,won:s?.won??0,towers:s?.towers??0})}
 const finishRef=useRef(finish)
 useEffect(()=>{finishRef.current=finish})
 useImperativeHandle(ref,()=>({end:()=>finishRef.current()}),[])
 const save=()=>{const m=machine.current;if(!m||ended.current)return;try{localStorage.setItem(MACHINE_KEY,JSON.stringify(m.save()))}catch{/* storage full or off: play on unsaved */}}


 /** Builds the scene and the machine in `el`; returns how to take it all down. */
 function build(el:HTMLDivElement){
  const small=el.clientWidth<600
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})
  renderer.setPixelRatio(Math.min(small?1.75:2,window.devicePixelRatio||1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping
  el.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true')
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e4e9ef')
  const pmrem=new THREE.PMREMGenerator(renderer),envRT=pmrem.fromScene(new RoomEnvironment(),0.04);scene.environment=envRT.texture;pmrem.dispose()
  scene.add(new THREE.HemisphereLight('#ffffff','#8a8f99',0.7))
  const sun=new THREE.DirectionalLight('#ffffff',2.0);sun.position.set(3,10,6);sun.castShadow=true;sun.shadow.mapSize.set(small?1024:2048,small?1024:2048);sun.shadow.bias=-0.0004
  Object.assign(sun.shadow.camera,{left:-5,right:5,top:6,bottom:-6,near:1,far:25});scene.add(sun)
  const camera=new THREE.PerspectiveCamera(45,1,0.1,60)
  const std=(color:string,metalness=0.2,roughness=0.6,extra:THREE.MeshStandardMaterialParameters={})=>new THREE.MeshStandardMaterial({color,metalness,roughness,...extra})
  const box=(w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);b.position.set(x,y,z);b.castShadow=b.receiveShadow=true;scene.add(b);return b}
  // ---- The machine, plain: brushed steel deck, glass sides, the shelf, the tray, the tower's pedestal ----
  const {W,FRONT,BACK}=M
  const steel=std('#b9c0c8',0.75,0.38),dark=std('#5c636d',0.6,0.5),glass=new THREE.MeshPhysicalMaterial({color:'#dff2ff',transparent:true,opacity:.18,roughness:.05,depthWrite:false})
  box(2*W+0.2,0.4,FRONT-BACK,steel,0,-0.2,(FRONT+BACK)/2)
  const wallLen=FRONT-M.SIDE_OPEN-BACK,wallZ=(FRONT-M.SIDE_OPEN+BACK)/2
  for(const s of [-1,1]){const g=box(0.08,1.4,wallLen,glass,s*(W+0.1),0.7,wallZ);g.castShadow=false;box(0.14,0.1,wallLen,dark,s*(W+0.1),1.45,wallZ)}
  box(2*W+0.2,2.8,0.3,dark,0,1.2,BACK-0.15)
  box(2*W,1.0,0.2,dark,0,M.SHELF_TOP+0.56,M.SCRAPER_Z)
  box(2*W+0.4,0.3,2.2,dark,0,-1.85,FRONT+1.4);box(2*W+0.8,1.0,0.2,dark,0,-1.4,FRONT+2.6)
  for(const s of [-1,1])box(0.2,1.0,2.2,dark,s*(W+0.3),-1.4,FRONT+1.4)
  // The front edge, picked out so you can see how close things are to falling.
  box(2*W+0.2,0.03,0.06,std('#f2c230',0.3,0.4,{emissive:'#6a4a00'}),0,0.005,FRONT-0.03).castShadow=false
  // The shelf, with the hole riding on it.
  const shelf=box(2*W-0.04,M.SHELF_TOP,M.SHELF_DEPTH,std('#8aa4bf',0.55,0.35),0,M.SHELF_TOP/2,0)
  const holeMat=new THREE.MeshBasicMaterial({color:'#1b1f26'}),holeRing=new THREE.MeshStandardMaterial({color:'#f2c230',metalness:.6,roughness:.3,emissive:'#f2a200',emissiveIntensity:.2})
  const hole=new THREE.Mesh(new THREE.CircleGeometry(M.HOLE_R-0.04,32),holeMat);hole.rotation.x=-Math.PI/2;hole.position.set(0,M.SHELF_TOP/2+0.003,M.SHELF_DEPTH/2-M.HOLE_OFF);shelf.add(hole)
  const ring=new THREE.Mesh(new THREE.TorusGeometry(M.HOLE_R-0.02,0.03,8,40),holeRing);ring.rotation.x=-Math.PI/2;ring.position.copy(hole.position);shelf.add(ring)
  // The tower's pedestal (it sinks flush with the deck) and the guide's rods and top ring.
  const ped=new THREE.Mesh(new THREE.CylinderGeometry(M.PED_R,M.PED_R,0.6,32),std('#d9a441',0.5,0.4));ped.castShadow=ped.receiveShadow=true;scene.add(ped)
  const pedRim=new THREE.Mesh(new THREE.RingGeometry(M.PED_R,M.PED_R+0.06,40),new THREE.MeshBasicMaterial({color:'#3a3f47'}));pedRim.rotation.x=-Math.PI/2;pedRim.position.set(0,0.002,M.TZ);scene.add(pedRim)
  const guide=new THREE.Group();scene.add(guide)
  const rodMat=std('#eef2f6',0.9,0.2)
  for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4,r=new THREE.Mesh(new THREE.CylinderGeometry(M.ROD_R,M.ROD_R,M.ROD_LEN,10),rodMat);r.position.set(Math.cos(a)*M.ROD_AT,0,Math.sin(a)*M.ROD_AT);r.castShadow=true;guide.add(r)}
  const crown=new THREE.Mesh(new THREE.TorusGeometry(M.ROD_AT,0.035,8,40),rodMat);crown.rotation.x=Math.PI/2;crown.position.y=M.ROD_LEN/2;guide.add(crown)
  // The feeder over the tower, and the chute that follows your aim (with where it'll land marked on the shelf).
  const feeder=new THREE.Mesh(new THREE.CylinderGeometry(M.ROD_AT+0.06,M.ROD_AT+0.06,0.32,32,1,true),new THREE.MeshStandardMaterial({color:'#5c636d',metalness:.6,roughness:.4,transparent:true,opacity:.45,side:THREE.DoubleSide,depthWrite:false}));feeder.position.set(0,M.PED_UP+3.2,M.TZ);scene.add(feeder)
  const chute=box(0.9,0.35,0.5,std('#f2c230',0.6,0.35),0,M.DROP_Y+0.35,M.DROP_Z)
  const mark=new THREE.Mesh(new THREE.RingGeometry(R*0.9,R*1.05,40),new THREE.MeshBasicMaterial({color:'#ff5a7a',transparent:true,opacity:.85}));mark.rotation.x=-Math.PI/2;scene.add(mark)
  const line=new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.01,M.DROP_Y-M.SHELF_TOP,6),new THREE.MeshBasicMaterial({color:'#ff5a7a',transparent:true,opacity:.35}));scene.add(line)
  // Medals: gold faces, a darker milled edge, so you can see their thickness.
  const capTex=coinFace()
  const coins=new THREE.InstancedMesh(new THREE.CylinderGeometry(R,R,HALF*2,32),[std('#b88a1e',1,0.45),new THREE.MeshStandardMaterial({color:'#ffd65a',metalness:1,roughness:.3,map:capTex}),new THREE.MeshStandardMaterial({color:'#ffd65a',metalness:1,roughness:.3,map:capTex})],M.MAX)
  coins.castShadow=coins.receiveShadow=true;coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);coins.frustumCulled=false;scene.add(coins)

  // ---- The machine itself ----
  const m=createMachine(RAPIER,freshRef.current?null:readMachine())
  machine.current=m
  if(freshRef.current){clearMachine();freshRef.current=false}

  // ---- Camera: three fixed views, eased between; never moved by aiming ----
  const camPos=new THREE.Vector3().fromArray(VIEWS[0].pos),camLook=new THREE.Vector3().fromArray(VIEWS[0].look),wantPos=new THREE.Vector3(),wantLook=new THREE.Vector3()
  const fit=()=>{const v=VIEWS[viewRef.current];wantLook.fromArray(v.look);wantPos.fromArray(v.pos)
   // On a narrow (portrait) screen, step back far enough to see the whole width of the machine.
   const hfov=2*Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect),need=(W+1.5)/Math.tan(hfov/2),d=wantPos.distanceTo(wantLook)
   if(need>d)wantPos.sub(wantLook).multiplyScalar(need/d).add(wantLook)}
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w/h<0.8?55:45;camera.updateProjectionMatrix()}
  resize();fit();camPos.copy(wantPos);const ro=new ResizeObserver(resize);ro.observe(el)

  // ---- Sound: three kinds of contact, made here (no files) ----
  let ac:AudioContext|null=null
  const lastSound={metal:0,coin:0,tray:0,any:0}
  const clink=(kind:Contact['kind']|'hole'|'feed',force:number)=>{
   if(!soundRef.current)return
   try{ac??=new AudioContext()}catch{return}
   if(ac.state==='suspended')void ac.resume()
   const now=ac.currentTime,vol=Math.min(0.22,0.03+Math.log10(1+force/30)*0.12)
   const ping=(freq:number,decay:number,at=0,v=vol)=>{const o=ac!.createOscillator(),g=ac!.createGain();o.type='sine';o.frequency.value=freq*(0.97+Math.random()*0.06);g.gain.setValueAtTime(v,now+at);g.gain.exponentialRampToValueAtTime(0.0001,now+at+decay);o.connect(g).connect(ac!.destination);o.start(now+at);o.stop(now+at+decay+0.02)}
   if(kind==='metal'){ping(2900,0.16);ping(4300,0.08,0,vol*0.5)}          // a coin on steel: a ring
   else if(kind==='coin'){ping(5200,0.05);ping(6900,0.04,0.004,vol*0.6)}  // coin on coins: a short bright chink
   else if(kind==='tray'){ping(1900,0.12);ping(2500,0.08,0.05,vol*0.6);ping(2100,0.06,0.1,vol*0.4)} // into the tray: a rattle
   else if(kind==='hole'){ping(880,0.18,0,0.12);ping(1320,0.2,0.08,0.1)}
   else{ping(3300,0.1,0,0.08)}}
  const buzz=(ms:number)=>{try{navigator.vibrate?.(ms)}catch{/* no vibration */}}
  let lastBuzz=0

  // ---- Keys: ←/→ move the chute, Space drops ----
  const key=(e:KeyboardEvent)=>{
   if(e.code==='ArrowLeft'||e.code==='ArrowRight'){e.preventDefault();aim.current=Math.max(-W+0.35,Math.min(W-0.35,aim.current+(e.code==='ArrowLeft'?-0.15:0.15)));setAimX(aim.current)}
   else if(e.code==='Space'){e.preventDefault();wantDrop.current=true}}
  window.addEventListener('keydown',key)
  const hide=()=>{if(document.visibilityState==='hidden')save()}
  document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',save)
  setReady(true)

  // ---- The loop: the physics at a steady 60 steps a second (up to 3 per frame; slower devices slow down) ----
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),v3=new THREE.Vector3(),one=new THREE.Vector3(1,1,1)
  let raf=0,last=performance.now(),acc=0,lastHud=0,gainN=0,gainAt=0,holeFlash=0,quietFor=0,saveAt=0
  const loop=(now:number)=>{
   acc+=Math.min(100,now-last);last=now
   let steps=0
   while(acc>=1000/60&&steps<3){steps++;acc-=1000/60
    let dropX:number|null=null
    if((wantDrop.current||(holding.current&&now-lastDrop.current>280))&&m.state.hand>0&&!ended.current){dropX=aim.current;wantDrop.current=false;lastDrop.current=now}
    else wantDrop.current=false
    const e=m.step(dropX)
    if(e.won){gainN+=e.won;gainAt=now}
    if(e.caught){holeFlash=1;clink('hole',0)}
    if(e.fed)clink('feed',0)
    // Contacts: the strongest of each kind this step, a few times a second at most.
    const t=performance.now()
    for(const kind of ['tray','metal','coin'] as const){const strongest=e.contacts.filter(c=>c.kind===kind).reduce((a,c)=>Math.max(a,c.force),0)
     if(strongest>(kind==='coin'?45:35)&&t-lastSound[kind]>(kind==='tray'?50:70)&&t-lastSound.any>25){lastSound[kind]=lastSound.any=t;clink(kind,strongest)
      if(strongest>220&&t-lastBuzz>140){lastBuzz=t;buzz(kind==='tray'?4:6)}}}
   }
   if(acc>1000/60*3)acc=0
   const s=m.state
   // The collection shows only once it's actually happened, added up over a moment.
   if(gainN&&now-gainAt>500){const n=gainN;gainN=0;setGain({id:now,n})}
   // Draw the machine where the physics has it.
   const face=m.face();shelf.position.set(0,M.SHELF_TOP/2,face-M.SHELF_DEPTH/2)
   holeFlash=Math.max(0,holeFlash-0.03);holeRing.emissiveIntensity=0.2+holeFlash*2.5
   const {pedTop,rodTop}=m.poses();ped.position.set(0,pedTop-0.3,M.TZ);guide.position.set(0,rodTop-M.ROD_LEN/2,M.TZ);guide.visible=rodTop>0.05
   const ax=aim.current;chute.position.x=ax;mark.position.set(ax,M.SHELF_TOP+0.004,M.DROP_Z);line.position.set(ax,(M.DROP_Y+M.SHELF_TOP)/2,M.DROP_Z)
   mark.visible=line.visible=chute.visible=s.hand>0
   let n=0
   for(const p of m.pieces.values()){if(n>=M.MAX)break;const tr=p.body.translation(),r=p.body.rotation();m4.compose(v3.set(tr.x,tr.y,tr.z),q.set(r.x,r.y,r.z,r.w),one);coins.setMatrixAt(n++,m4)}
   coins.count=n;coins.instanceMatrix.needsUpdate=true
   fit();camPos.lerp(wantPos,0.08);camLook.lerp(wantLook,0.08);camera.position.copy(camPos);camera.lookAt(camLook)
   renderer.render(scene,camera)
   if(now-lastHud>150){lastHud=now;setHud(h=>h.hand===s.hand&&h.won===s.won&&h.tower===s.tower&&h.feed===s.feed&&h.stage===s.stage&&h.towers===s.towers?h:{hand:s.hand,won:s.won,tower:s.tower,feed:s.feed,stage:s.stage,towers:s.towers})}
   // Kept on this device every couple of seconds; the session ends a few seconds after the last medal settles.
   if(now-saveAt>2000){saveAt=now;save()}
   if(s.hand<=0&&m.quiet()){quietFor+=1;if(quietFor>180)finishRef.current()}else quietFor=0
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{save();cancelAnimationFrame(raf);ro.disconnect();window.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',save)
   void ac?.close();m.free();machine.current=null
   scene.traverse(o=>{const x=o as THREE.Mesh;x.geometry?.dispose?.();const mat=x.material as THREE.Material|THREE.Material[]|undefined;(Array.isArray(mat)?mat:mat?[mat]:[]).forEach(y=>{(y as THREE.MeshStandardMaterial).map?.dispose();y.dispose()})})
   envRT.dispose();renderer.dispose();renderer.domElement.remove()}
 }

 useEffect(()=>{
  const el=host.current;if(!el)return
  let disposed=false,gaveUp=false,cleanup=()=>{}
  const timer=window.setTimeout(()=>{if(!machine.current&&!disposed){gaveUp=true;setFail('slow')}},15000)
  RAPIER.init().then(()=>{
   if(disposed||gaveUp)return
   if(!webglWorks()){setFail('webgl');return}
   try{cleanup=build(el)}catch{el.querySelectorAll('canvas').forEach(c=>c.remove());machine.current?.free();machine.current=null;setFail('webgl')}
  },()=>{if(!disposed&&!gaveUp)setFail('physics')})
  return ()=>{disposed=true;window.clearTimeout(timer);cleanup()}
  // eslint-disable-next-line react-hooks/exhaustive-deps -- builds once per try
 },[tries])
 useEffect(()=>{if(!gain)return;const t=window.setTimeout(()=>setGain(null),1400);return()=>window.clearTimeout(t)},[gain])
 const moveAim=(v:number)=>{aim.current=v;setAimX(v)}
 const retry=()=>{setFail(null);setReady(false);setTries(n=>n+1)}
 const layers=Math.floor(hud.tower/2),full=M.TOWER_FULL/2
 return <div className="break-game cove-machine">
  <div ref={host} className="cove-stage is-plain" role="img" aria-label={'Medal machine: '+hud.hand+' medals in hand, tower '+layers+' of '+full+' layers'}>
   {!ready&&!fail&&<p className="cove-loading" role="status">Starting the machine…</p>}
   {fail&&<CoveFail kind={fail} onRetry={retry} onLeave={onFail}/>}
   {gain&&<b key={gain.id} className={'cove-gain'+(gain.n>=8?' is-big':'')} aria-hidden="true">+{gain.n}</b>}
  </div>
  <div className="cove-controls" aria-label="Machine controls">
   <p className="cove-status" role="status" aria-live="off">
    <span><b>🪙 {hud.hand}</b> in hand</span>
    <span><b>{hud.won}</b> collected</span>
    <span className="cove-tower-meter" aria-label={'Tower: '+layers+' of '+full+' layers, '+STAGE_TEXT[hud.stage]}>🗼 {hud.stage==='build'?<><b>{layers}</b>/{full} layers{hud.feed>0?' ＋':''}</>:STAGE_TEXT[hud.stage]}</span>
   </p>
   <label className="cove-aim"><span className="sr-only">Drop position</span>
    <input type="range" min={-M.W+0.35} max={M.W-0.35} step={0.01} value={aimX} onChange={e=>moveAim(Number(e.target.value))} aria-valuetext={aimX<-0.4?'left':aimX>0.4?'right':'middle'}/>
   </label>
   <span className="cove-buttons">
    <button type="button" className="cove-view-button" onClick={()=>setView(v=>(v+1)%VIEWS.length)} aria-label={'Camera: '+VIEWS[view].name+'. Change view'}>🎥 {VIEWS[view].name}</button>
    <button type="button" className="cove-drop" disabled={!ready||hud.hand<=0}
     onPointerDown={e=>{e.currentTarget.setPointerCapture?.(e.pointerId);wantDrop.current=true;holding.current=true;lastDrop.current=performance.now()}}
     onPointerUp={()=>{holding.current=false}} onPointerCancel={()=>{holding.current=false}}
     onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();wantDrop.current=true}}}>Drop</button>
   </span>
   <small className="cove-device-note">Saved on this device only (not synced). The hole on the shelf builds the tower; time your drop as it passes under the chute.</small>
  </div>
 </div>
}

function coinFace(){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!
 const grad=g.createRadialGradient(54,48,6,64,64,64);grad.addColorStop(0,'#fff3b0');grad.addColorStop(.6,'#f2c230');grad.addColorStop(1,'#b8860b');g.fillStyle=grad;g.fillRect(0,0,128,128)
 g.strokeStyle='rgba(140,90,10,.7)';g.lineWidth=5;g.beginPath();g.arc(64,64,44,0,Math.PI*2);g.stroke();g.fillStyle='rgba(140,90,10,.75)';g.font='bold 44px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText('K',64,66)
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
