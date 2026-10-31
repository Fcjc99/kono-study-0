import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import * as THREE from 'three'
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js'
import RAPIER from '@dimforge/rapier3d-compat'
import {BloomEffect,EffectComposer,EffectPass,RenderPass,SMAAEffect} from 'postprocessing'
import {CHANCE_POCKETS,DISH,FIELD,LAMPS,POCKETS,busy,drop,isWinPocket,newCove,pocket,settle,spawned,step,type Cove,type Reel} from '../store/pusher'
import {gameSound} from '../konoSounds'
import {fx} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'

/** KONO Medal Cove (rules in store/pusher), in 3D with real physics: a medal pusher cabinet on KONO's dock.
 * Every medal is a coin in a physics world (Rapier): they drop from the chute, land on each other, pile up
 * against the pusher, get shoved forward and teeter off the front into the tray (or slip off the sides
 * near the front). The pusher is a moving block with a shelf on top; a wall above its back scrapes off
 * what lands on it. Medal towers stand as real stacks until the pusher knocks into them. The lottery,
 * ball lottery and Jackpot Chance are the rules' own; the ball dish and the Jackpot wheel rise up in
 * front of the cabinet, and a soft bloom makes the lantern, the jackpot and the gold glow.
 * Touch the field to aim and tap to drop (hold to keep dropping); drag off it to look around, or 🎥. */
const U=0.1 // world units per field unit
const MAX=520 // medal bodies at once (the oldest ones resting in the tray go first)
const R=FIELD.r*U,HALF=0.055,BALL=FIELD.ball*U
const FRONT=6 // the field's front edge (z)
// The pin board at the back: medals go in at the top, bounce down the pins and land in a pocket or on the
// pusher's shelf. Pockets: 🏮 (left), ⭐ (the middle one, sliding), 🗼 (right).
const BZ=-6.15,BTOP=4.5,BBOTTOM=1.55,POCKET_W=[1.25,1.05,1.25]
const pocketX=(i:number,f:number)=>i===0?-3.3:i===2?3.3:Math.sin(f/80)*1.6
// Pins 1.2 apart, rows 0.5 apart and offset by half: every gap (straight and diagonal) lets a medal through.
const PINS:[number,number][]=[];for(let row=0;row<5;row++)for(let col=-4;col<=4;col++){const x=col*1.2+(row%2?0.6:0);if(Math.abs(x)<4.5)PINS.push([x,BTOP-0.45-row*0.52])}
const POCKET_FACE=['🏮','⭐','🗼']
const wx=(x:number)=>(x-50)*U,wz=(y:number)=>y*U-6
const REEL_FACES:Reel[]=['🪙','🗼','🔮','⭐','🐚','🌺']
const VIEWS=[{yaw:0,pitch:0.62,dist:12.5},{yaw:0,pitch:1.05,dist:12},{yaw:0.55,pitch:0.5,dist:12.5},{yaw:-0.55,pitch:0.5,dist:12.5}]

type Piece={body:RAPIER.RigidBody;ball:boolean;counted:number;board:boolean}

