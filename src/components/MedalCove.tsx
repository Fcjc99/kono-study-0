import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import * as THREE from 'three'
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js'
import {CHANCE_POCKETS,DISH,FIELD,busy,drop,isWinPocket,newCove,step,type Cove,type Reel} from '../store/pusher'
import {gameSound} from '../konoSounds'
import {fx} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'

/** KONO Medal Cove (rules in store/pusher), in 3D: a medal pusher cabinet on KONO's dock. The pile, the
 * sliding pusher with its lantern, prize balls and medal towers are real 3D pieces you can look around
 * (drag off the field to turn the view, or tap 🎥 for the next camera). Touch the field to aim and tap to
 * drop a medal (hold to keep dropping), or ← → and Space. Medals drop in from the chute, tumble off the
 * front into the tray (or off the side drops), and the ball lottery dish and the Jackpot Chance wheel rise
 * up in front of the cabinet when they're on. The backboard above shows the jackpot, the reels, the
 * lighthouse's steps and the wheel's winning pockets. */
const U=0.1 // world units per field unit
const MAX=900 // medals drawn at once (the pile, falling ones and towers)
const wx=(x:number)=>(x-50)*U,wz=(y:number)=>y*U-6
const REEL_FACES:Reel[]=['🪙','🗼','🔮','⭐','🐚','🌺']
const VIEWS=[{yaw:0,pitch:0.62,dist:12.5},{yaw:0,pitch:1.05,dist:12},{yaw:0.55,pitch:0.5,dist:12.5},{yaw:-0.55,pitch:0.5,dist:12.5}]

type Fall={x:number;y:number;z:number;vx:number;vy:number;vz:number;rx:number;rz:number;sx:number;sz:number;ball:boolean;t:number}