export default function MedalCove({ref,best,sound,onEnd}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;onEnd:(medals:number,jackpots:number)=>void}){
 const [start]=useState<Cove>(()=>newCove(Math.random,100,true))
 const cove=useRef<Cove>(start),host=useRef<HTMLDivElement>(null),aim=useRef(50),holding=useRef(false),lastDrop=useRef(0)
 const [hud,setHud]=useState({hand:start.hand,jp:start.jackpot,steps:0,pockets:1,queue:0,event:'',reels:['🌺','🌺','🌺'] as string[],spinning:false,ready:false})
 const [view,setView]=useState(0),viewRef=useRef(0),hudReels=useRef<string[]>(['🌺','🌺','🌺'])
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound),quiet=useRef(0),ready=useRef(false)
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 useEffect(()=>{viewRef.current=view},[view])
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;onEndRef.current(cove.current.hand,cove.current.jpWins)}}),[])
 const dropOne=()=>{const c=cove.current;if(!ready.current||ended.current||c.hand<=0)return;cove.current=drop(c,aim.current);lastDrop.current=performance.now();fx('tick',soundRef.current)}
 const dropRef=useRef(dropOne)
 useEffect(()=>{dropRef.current=dropOne})

 /** Builds the scene and the physics world in `el`; returns how to take it all down. */
 function build(el:HTMLDivElement){
  // ---- Renderer, camera, light and glow ----
  const small=el.clientWidth<600
  const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',stencil:false,depth:true})
  renderer.setPixelRatio(Math.min(small?1.5:2,window.devicePixelRatio||1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05
  el.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true')
  const scene=new THREE.Scene();scene.background=new THREE.Color('#2f7fc8');scene.fog=new THREE.Fog('#2f7fc8',18,34)
  const camera=new THREE.PerspectiveCamera(42,1,0.1,80)
  const pmrem=new THREE.PMREMGenerator(renderer),envRT=pmrem.fromScene(new RoomEnvironment(),0.04);scene.environment=envRT.texture;pmrem.dispose()
  scene.add(new THREE.HemisphereLight('#dff3ff','#4a3424',0.8))
  const sun=new THREE.DirectionalLight('#fff4dc',2.2);sun.position.set(4,12,6);sun.castShadow=true;sun.shadow.mapSize.set(small?512:1024,small?512:1024)
  Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:30});scene.add(sun)
  // One merged effect pass: bloom on what's bright (the lantern, the shine on the gold, the jackpot pieces)
  // and SMAA for smooth edges. Half-resolution bloom on phones.
  const composer=new EffectComposer(renderer,{multisampling:0})
  composer.addPass(new RenderPass(scene,camera))
  const bloom=new BloomEffect({intensity:small?0.7:0.9,luminanceThreshold:0.82,luminanceSmoothing:0.2,mipmapBlur:true,resolutionScale:small?0.5:0.75})
  composer.addPass(new EffectPass(camera,bloom,new SMAAEffect()))
  // ---- The cabinet you see ----
  const deckMat=new THREE.MeshStandardMaterial({map:woodTexture(),roughness:.85,color:'#e9c9a0'})
  const deck=new THREE.Mesh(new THREE.BoxGeometry(10.4,0.4,13.6),deckMat);deck.position.set(0,-0.2,-0.8);deck.receiveShadow=true;scene.add(deck)
  const frameMat=new THREE.MeshStandardMaterial({color:'#5b3a24',roughness:.7})
  const glass=new THREE.MeshPhysicalMaterial({color:'#cfefff',transparent:true,opacity:.18,roughness:.05})
  for(const s of [-1,1]){const g=new THREE.Mesh(new THREE.BoxGeometry(0.12,1.4,12),glass);g.position.set(s*5.15,0.7,-1.6);scene.add(g)
   const rail=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.18,12),frameMat);rail.position.set(s*5.2,1.45,-1.6);scene.add(rail)}
  const back=new THREE.Mesh(new THREE.BoxGeometry(10.8,2.6,0.4),frameMat);back.position.set(0,1.1,-7.8);back.castShadow=true;scene.add(back)
  const scraper=new THREE.Mesh(new THREE.BoxGeometry(10.2,1.0,0.3),frameMat);scraper.position.set(0,1.35,-6.55);scene.add(scraper)
  const tray=new THREE.Mesh(new THREE.BoxGeometry(10.4,0.3,2.6),frameMat);tray.position.set(0,-2.15,7.4);tray.receiveShadow=true;scene.add(tray)
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:'#1d5f9e',roughness:.4}));sea.rotation.x=-Math.PI/2;sea.position.y=-3;scene.add(sea)
  const pusherMesh=new THREE.Mesh(new THREE.BoxGeometry(10.0,0.6,6),new THREE.MeshStandardMaterial({color:'#2f6fb3',roughness:.45}));pusherMesh.castShadow=true;pusherMesh.receiveShadow=true;scene.add(pusherMesh)
  // The pin board: a painted backplate, chrome pins, and three glowing pockets.
  const plate=new THREE.Mesh(new THREE.BoxGeometry(10.2,BTOP-BBOTTOM+1.1,0.12),new THREE.MeshStandardMaterial({map:boardTexture(),roughness:.6}));plate.position.set(0,(BTOP+BBOTTOM)/2+0.05,BZ-0.2);scene.add(plate)
  const boardGlass=new THREE.Mesh(new THREE.BoxGeometry(10.2,BTOP-BBOTTOM+1.1,0.04),glass);boardGlass.position.set(0,(BTOP+BBOTTOM)/2+0.05,BZ+0.2);scene.add(boardGlass)
  const pinMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06,0.06,0.42,10),new THREE.MeshStandardMaterial({color:'#eef3f8',metalness:1,roughness:.2}),PINS.length)
  PINS.forEach(([x,y],i)=>{const m=new THREE.Matrix4().makeRotationX(Math.PI/2);m.setPosition(x,y,BZ);pinMesh.setMatrixAt(i,m)});scene.add(pinMesh)
  const pocketMeshes=POCKET_W.map((w,i)=>{const g=new THREE.Group()
   const mat=new THREE.MeshStandardMaterial({color:['#ff6b5e','#ffd34d','#7fd0ff'][i],emissive:['#ff3b2f','#ffb000','#2fa8ff'][i],emissiveIntensity:.6,roughness:.4})
   const cup=new THREE.Mesh(new THREE.BoxGeometry(w,0.34,0.36),mat);g.add(cup)
   const label=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.5),new THREE.MeshBasicMaterial({map:emojiTexture(POCKET_FACE[i]),transparent:true}));label.position.set(0,0,0.19);g.add(label)
   g.position.set(pocketX(i,0),BBOTTOM-0.2,BZ);scene.add(g);return {g,mat,flash:0}})
  const chute=new THREE.Mesh(new THREE.CylinderGeometry(R,R,HALF*2,28),new THREE.MeshStandardMaterial({color:'#f2c230',metalness:.85,roughness:.3,emissive:'#5a3a00'}));chute.rotation.x=Math.PI/2;scene.add(chute)
  const coins=new THREE.InstancedMesh(new THREE.CylinderGeometry(R,R,HALF*2,26),new THREE.MeshStandardMaterial({color:'#ffd24a',metalness:1,roughness:.32,map:coinFace(),envMapIntensity:1.3}),MAX)
  coins.castShadow=!small;coins.receiveShadow=true;coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(coins)
  const balls=new THREE.InstancedMesh(new THREE.SphereGeometry(BALL,24,16),new THREE.MeshPhysicalMaterial({color:'#9d6bff',roughness:.15,clearcoat:1,emissive:'#5a2fd0',emissiveIntensity:.8}),16);balls.castShadow=true;scene.add(balls)
  // The bonus pieces, out of sight until they're on.
  const bonus=new THREE.Group();scene.add(bonus)
  const shade=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshBasicMaterial({color:'#081428',transparent:true,opacity:0,depthWrite:false}));scene.add(shade)
  const dishGroup=new THREE.Group();bonus.add(dishGroup)
  const dish=new THREE.Mesh(new THREE.LatheGeometry([0,0.5,1,1.5,1.9,2.1].map((r,i)=>new THREE.Vector2(r,i===5?0.55:0.04*i*i)),48),new THREE.MeshStandardMaterial({map:dishTexture(),side:THREE.DoubleSide,roughness:.5}));dishGroup.add(dish)
  const dishBall=new THREE.Mesh(new THREE.SphereGeometry(0.2,24,16),new THREE.MeshPhysicalMaterial({color:'#9d6bff',roughness:.15,clearcoat:1,emissive:'#5a2fd0',emissiveIntensity:.8}));dishGroup.add(dishBall)
  const wheelGroup=new THREE.Group();bonus.add(wheelGroup)
  const wheelTex={tex:new THREE.CanvasTexture(document.createElement('canvas')),pockets:-1}
  const wheel=new THREE.Mesh(new THREE.CylinderGeometry(2.3,2.3,0.25,64),[new THREE.MeshStandardMaterial({color:'#3a1d6e'}),new THREE.MeshStandardMaterial({map:wheelTex.tex,emissive:'#ffffff',emissiveMap:wheelTex.tex,emissiveIntensity:.25}),new THREE.MeshStandardMaterial({color:'#3a1d6e'})]);wheel.rotation.x=Math.PI/2;wheelGroup.add(wheel)
  const pointer=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.5,16),new THREE.MeshStandardMaterial({color:'#fff',emissive:'#ffd34d',emissiveIntensity:1.5}));pointer.rotation.z=Math.PI;pointer.position.set(0,2.55,0.2);wheelGroup.add(pointer)
  dishGroup.visible=false;wheelGroup.visible=false
  // ---- The physics world ----
  const world=new RAPIER.World({x:0,y:-22,z:0})
  world.integrationParameters.numSolverIterations=4
  const fixed=(hx:number,hy:number,hz:number,x:number,y:number,z:number,friction=0.5)=>world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setTranslation(x,y,z).setFriction(friction))
  fixed(5.2,0.2,6.8,0,-0.2,FRONT-6.8)            // the deck, ending at the front edge
  fixed(0.1,1.2,5.6,-5.05,1.0,-1.6);fixed(0.1,1.2,5.6,5.05,1.0,-1.6) // side walls, open near the front (the side drops)
  fixed(5.2,1.5,0.2,0,1.1,-7.8)                   // back wall
  fixed(5.0,0.5,0.15,0,1.36,-6.55)                // the scraper above the pusher's shelf
  fixed(5.2,0.15,1.3,0,-2.15,7.4,0.9)             // the tray
  fixed(0.1,0.6,1.3,-5.2,-1.6,7.4);fixed(0.1,0.6,1.3,5.2,-1.6,7.4);fixed(5.2,0.6,0.1,0,-1.6,8.7)
  // The pin board: pins (cylinders across the board), its sides, and the backplate and glass (medals on the
  // board can only move up, down and sideways anyway).
  const across=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)
  for(const [x,y] of PINS)world.createCollider(RAPIER.ColliderDesc.cylinder(0.21,0.06).setTranslation(x,y,BZ).setRotation({x:across.x,y:across.y,z:across.z,w:across.w}).setRestitution(0.35).setFriction(0.02))
  fixed(0.1,(BTOP-BBOTTOM)/2+0.4,0.3,-5.0,(BTOP+BBOTTOM)/2,BZ);fixed(0.1,(BTOP-BBOTTOM)/2+0.4,0.3,5.0,(BTOP+BBOTTOM)/2,BZ)
  const pusherBody=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,0.3,wz(FIELD.back)-3))
  world.createCollider(RAPIER.ColliderDesc.cuboid(5.0,0.3,3).setFriction(0.25),pusherBody)
  const pieces=new Map<number,Piece>()
  const addCoin=(x:number,y:number,z:number,ball=false,spin=0,board=false)=>{
   if(!ball&&[...pieces.values()].filter(p=>!p.ball).length>=MAX){const old=[...pieces.entries()].find(([,p])=>p.counted&&!p.ball)??[...pieces.entries()].find(([,p])=>!p.ball);if(old){world.removeRigidBody(old[1].body);pieces.delete(old[0])}}
   // On the board a medal stands on its edge, facing you, and only moves across and down (and spins).
   const q=board?across.clone():new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random()-.5)*0.2,Math.random()*6,(Math.random()-.5)*0.2))
   const desc=RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,z).setRotation({x:q.x,y:q.y,z:q.z,w:q.w}).setLinearDamping(board?0.05:0.15).setAngularDamping(0.4).setAngvel(board?{x:0,y:0,z:spin}:{x:0,y:spin,z:0})
   if(board)desc.enabledTranslations(true,true,false).enabledRotations(false,false,true)
   const body=world.createRigidBody(desc)
   world.createCollider((ball?RAPIER.ColliderDesc.ball(BALL).setDensity(0.6):RAPIER.ColliderDesc.cylinder(HALF,R).setDensity(1.4)).setFriction(ball?0.4:0.45).setRestitution(0.08),body)
   pieces.set(body.handle,{body,ball,counted:0,board})}
  // The pile to start with: a few layers across the field, settled before you play.
  for(let layer=0;layer<2;layer++)for(let z=wz(FIELD.reach+3);z<FRONT-0.4;z+=R*1.9)for(let x=-4.6;x<=4.6;x+=R*2.05)if(layer===0||Math.random()<0.55)addCoin(x+(Math.random()-.5)*0.1,0.06+layer*0.13,z+(Math.random()-.5)*0.1)
  pusherBody.setNextKinematicTranslation({x:0,y:0.3,z:wz(FIELD.back)-3})
  for(let i=0;i<90;i++)world.step()
  // ---- Camera: one of four views, nudged by dragging off the field ----
  const orbit={yaw:VIEWS[0].yaw,pitch:VIEWS[0].pitch,dist:VIEWS[0].dist,dragYaw:0,dragPitch:0}
  const placeCamera=()=>{const v=VIEWS[viewRef.current]
   orbit.yaw+=(v.yaw+orbit.dragYaw-orbit.yaw)*0.12;orbit.pitch+=(Math.max(0.25,Math.min(1.25,v.pitch+orbit.dragPitch))-orbit.pitch)*0.12;orbit.dist+=(v.dist-orbit.dist)*0.12
   camera.position.set(Math.sin(orbit.yaw)*Math.cos(orbit.pitch)*orbit.dist,Math.sin(orbit.pitch)*orbit.dist,Math.cos(orbit.yaw)*Math.cos(orbit.pitch)*orbit.dist+0.5);camera.lookAt(0,0.9,0)}
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);composer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w/h<0.8?52:42;camera.updateProjectionMatrix()}
  resize();const ro=new ResizeObserver(resize);ro.observe(el)
  // ---- Touch ----
  const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3()
  const boardPlane=new THREE.Plane(new THREE.Vector3(0,0,1),-BZ)
  // Touching the pin board or the field aims (across); anywhere else drags the view.
  const fieldAt=(e:PointerEvent)=>{const r=renderer.domElement.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera)
   if(ray.ray.intersectPlane(boardPlane,hit)&&Math.abs(hit.x)<5.2&&hit.y>BBOTTOM-0.5&&hit.y<BTOP+0.8)return hit
   return ray.ray.intersectPlane(plane,hit)&&Math.abs(hit.x)<5.4&&hit.z>-7.5&&hit.z<6.4?hit:null}
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
  ready.current=true;setHud(h=>({...h,ready:true}))
  // ---- The loop: the rules and the physics at a steady 60 steps a second ----
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),v3=new THREE.Vector3(),s3=new THREE.Vector3(1,1,1)
  const builtTowers=new Set<number>()
  let raf=0,last=performance.now(),acc=0,lastHud=0
  const loop=(now:number)=>{
   acc+=Math.min(100,now-last);last=now
   let steps=0
   while(acc>=1000/60&&steps<4){steps++
    const before=cove.current
    let c=step(before)
    if(holding.current&&now-lastDrop.current>200&&c.hand>0){c=drop(c,aim.current);lastDrop.current=now}
    // Put what the rules dropped into the machine: medals fall from the chute, showers rain over the field.
    for(const m of c.medals){if(m.y<0)addCoin(Math.max(-4.5,Math.min(4.5,wx(m.x)+(Math.random()-.5)*0.08)),BTOP+0.3,BZ,false,(Math.random()-.5)*3,true);else addCoin(wx(m.x),1.6+Math.random()*1.4,wz(m.y),!!m.ball,(Math.random()-.5)*4)}
    c=spawned(c)
    // A tower stands as a real stack, a little in front of the pusher, until it's knocked over.
    for(const t of c.towers)if(!builtTowers.has(t.at)){builtTowers.add(t.at);for(let i=0;i<t.n;i++)addCoin(wx(t.x)+(Math.random()-.5)*0.02,0.06+i*0.112,wz(c.pusher+9))}
    // The pusher moves, the world steps.
    pusherBody.setNextKinematicTranslation({x:0,y:0.3,z:wz(c.pusher)-3})
    world.step()
    // The board's bottom: into a pocket, or out onto the pusher's shelf (where it tips over and joins the pile).
    for(const [h,p] of pieces){if(!p.board)continue;const t=p.body.translation()
     // A medal sitting still on a pin gets the little nudge a real cabinet's rattle gives it.
     if(t.y>BBOTTOM){const v=p.body.linvel();if(Math.abs(v.x)+Math.abs(v.y)<0.25)p.body.setLinvel({x:(Math.random()<.5?-1:1)*(0.8+Math.random()*0.8),y:v.y,z:0},true);continue}
     const hit=POCKET_W.findIndex((w,i)=>Math.abs(t.x-pocketX(i,c.frame))<w/2-0.05)
     if(hit>=0){world.removeRigidBody(p.body);pieces.delete(h);c=pocket(c,POCKETS[hit]);pocketMeshes[hit].flash=1;fx(hit===1?'star':'zap',soundRef.current)}
     else{p.board=false;p.body.setEnabledTranslations(true,true,true,true);p.body.setEnabledRotations(true,true,true,true);p.body.setLinvel({x:p.body.linvel().x*0.5,y:-1,z:0.6},true)}}
    // What fell: off the front is yours, off the sides is lost; a ball off the front goes to the ball lottery.
    let won=0,lost=0,ballsWon=0
    for(const [h,p] of pieces){const t=p.body.translation()
     if(!p.counted&&t.y<-0.4){p.counted=c.frame;if(t.z>FRONT-0.2&&Math.abs(t.x)<5.3){if(p.ball)ballsWon++;else won++}else{if(p.ball)ballsWon++;else lost++}}
     if(p.counted&&(p.ball||t.y<-3.5||c.frame-p.counted>150)){world.removeRigidBody(p.body);pieces.delete(h)}}
    c=settle(c,won,lost,ballsWon)
    cove.current=c;acc-=1000/60
    if(won)fx('ding',soundRef.current)
    const ev=c.events[c.events.length-1];if(ev&&ev!==before.events[before.events.length-1]){setHud(h=>({...h,event:ev.text}));if(/JACKPOT!/.test(ev.text)){fx('mega',soundRef.current);gameSound('win',soundRef.current)}else if(/CHANCE|tower|shower|ball/i.test(ev.text))fx('fanfare',soundRef.current)}
    if(c.spinning&&!before.spinning)fx('charge',soundRef.current)
   }
   if(acc>1000/60*4)acc=0
   const c=cove.current,f=c.frame
   // Draw the machine where the physics has it.
   const pz=wz(c.pusher);pusherMesh.position.set(0,0.3,pz-3)
   const ax=Math.max(-4.5,Math.min(4.5,wx(aim.current)));chute.position.set(ax,BTOP+0.32+Math.sin(f/12)*0.03,BZ);chute.visible=c.hand>0
   pocketMeshes.forEach((pm,i)=>{pm.g.position.x=pocketX(i,f);pm.flash=Math.max(0,pm.flash-0.03);pm.mat.emissiveIntensity=0.6+pm.flash*3})
   let n=0,b=0
   for(const p of pieces.values()){const t=p.body.translation(),r=p.body.rotation()
    m4.compose(v3.set(t.x,t.y,t.z),q.set(r.x,r.y,r.z,r.w),s3)
    if(p.ball){if(b<16)balls.setMatrixAt(b++,m4)}else if(n<MAX)coins.setMatrixAt(n++,m4)}
   coins.count=n;coins.instanceMatrix.needsUpdate=true;balls.count=b;balls.instanceMatrix.needsUpdate=true
   placeCamera()
   const showing=!!(c.dish||c.chance)
   const sm=shade.material as THREE.MeshBasicMaterial;sm.opacity+=((showing?0.55:0)-sm.opacity)*0.15;shade.visible=sm.opacity>0.01
   const centre=new THREE.Vector3(0,0,0.8),toCam=new THREE.Vector3().subVectors(camera.position,centre).normalize()
   bonus.position.copy(centre).addScaledVector(toCam,5.2);bonus.quaternion.copy(camera.quaternion)
   shade.position.copy(centre).addScaledVector(toCam,4.2);shade.quaternion.copy(camera.quaternion)
   dishGroup.visible=!!c.dish;wheelGroup.visible=!!c.chance&&!c.dish
   if(c.dish){const t=Math.min(1,(f-c.dish.at)/170),target=c.dish.pocket/DISH.length*Math.PI*2,turns=4*(1-(1-t)**2),a=target-Math.PI*8+turns*Math.PI*2,rr=1.95-0.4*t
    dishGroup.rotation.set(-1.1,0,0);dish.rotation.y=f/90;dishBall.position.set(Math.cos(a+dish.rotation.y)*rr,0.06*(rr/0.5)**2*0.25+0.2,-Math.sin(a+dish.rotation.y)*rr)}
   if(c.chance){if(wheelTex.pockets!==c.winPockets){wheelTex.pockets=c.winPockets;wheelTex.tex.image=wheelImage(c.winPockets);wheelTex.tex.needsUpdate=true}
    const t=Math.min(1,(f-c.chance.at)/200);wheel.rotation.y=(1-(1-t)**3)*Math.PI*2*5+c.chance.pocket/CHANCE_POCKETS*Math.PI*2}
   composer.render()
   if(now-lastHud>120||c.spinning){lastHud=now
    const reels=c.spinning?[0,1,2].map(i=>f-c.spinning!.at<40+i*25?REEL_FACES[Math.floor((f+i*3)/3)%6]:c.spinning!.reels[i]):hudReels.current
    if(c.spinning)hudReels.current=reels
    setHud(h=>h.hand===c.hand&&h.jp===c.jackpot&&h.steps===c.steps&&h.pockets===c.winPockets&&h.queue===c.queue&&h.reels.join()===reels.join()&&h.spinning===!!c.spinning?h:{...h,hand:c.hand,jp:c.jackpot,steps:c.steps,pockets:c.winPockets,queue:c.queue,reels,spinning:!!c.spinning})}
   if(c.hand<=0&&!busy(c)){quiet.current+=1;if(quiet.current>300&&!ended.current){ended.current=true;onEndRef.current(c.hand,c.jpWins)}}else quiet.current=0
   raf=requestAnimationFrame(loop)
  }
  raf=requestAnimationFrame(loop)
  return ()=>{ready.current=false;cancelAnimationFrame(raf);ro.disconnect();window.removeEventListener('keydown',key)
   world.free()
   scene.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose?.();const mat=m.material as THREE.Material|THREE.Material[]|undefined;(Array.isArray(mat)?mat:mat?[mat]:[]).forEach(x=>{(x as THREE.MeshStandardMaterial).map?.dispose();x.dispose()})})
   composer.dispose();envRT.dispose();renderer.dispose();renderer.domElement.remove()}
 }
 useEffect(()=>{
  const el=host.current;if(!el)return
  let disposed=false,cleanup=()=>{}
  void RAPIER.init().then(()=>{if(!disposed)cleanup=build(el)})
  return ()=>{disposed=true;cleanup()}
 },[])

 useEffect(()=>{if(!hud.event)return;const t=window.setTimeout(()=>setHud(h=>({...h,event:''})),2200);return()=>window.clearTimeout(t)},[hud.event])
 return <div className="break-game medal-cove">
  <div className="cove-board" aria-label="Backboard">
   <div className="cove-steps" aria-label={hud.steps+' of '+LAMPS+' lamps'}>{Array.from({length:LAMPS},(_,i)=><i key={i} className={i<hud.steps?'is-on':undefined}/>)}<small>💡 lamps → BIG BONUS</small></div>
   <div className="cove-jp"><small>JACKPOT</small><b>{hud.jp}</b></div>
   <div className="cove-pockets"><b>🎯 {hud.pockets}/{CHANCE_POCKETS}</b><small>{best!==null?'Best '+best:'JP pockets'}</small></div>
   <div className={'cove-reels'+(hud.spinning?' is-spinning':'')} aria-label={'Lottery: '+hud.reels.join(' ')}>{hud.reels.map((r,i)=><span key={i}>{r}</span>)}</div>
   <div className="cove-queue" aria-label={hud.queue+' spins waiting'}>{Array.from({length:4},(_,i)=><i key={i} className={i<hud.queue?'is-on':undefined}/>)}</div>
  </div>
  <div ref={host} className="cove-stage" role="img" aria-label={'KONO Medal Cove: '+hud.hand+' medals, jackpot '+hud.jp}>
   {!hud.ready&&<p className="cove-loading" role="status">Filling the machine with medals…</p>}
   {hud.event&&<p key={hud.event} className="cove-event" role="status">{hud.event}</p>}
   <button type="button" className="cove-view" aria-label="Change the camera" onClick={()=>setView(v=>(v+1)%VIEWS.length)}>🎥</button>
   <span className="cove-hand" aria-hidden="true">🪙 {hud.hand}</span>
  </div>
  <p className="blast-help">Touch to aim along the top of the pin board and tap to drop (hold to keep dropping). Medals bounce down the pins into a pocket: 🏮 spins the lottery, ⭐ lights a lamp (5 lamps: BIG BONUS), 🗼 builds a medal tower. Drag around the edges to look around.</p>
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
function boardTexture(){const [c,g]=canvas(512,256);const grad=g.createLinearGradient(0,0,0,256);grad.addColorStop(0,'#7fd0ff');grad.addColorStop(1,'#2f6fb3');g.fillStyle=grad;g.fillRect(0,0,512,256)
 g.fillStyle='rgba(255,255,255,.18)';for(let i=0;i<6;i++){g.beginPath();g.arc(60+i*80,40+(i%2)*30,26,0,Math.PI*2);g.fill()}
 g.fillStyle='rgba(255,233,168,.9)';g.font='bold 28px system-ui';g.textAlign='center';g.fillText('KONO MEDAL COVE',256,236)
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function emojiTexture(e:string){const [c,g]=canvas(128,128);g.font='96px system-ui,"Apple Color Emoji","Noto Color Emoji"';g.textAlign='center';g.textBaseline='middle';g.fillText(e,64,70)
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