export default function MedalCove({ref,best,sound,onEnd}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;onEnd:(medals:number,jackpots:number)=>void}){
 const [start]=useState<Cove>(()=>newCove())
 const cove=useRef<Cove>(start),host=useRef<HTMLDivElement>(null),aim=useRef(50),holding=useRef(false),lastDrop=useRef(0)
 const [hud,setHud]=useState({hand:start.hand,jp:start.jackpot,steps:0,pockets:1,queue:0,event:'',reels:['🌺','🌺','🌺'] as string[],spinning:false})
 const [view,setView]=useState(0),viewRef=useRef(0),hudReels=useRef<string[]>(['🌺','🌺','🌺'])
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound),quiet=useRef(0)
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 useEffect(()=>{viewRef.current=view},[view])
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;onEndRef.current(cove.current.hand,cove.current.jpWins)}}),[])
 const dropOne=()=>{const c=cove.current;if(ended.current||c.hand<=0)return;cove.current=drop(c,aim.current);lastDrop.current=performance.now();fx('tick',soundRef.current)}
 const dropRef=useRef(dropOne)
 useEffect(()=>{dropRef.current=dropOne})

 useEffect(()=>{
  const el=host.current;if(!el)return
  // ---- The scene ----
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false})
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap
  renderer.outputColorSpace=THREE.SRGBColorSpace
  el.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true')
  const scene=new THREE.Scene();scene.background=new THREE.Color('#2f7fc8');scene.fog=new THREE.Fog('#2f7fc8',18,34)
  const camera=new THREE.PerspectiveCamera(42,1,0.1,80)
  // A soft room to reflect, so the medals shine gold instead of looking dark.
  const pmrem=new THREE.PMREMGenerator(renderer),envRT=pmrem.fromScene(new RoomEnvironment(),0.04);scene.environment=envRT.texture;pmrem.dispose()
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05
  scene.add(new THREE.HemisphereLight('#dff3ff','#4a3424',0.8))
  const sun=new THREE.DirectionalLight('#fff4dc',2.2);sun.position.set(4,12,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024)
  Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:30});scene.add(sun)
  const lamp=new THREE.PointLight('#ffcf6a',4,6);scene.add(lamp)
  // The cabinet: a wooden dock deck, glass sides, a back wall, the tray and the sea under it.
  const wood=woodTexture();const deckMat=new THREE.MeshStandardMaterial({map:wood,roughness:.8})
  const deck=new THREE.Mesh(new THREE.BoxGeometry(10.4,0.4,12.2),deckMat);deck.position.set(0,-0.2,0);deck.receiveShadow=true;scene.add(deck)
  const frameMat=new THREE.MeshStandardMaterial({color:'#5b3a24',roughness:.7})
  const glass=new THREE.MeshPhysicalMaterial({color:'#cfefff',transparent:true,opacity:.18,roughness:.05,metalness:0})
  for(const s of [-1,1]){const g=new THREE.Mesh(new THREE.BoxGeometry(0.12,1.2,10.4),glass);g.position.set(s*5.15,0.6,-0.9);scene.add(g)
   const rail=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.18,12.2),frameMat);rail.position.set(s*5.2,1.25,0);scene.add(rail)}
  const back=new THREE.Mesh(new THREE.BoxGeometry(10.8,2.4,0.4),frameMat);back.position.set(0,1.0,-7.0);back.castShadow=true;scene.add(back)
  const tray=new THREE.Mesh(new THREE.BoxGeometry(10.4,0.3,2.2),frameMat);tray.position.set(0,-2.1,7.3);tray.receiveShadow=true;scene.add(tray)
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:'#1d5f9e',roughness:.4}));sea.rotation.x=-Math.PI/2;sea.position.y=-3;scene.add(sea)
  // The side drops near the front: dark slots in the deck.
  for(const s of [-1,1]){const d=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.42,1.6),new THREE.MeshStandardMaterial({color:'#10283f'}));d.position.set(s*4.95,-0.19,wz(FIELD.h-8));scene.add(d)}
  // The pusher: a painted block sliding in and out, with the lantern on its face.
  const pusherMat=new THREE.MeshStandardMaterial({color:'#2f6fb3',roughness:.45})
  const pusher=new THREE.Mesh(new THREE.BoxGeometry(10.2,0.62,6),pusherMat);pusher.castShadow=true;pusher.receiveShadow=true;scene.add(pusher)
  const pusherTop=new THREE.Mesh(new THREE.BoxGeometry(10.2,0.06,6),new THREE.MeshStandardMaterial({color:'#e8f4ff',roughness:.6}));scene.add(pusherTop)
  const lantern=new THREE.Mesh(new THREE.BoxGeometry(FIELD.checkerW*U,0.36,0.08),new THREE.MeshStandardMaterial({color:'#ffcf3d',emissive:'#ff9d00',emissiveIntensity:1.2}));scene.add(lantern)
  // The chute: where the next medal will drop, following your aim.
  const chute=new THREE.Mesh(new THREE.CylinderGeometry(FIELD.r*U,FIELD.r*U,0.12,28),new THREE.MeshStandardMaterial({color:'#f2c230',metalness:.85,roughness:.3,emissive:'#4a3000'}));chute.rotation.x=Math.PI/2;scene.add(chute)
  const guide=new THREE.Mesh(new THREE.PlaneGeometry(0.05,1),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.6}));scene.add(guide)
  // Medals and balls: one instanced mesh each.
  const coinGeo=new THREE.CylinderGeometry(FIELD.r*U,FIELD.r*U,0.11,26)
  const coinMat=new THREE.MeshStandardMaterial({color:'#ffd24a',metalness:1,roughness:.32,map:coinFace(),envMapIntensity:1.3})
  const coins=new THREE.InstancedMesh(coinGeo,coinMat,MAX);coins.castShadow=true;coins.receiveShadow=true;coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(coins)
  const balls=new THREE.InstancedMesh(new THREE.SphereGeometry(FIELD.ball*U,24,16),new THREE.MeshPhysicalMaterial({color:'#9d6bff',roughness:.15,clearcoat:1,emissive:'#3a1880',emissiveIntensity:.4}),12);balls.castShadow=true;scene.add(balls)
  // The ball lottery dish and the Jackpot Chance wheel, waiting out of sight until they're on.
  const bonus=new THREE.Group();scene.add(bonus)
  const shade=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshBasicMaterial({color:'#081428',transparent:true,opacity:0,depthWrite:false}));scene.add(shade)
  const dishGroup=new THREE.Group();bonus.add(dishGroup)
  const dishGeo=new THREE.LatheGeometry([0,0.5,1,1.5,1.9,2.1].map((r,i)=>new THREE.Vector2(r,i===5?0.55:0.04*i*i)),48)
  const dish=new THREE.Mesh(dishGeo,new THREE.MeshStandardMaterial({map:dishTexture(),side:THREE.DoubleSide,roughness:.5}));dishGroup.add(dish)
  const dishBall=new THREE.Mesh(new THREE.SphereGeometry(0.2,24,16),new THREE.MeshPhysicalMaterial({color:'#9d6bff',roughness:.15,clearcoat:1}));dishGroup.add(dishBall)
  const wheelGroup=new THREE.Group();bonus.add(wheelGroup)
  const wheelTex={tex:new THREE.CanvasTexture(document.createElement('canvas')),pockets:-1}
  const wheel=new THREE.Mesh(new THREE.CylinderGeometry(2.3,2.3,0.25,64),[new THREE.MeshStandardMaterial({color:'#3a1d6e'}),new THREE.MeshStandardMaterial({map:wheelTex.tex}),new THREE.MeshStandardMaterial({color:'#3a1d6e'})]);wheel.rotation.x=Math.PI/2;wheelGroup.add(wheel)
  const pointer=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.5,16),new THREE.MeshStandardMaterial({color:'#fff',emissive:'#ffd34d',emissiveIntensity:.6}));pointer.rotation.z=Math.PI;pointer.position.set(0,2.55,0.2);wheelGroup.add(pointer)
  dishGroup.visible=false;wheelGroup.visible=false
  // ---- Camera: one of four views, nudged by dragging off the field ----
  const orbit={yaw:VIEWS[0].yaw,pitch:VIEWS[0].pitch,dist:VIEWS[0].dist,dragYaw:0,dragPitch:0}
  const placeCamera=()=>{const v=VIEWS[viewRef.current]
   orbit.yaw+=(v.yaw+orbit.dragYaw-orbit.yaw)*0.12;orbit.pitch+=(Math.max(0.25,Math.min(1.25,v.pitch+orbit.dragPitch))-orbit.pitch)*0.12;orbit.dist+=(v.dist-orbit.dist)*0.12
   camera.position.set(Math.sin(orbit.yaw)*Math.cos(orbit.pitch)*orbit.dist,Math.sin(orbit.pitch)*orbit.dist,Math.cos(orbit.yaw)*Math.cos(orbit.pitch)*orbit.dist+0.5);camera.lookAt(0,0,0.8)}
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w/h<0.8?52:42;camera.updateProjectionMatrix()}
  resize();const ro=new ResizeObserver(resize);ro.observe(el)
  // ---- Touch: aim and drop on the field; drag elsewhere to look around ----
  const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3()
  const fieldAt=(e:PointerEvent)=>{const r=renderer.domElement.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera);return ray.ray.intersectPlane(plane,hit)&&Math.abs(hit.x)<5.4&&hit.z>-7.5&&hit.z<6.4?hit:null}
  let drag:{x:number;y:number;yaw:number;pitch:number}|null=null
  const down=(e:PointerEvent)=>{renderer.domElement.setPointerCapture?.(e.pointerId);const p=fieldAt(e)
   if(p){aim.current=Math.max(4,Math.min(96,p.x/U+50));holding.current=true;dropRef.current()}else drag={x:e.clientX,y:e.clientY,yaw:orbit.dragYaw,pitch:orbit.dragPitch}}
  const move=(e:PointerEvent)=>{if(drag){orbit.dragYaw=Math.max(-0.9,Math.min(0.9,drag.yaw-(e.clientX-drag.x)/180));orbit.dragPitch=Math.max(-0.4,Math.min(0.5,drag.pitch+(e.clientY-drag.y)/220));return}
   const p=fieldAt(e);if(p)aim.current=Math.max(4,Math.min(96,p.x/U+50))}
  const up=()=>{holding.current=false;drag=null}
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up)
  const key=(e:KeyboardEvent)=>{
   if(e.code==='ArrowLeft'||e.code==='KeyA'){aim.current=Math.max(4,aim.current-3);e.preventDefault()}
   else if(e.code==='ArrowRight'||e.code==='KeyD'){aim.current=Math.min(96,aim.current+3);e.preventDefault()}
   else if(e.code==='Space'){e.preventDefault();dropRef.current()}
  }
  window.addEventListener('keydown',key)
  // ---- What's drawn besides the machine's own state: drops falling in, medals tumbling off ----
  const seen=new Map<number,{x:number;y:number;ball:boolean;born:number}>(),falls:Fall[]=[]
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e3=new THREE.Euler(),v3=new THREE.Vector3(),s3=new THREE.Vector3(1,1,1)
  const tilt=(id:number)=>((id*9301+49297)%233280)/233280-0.5
  let raf=0,last=performance.now(),acc=0,lastHud=0
  const loop=(now:number)=>{
   acc+=Math.min(100,now-last);last=now
   while(acc>=1000/60){
    const before=cove.current
    let c=step(before)
    if(holding.current&&now-lastDrop.current>200&&c.hand>0){c=drop(c,aim.current);lastDrop.current=now}
    cove.current=c;acc-=1000/60
    if(c.won>before.won)fx('ding',soundRef.current)
    const ev=c.events[c.events.length-1];if(ev&&ev!==before.events[before.events.length-1]){setHud(h=>({...h,event:ev.text}));if(/JACKPOT!/.test(ev.text)){fx('mega',soundRef.current);gameSound('win',soundRef.current)}else if(/CHANCE|tower|shower|ball/i.test(ev.text))fx('fanfare',soundRef.current)}
    if(c.spinning&&!before.spinning)fx('charge',soundRef.current)
    // Medals that left the field since last frame tumble on from where they were.
    const ids=new Set(c.medals.map(m=>m.id))
    for(const [id,s] of seen)if(!ids.has(id)){const front=s.y>FIELD.h-3;falls.push({x:wx(s.x),y:s.ball?FIELD.ball*U:0.06,z:wz(s.y),vx:front?0:(s.x<50?-0.03:0.03),vy:0,vz:front?0.05:0.01,rx:0,rz:0,sx:(Math.random()-.5)*0.3,sz:front?0.25:0.1,ball:s.ball,t:0});seen.delete(id)}
    for(const m of c.medals){const s=seen.get(m.id);if(s){s.x=m.x;s.y=m.y}else seen.set(m.id,{x:m.x,y:m.y,ball:!!m.ball,born:c.frame})}
    for(const f of falls){f.t++;f.vy-=0.012;f.x+=f.vx;f.y+=f.vy;f.z+=f.vz;f.rx+=f.sz;f.rz+=f.sx;if(f.y<-1.95&&f.z>6.2){f.y=-1.95;f.vy=Math.abs(f.vy)*0.2;f.vz*=0.5;f.sx*=0.5;f.sz*=0.5}}
    for(let i=falls.length-1;i>=0;i--)if(falls[i].t>110||falls[i].y<-3.2)falls.splice(i,1)
   }
   const c=cove.current,f=c.frame
   // The machine.
   const pz=wz(c.pusher);pusher.position.set(0,0.31,pz-3);pusherTop.position.set(0,0.65,pz-3)
   lantern.position.set(wx(c.checker),0.33,pz+0.02);lamp.position.set(wx(c.checker),0.8,pz+0.5)
   ;(lantern.material as THREE.MeshStandardMaterial).emissiveIntensity=1+0.6*Math.sin(f/5)
   const ax=wx(aim.current);chute.position.set(ax,1.25+Math.sin(f/12)*0.04,pz+FIELD.r*U+0.05);guide.position.set(ax,0.7,pz+FIELD.r*U+0.05);guide.lookAt(camera.position.x,0.7,camera.position.z)
   chute.visible=c.hand>0;guide.visible=c.hand>0
   // The pile, towers rising, and medals tumbling off.
   let n=0,b=0
   for(const m of c.medals){if(n>=MAX)break
    const s=seen.get(m.id),age=s?f-s.born:99,fallIn=age<16?(1-age/16)**2*1.2:0
    if(m.ball){if(b<12){m4.compose(v3.set(wx(m.x),FIELD.ball*U+fallIn,wz(m.y)),q.identity(),s3);balls.setMatrixAt(b++,m4)}continue}
    const t=tilt(m.id);e3.set(t*0.12,t*6,t*0.1);q.setFromEuler(e3)
    m4.compose(v3.set(wx(m.x),0.06+fallIn+Math.max(0,t)*0.05,wz(m.y)),q,s3);coins.setMatrixAt(n++,m4)}
   for(const tw of c.towers){const k=Math.min(1,(f-tw.at)/40),lean=f-tw.at>70?(f-tw.at-70)/20*0.9:0
    for(let i=0;i<Math.round(tw.n*k)&&n<MAX;i++){e3.set(lean,0,0);q.setFromEuler(e3);const h=0.06+i*0.115;m4.compose(v3.set(wx(tw.x),Math.cos(lean)*h,wz(c.pusher+12)+Math.sin(lean)*h),q,s3);coins.setMatrixAt(n++,m4)}}
   for(const fl of falls){if(fl.ball){if(b<12){m4.compose(v3.set(fl.x,fl.y,fl.z),q.identity(),s3);balls.setMatrixAt(b++,m4)}continue}
    if(n>=MAX)break;e3.set(fl.rx,0,fl.rz);q.setFromEuler(e3);m4.compose(v3.set(fl.x,fl.y,fl.z),q,s3);coins.setMatrixAt(n++,m4)}
   coins.count=n;coins.instanceMatrix.needsUpdate=true;balls.count=b;balls.instanceMatrix.needsUpdate=true
   // The bonus pieces rise in front of the cabinet, facing you, with the cabinet dimmed behind.
   placeCamera()
   const showing=!!(c.dish||c.chance)
   const sm=shade.material as THREE.MeshBasicMaterial;sm.opacity+=((showing?0.55:0)-sm.opacity)*0.15;shade.visible=sm.opacity>0.01
   const toCam=new THREE.Vector3().subVectors(camera.position,new THREE.Vector3(0,0,0.8)).normalize()
   bonus.position.copy(new THREE.Vector3(0,0,0.8).addScaledVector(toCam,5.2));bonus.quaternion.copy(camera.quaternion)
   shade.position.copy(new THREE.Vector3(0,0,0.8).addScaledVector(toCam,4.2));shade.quaternion.copy(camera.quaternion)
   dishGroup.visible=!!c.dish;wheelGroup.visible=!!c.chance&&!c.dish
   if(c.dish){const t=Math.min(1,(f-c.dish.at)/170),target=c.dish.pocket/DISH.length*Math.PI*2,turns=4*(1-(1-t)**2),a=target-Math.PI*8+turns*Math.PI*2,rr=1.95-0.4*t
    dishGroup.rotation.set(-1.1,0,0);dish.rotation.y=f/90;dishBall.position.set(Math.cos(a+dish.rotation.y)*rr,0.06*(rr/0.5)**2*0.25+0.2,-Math.sin(a+dish.rotation.y)*rr)}
   if(c.chance){if(wheelTex.pockets!==c.winPockets){wheelTex.pockets=c.winPockets;wheelTex.tex.image=wheelImage(c.winPockets);wheelTex.tex.needsUpdate=true}
    const t=Math.min(1,(f-c.chance.at)/200);wheel.rotation.y=(1-(1-t)**3)*Math.PI*2*5+c.chance.pocket/CHANCE_POCKETS*Math.PI*2}
   renderer.render(scene,camera)
   // The backboard's numbers and reels, a few times a second (and every frame while the reels spin).
   if(now-lastHud>120||c.spinning){lastHud=now
    const reels=c.spinning?[0,1,2].map(i=>f-c.spinning!.at<40+i*25?REEL_FACES[Math.floor((f+i*3)/3)%6]:c.spinning!.reels[i]):hudReels.current
    if(c.spinning)hudReels.current=reels
    setHud(h=>h.hand===c.hand&&h.jp===c.jackpot&&h.steps===c.steps&&h.pockets===c.winPockets&&h.queue===c.queue&&h.reels.join()===reels.join()&&h.spinning===!!c.spinning?h:{...h,hand:c.hand,jp:c.jackpot,steps:c.steps,pockets:c.winPockets,queue:c.queue,reels,spinning:!!c.spinning})}
   if(c.hand<=0&&!busy(c)&&!falls.length){quiet.current+=1;if(quiet.current>240&&!ended.current){ended.current=true;onEndRef.current(c.hand,c.jpWins)}}else quiet.current=0
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{cancelAnimationFrame(raf);ro.disconnect();window.removeEventListener('keydown',key)
   scene.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose?.();const mat=m.material as THREE.Material|THREE.Material[]|undefined;(Array.isArray(mat)?mat:mat?[mat]:[]).forEach(x=>{(x as THREE.MeshStandardMaterial).map?.dispose();x.dispose()})})
   envRT.dispose();renderer.dispose();renderer.domElement.remove()}
 },[])
 useEffect(()=>{if(!hud.event)return;const t=window.setTimeout(()=>setHud(h=>({...h,event:''})),2200);return()=>window.clearTimeout(t)},[hud.event])
 return <div className="break-game medal-cove">
  <div className="cove-board" aria-label="Backboard">
   <div className="cove-steps" aria-label={hud.steps+' of 3 steps'}>{[0,1,2].map(i=><i key={i} className={i<hud.steps?'is-on':undefined}/>)}<small>⭐ steps</small></div>
   <div className="cove-jp"><small>JACKPOT</small><b>{hud.jp}</b></div>
   <div className="cove-pockets"><b>🎯 {hud.pockets}/{CHANCE_POCKETS}</b><small>{best!==null?'Best '+best:'JP pockets'}</small></div>
   <div className={'cove-reels'+(hud.spinning?' is-spinning':'')} aria-label={'Lottery: '+hud.reels.join(' ')}>{hud.reels.map((r,i)=><span key={i}>{r}</span>)}</div>
   <div className="cove-queue" aria-label={hud.queue+' spins waiting'}>{Array.from({length:4},(_,i)=><i key={i} className={i<hud.queue?'is-on':undefined}/>)}</div>
  </div>
  <div ref={host} className="cove-stage" role="img" aria-label={'KONO Medal Cove: '+hud.hand+' medals, jackpot '+hud.jp}>
   {hud.event&&<p key={hud.event} className="cove-event" role="status">{hud.event}</p>}
   <button type="button" className="cove-view" aria-label="Change the camera" onClick={()=>setView(v=>(v+1)%VIEWS.length)}>🎥</button>
   <span className="cove-hand" aria-hidden="true">🪙 {hud.hand}</span>
  </div>
  <p className="blast-help">Touch the field to aim and tap to drop (hold to keep dropping). Through the 🏮 lantern, a medal spins the lottery. Drag off the field to look around.</p>
 </div>
}

// ---- Textures, drawn once ----
function canvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')!] as const}
function woodTexture(){const [c,g]=canvas(512,512);g.fillStyle='#c79a63';g.fillRect(0,0,512,512)
 for(let i=0;i<10;i++){g.fillStyle=i%2?'#bf9058':'#cfa36c';g.fillRect(i*51.2,0,51.2,512);g.strokeStyle='rgba(90,55,25,.45)';g.lineWidth=3;g.beginPath();g.moveTo(i*51.2,0);g.lineTo(i*51.2,512);g.stroke()
  for(let k=0;k<6;k++){g.strokeStyle='rgba(120,80,40,.18)';g.lineWidth=1.5;g.beginPath();const x=i*51.2+8+k*7;g.moveTo(x,0);g.bezierCurveTo(x+6,170,x-6,340,x+3,512);g.stroke()}}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
function coinFace(){const [c,g]=canvas(128,128);const grad=g.createRadialGradient(54,48,6,64,64,64);grad.addColorStop(0,'#fff3b0');grad.addColorStop(.6,'#f2c230');grad.addColorStop(1,'#b8860b');g.fillStyle=grad;g.fillRect(0,0,128,128)
 g.strokeStyle='rgba(140,90,10,.7)';g.lineWidth=5;g.beginPath();g.arc(64,64,44,0,Math.PI*2);g.stroke();g.fillStyle='rgba(140,90,10,.75)';g.font='bold 44px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText('K',64,66)
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function dishTexture(){const [c,g]=canvas(512,512);g.fillStyle='#fff6e0';g.fillRect(0,0,512,512)
 // The lathe maps around (x) and outward (y); the pockets sit near the rim as colored bands.
 DISH.forEach((p,i)=>{const x0=i/DISH.length*512;g.fillStyle=p.prize.kind==='chance'?'#ff5a7a':p.prize.kind==='tower'?'#ffb347':'#7fd0ff';g.fillRect(x0+2,300,512/DISH.length-4,180)
  g.save();g.translate(x0+512/DISH.length/2,390);g.fillStyle='#2b1a3a';g.font='bold 22px system-ui';g.textAlign='center';g.fillText(p.label.replace('JP CHANCE','JP!'),0,8);g.restore()})
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function wheelImage(winPockets:number){const [c,g]=canvas(512,512),cx=256,cy=256,R=250
 for(let i=0;i<CHANCE_POCKETS;i++){const a0=i/CHANCE_POCKETS*Math.PI*2-Math.PI/2-Math.PI/CHANCE_POCKETS,a1=a0+Math.PI*2/CHANCE_POCKETS,win=isWinPocket(i,winPockets)
  g.fillStyle=win?'#ffd34d':i%2?'#6a4bc4':'#8a6ae0';g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,R,a0,a1);g.closePath();g.fill();g.strokeStyle='#2b1a3a';g.lineWidth=3;g.stroke()
  const am=(a0+a1)/2;g.fillStyle=win?'#5a3200':'#fff';g.font='bold 30px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(win?'JP':'+10',cx+Math.cos(am)*R*.72,cy+Math.sin(am)*R*.72)}
 g.fillStyle='#2b1a3a';g.beginPath();g.arc(cx,cy,80,0,Math.PI*2);g.fill();g.fillStyle='#ffd34d';g.font='bold 30px system-ui';g.fillText('JACKPOT',cx,cy-14);g.fillText('CHANCE',cx,cy+22)
 return c}
