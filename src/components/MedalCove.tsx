import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import * as THREE from 'three'
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js'
import RAPIER from '@dimforge/rapier3d-compat'
import {BloomEffect,EffectComposer,EffectPass,RenderPass,SMAAEffect} from 'postprocessing'
import {BANK_START,CHANCE_POCKETS,DISH,FIELD,LAMPS,LAYER,POCKETS,inFever,WHEELS,WHEEL_FRAMES,busy,drop,isWinPocket,newCove,pocket,settle,spawned,step,type Cove,type Reel} from '../store/pusher'
import {gameSound} from '../konoSounds'
import {fx} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'
import CoveFail,{type CoveFailure} from './CoveFail'
import {webglWorks} from './webgl'

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
// The side slides: one each side of the cabinet, from outside it, over a gap in the side wall, down toward
// the middle; each ends up high over the pusher's shelf (so the medals on the shelf pass under it) and the
// medals drop off its end onto the shelf.
const RAMP_Z=-5.25,RAMP_HALF=0.52,RAMP_OUT=6.5,RAMP_IN=4.35
const RAMPS=[0,1].map(side=>{const s=side?1:-1,top={x:s*RAMP_OUT,y:2.6},bot={x:s*RAMP_IN,y:1.2},dx=RAMP_OUT-RAMP_IN,dy=top.y-bot.y,len=Math.hypot(dx,dy)
 return {s,top,bot,len,angle:Math.atan2(dy,dx),dir:{x:-s*dx/len,y:-dy/len},at:(x:number)=>bot.y+(Math.abs(x)-RAMP_IN)/dx*dy}})
// The ball run: a zig-zag track outside the cabinet on the left that ends at the top of the left slide.
const RUN:[number,number,number][]=[[-5.9,6.3,RAMP_Z],[-6.95,5.75,RAMP_Z],[-5.9,5.2,RAMP_Z],[-6.95,4.65,RAMP_Z],[-5.9,4.1,RAMP_Z],[-6.35,3.15,RAMP_Z]]
const RUN_LEN=RUN.slice(1).reduce((a,p,i)=>a+Math.hypot(p[0]-RUN[i][0],p[1]-RUN[i][1],p[2]-RUN[i][2]),0)
// The seesaw tray at the foot of the right slide (fills, then tips onto the field), KONO's bucket (one medal
// for each pocket hit, thrown onto the field when full) and the turntable in the middle of the field.
const SEESAW={x:3.85,y:1.12,z:RAMP_Z,full:8},BUCKET_FULL=6,TURN={z:-1.35,r:1.25}
const TOPPLE_AT=70 // frames into the BIG BONUS when the giant tower starts to fall
const wx=(x:number)=>(x-50)*U,wz=(y:number)=>y*U-6
const REEL_FACES:Reel[]=['🪙','🗼','🔮','⭐','🐚','🌺']
const VIEWS=[{yaw:0,pitch:0.5,dist:15},{yaw:0,pitch:0.95,dist:14},{yaw:0.55,pitch:0.45,dist:15},{yaw:-0.55,pitch:0.45,dist:15}]

/** `ramp`: which side slide it came down (1 left, 2 right), for the seesaw. */
type Piece={body:RAPIER.RigidBody;ball:boolean;counted:number;board:boolean;ramp?:number}

export default function MedalCove({ref,best,sound,onEnd,onFail}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;onEnd:(medals:number,jackpots:number)=>void;onFail?:()=>void}){
 const [fail,setFail]=useState<CoveFailure|null>(null),[tries,setTries]=useState(0)
 const [start]=useState<Cove>(()=>newCove(Math.random,100,true))
 const cove=useRef<Cove>(start),host=useRef<HTMLDivElement>(null),aim=useRef(50),holding=useRef(false),lastDrop=useRef(0)
 const [hud,setHud]=useState({hand:start.hand,jp:start.jackpot,steps:0,pockets:1,queue:0,event:'',big:false,bank:BANK_START,reels:['🌺','🌺','🌺'] as string[],spinning:false,ready:false,chance:false})
 const [pops,setPops]=useState<{id:number;text:string;x:number;y:number;kind:string}[]>([]),popId=useRef(0)
 const [fever,setFever]=useState(0)
 const [jpWin,setJpWin]=useState<number|null>(null),jpCount=useRef<HTMLElement>(null)
 // The zoomed-in wheels under the cabinet: each turns with its wheel; a spin lights it up and its prize shows.
 const dialEls=useRef<(SVGGElement|null)[]>([])
 const [dials,setDials]=useState(()=>[0,1,2].map(()=>({spin:false,prize:'',kind:'',at:0})))
 const [view,setView]=useState(0),viewRef=useRef(0),hudReels=useRef<string[]>(['🌺','🌺','🌺'])
 const feverRef=useRef(0)
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
  // HD on a real graphics chip; a device drawing 3D in software (no GPU) gets the lighter settings, or it
  // would stall for seconds building HD textures and then crawl.
  const soft=softwareGL(renderer.getContext());TEX=soft?1:2
  renderer.setPixelRatio(soft?1:Math.min(2,window.devicePixelRatio||1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05
  el.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true')
  const scene=new THREE.Scene();scene.background=skyTexture();scene.fog=new THREE.Fog('#d9efff',22,40)
  // Soft toon shading in three tones and pastel colors, to sit with the Sanctuary's art.
  const tones=new THREE.DataTexture(new Uint8Array([150,150,150,255,205,205,205,255,255,255,255,255]),3,1,THREE.RGBAFormat);tones.magFilter=tones.minFilter=THREE.NearestFilter;tones.needsUpdate=true
  const toon=(color:string,extra:THREE.MeshToonMaterialParameters={})=>new THREE.MeshToonMaterial({color,gradientMap:tones,...extra})
  // The Sanctuary's own pixel art, as sprites standing in the scene (crisp pixels, bottom-centered).
  const loader=new THREE.TextureLoader()
  // The painted pieces are HD and drawn smooth; the little pixel-art ones (flowers, clouds, critters) stay crisp.
  const PIXEL=/^(flowers|cloud|butterfly|bird|shell)/,aniso=renderer.capabilities.getMaxAnisotropy()
  const pix=(name:string)=>{const t=loader.load('/games/cove/'+name+'.webp');t.colorSpace=THREE.SRGBColorSpace;if(PIXEL.test(name))t.magFilter=THREE.NearestFilter;else t.anisotropy=aniso;return t}
  const sprite=(name:string,h:number,x:number,y:number,z:number)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:pix(name),alphaTest:0.04}));s.center.set(0.5,0);s.scale.set(h*(ASPECT[name]??1),h,1);s.position.set(x,y,z);scene.add(s);return s}
  const camera=new THREE.PerspectiveCamera(42,1,0.1,80)
  const pmrem=new THREE.PMREMGenerator(renderer),envRT=pmrem.fromScene(new RoomEnvironment(),0.04);scene.environment=envRT.texture;pmrem.dispose()
  scene.add(new THREE.HemisphereLight('#dff3ff','#4a3424',0.8))
  const sun=new THREE.DirectionalLight('#fff4dc',2.2);sun.position.set(4,12,6);sun.castShadow=true;sun.shadow.mapSize.setScalar(soft?512:small?1024:2048)
  Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:30});scene.add(sun)
  // One merged effect pass: bloom on what's bright (the lantern, the shine on the gold, the jackpot pieces)
  // and SMAA for smooth edges. Half-resolution bloom on phones.
  // Smooth edges: multisampling where the device has it (and SMAA on top), full-resolution glow.
  const composer=new EffectComposer(renderer,{multisampling:soft?0:Math.min(small?2:4,renderer.capabilities.maxSamples||0)})
  composer.addPass(new RenderPass(scene,camera))
  const bloom=new BloomEffect({intensity:small?0.7:0.9,luminanceThreshold:0.92,luminanceSmoothing:0.2,mipmapBlur:true,resolutionScale:soft?0.5:small?0.75:1})
  composer.addPass(new EffectPass(camera,bloom,new SMAAEffect()))
  // ---- The cabinet you see ----
  const deckMat=toon('#f6dcb4',{map:woodTexture()})
  const deck=new THREE.Mesh(new THREE.BoxGeometry(10.4,0.4,13.6),deckMat);deck.position.set(0,-0.2,-0.8);deck.receiveShadow=true;scene.add(deck)
  const frameMat=toon('#f4a6c1')
  const glass=new THREE.MeshPhysicalMaterial({color:'#e8f7ff',transparent:true,opacity:.14,roughness:.05})
  for(const s of [-1,1]){const g=new THREE.Mesh(new THREE.BoxGeometry(0.12,1.4,12),glass);g.position.set(s*5.15,0.7,-1.6);scene.add(g)
   // The top rail, with a gap where the slide comes over.
   for(const [z0,z1] of [[-7.6,RAMP_Z-RAMP_HALF-0.08],[RAMP_Z+RAMP_HALF+0.08,4.4]]){const rail=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.18,z1-z0),frameMat);rail.position.set(s*5.2,1.45,(z0+z1)/2);scene.add(rail)}}
  const back=new THREE.Mesh(new THREE.BoxGeometry(10.8,2.6,0.4),frameMat);back.position.set(0,1.1,-7.8);back.castShadow=true;scene.add(back)
  const scraper=new THREE.Mesh(new THREE.BoxGeometry(10.2,1.0,0.3),frameMat);scraper.position.set(0,1.35,-6.55);scene.add(scraper)
  const tray=new THREE.Mesh(new THREE.BoxGeometry(10.4,0.3,2.6),frameMat);tray.position.set(0,-2.15,7.4);tray.receiveShadow=true;scene.add(tray)
  const seaGeo=new THREE.PlaneGeometry(60,60,48,48),seaBase=Float32Array.from(seaGeo.attributes.position.array as Float32Array)
  const sea=new THREE.Mesh(seaGeo,toon('#8fd3f0'));sea.rotation.x=-Math.PI/2;sea.position.y=-3;scene.add(sea)
  const pusherMesh=new THREE.Mesh(new THREE.BoxGeometry(10.0,0.6,6),toon('#8fdcc2'));pusherMesh.castShadow=true;pusherMesh.receiveShadow=true;scene.add(pusherMesh)
  // The pin board: a painted backplate, chrome pins, and three glowing pockets.
  const plate=new THREE.Mesh(new THREE.BoxGeometry(10.2,BTOP-BBOTTOM+1.1,0.12),new THREE.MeshBasicMaterial({map:boardTexture(),toneMapped:false}));plate.position.set(0,(BTOP+BBOTTOM)/2+0.05,BZ-0.2);scene.add(plate)
  const boardGlass=new THREE.Mesh(new THREE.BoxGeometry(10.2,BTOP-BBOTTOM+1.1,0.04),new THREE.MeshPhysicalMaterial({color:'#ffffff',transparent:true,opacity:.05,roughness:.05}));boardGlass.position.set(0,(BTOP+BBOTTOM)/2+0.05,BZ+0.2);scene.add(boardGlass)
  const pinMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06,0.06,0.42,10),new THREE.MeshStandardMaterial({color:'#eef3f8',metalness:1,roughness:.2}),PINS.length)
  PINS.forEach(([x,y],i)=>{const m=new THREE.Matrix4().makeRotationX(Math.PI/2);m.setPosition(x,y,BZ);pinMesh.setMatrixAt(i,m)});scene.add(pinMesh)
  const pocketMeshes=POCKET_W.map((w,i)=>{const g=new THREE.Group()
   const mat=new THREE.MeshStandardMaterial({color:['#ff6b5e','#ffd34d','#7fd0ff'][i],emissive:['#ff3b2f','#ffb000','#2fa8ff'][i],emissiveIntensity:.6,roughness:.4})
   const cup=new THREE.Mesh(new THREE.BoxGeometry(w,0.34,0.36),mat);g.add(cup)
   const label=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.5),new THREE.MeshBasicMaterial({map:emojiTexture(POCKET_FACE[i]),transparent:true}));label.position.set(0,0,0.19);g.add(label)
   g.position.set(pocketX(i,0),BBOTTOM-0.2,BZ);scene.add(g);return {g,mat,flash:0}})
  const chute=new THREE.Mesh(new THREE.CylinderGeometry(R,R,HALF*2,28),new THREE.MeshStandardMaterial({color:'#f2c230',metalness:.85,roughness:.3,emissive:'#5a3a00'}));chute.rotation.x=Math.PI/2;scene.add(chute)
  const coins=new THREE.InstancedMesh(new THREE.CylinderGeometry(R,R,HALF*2,40),new THREE.MeshStandardMaterial({color:'#ffd24a',metalness:1,roughness:.32,map:coinFace(),envMapIntensity:1.3}),MAX)
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
  const wheel=new THREE.Mesh(new THREE.CylinderGeometry(2.3,2.3,0.25,64),[new THREE.MeshStandardMaterial({color:'#f2c230',metalness:.8,roughness:.3}),new THREE.MeshBasicMaterial({map:wheelTex.tex,toneMapped:false,color:'#d8d8d8'}),new THREE.MeshStandardMaterial({color:'#3a1d6e'})]);wheel.rotation.x=Math.PI/2;wheelGroup.add(wheel)
  const pointer=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.5,16),new THREE.MeshStandardMaterial({color:'#fff',emissive:'#ffd34d',emissiveIntensity:1.5}));pointer.rotation.z=Math.PI;pointer.position.set(0,2.55,0.2);wheelGroup.add(pointer)
  // A ring of bulbs round the Jackpot Chance wheel that chase while it spins and flash on the result.
  const JP_BULBS=28,jpBulbs=new THREE.InstancedMesh(new THREE.SphereGeometry(0.09,10,8),new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false}),JP_BULBS)
  for(let k=0;k<JP_BULBS;k++){const a=k/JP_BULBS*Math.PI*2;jpBulbs.setMatrixAt(k,new THREE.Matrix4().setPosition(Math.cos(a)*2.48,Math.sin(a)*2.48,0.18));jpBulbs.setColorAt(k,new THREE.Color(1,1,1))}
  wheelGroup.add(jpBulbs)
  const jpRim=new THREE.Mesh(new THREE.TorusGeometry(2.42,0.1,10,64),new THREE.MeshStandardMaterial({color:'#ffd34d',metalness:.9,roughness:.25,emissive:'#7a4a00',emissiveIntensity:.5}));jpRim.position.z=0.13;wheelGroup.add(jpRim)
  dishGroup.visible=false;wheelGroup.visible=false
  // ---- The show: marquee bulbs, the lighthouse and its lamps, KONO on the dock, sparkles ----
  const show={shake:0,party:0}
  // Bulbs round the pin board and along both top rails; they chase, and all flash for a big win.
  const bulbSpots:[number,number,number][]=[]
  for(let x=-5;x<=5.01;x+=0.42)bulbSpots.push([x,BTOP+0.66,BZ+0.1])
  for(let y=BBOTTOM-0.3;y<=BTOP+0.62;y+=0.42){bulbSpots.push([-5.14,y,BZ+0.1]);bulbSpots.push([5.14,y,BZ+0.1])}
  for(let z=-5.4;z<=5.6;z+=0.55){bulbSpots.push([-5.2,1.62,z]);bulbSpots.push([5.2,1.62,z])}
  const bulbs=new THREE.InstancedMesh(new THREE.SphereGeometry(0.075,10,8),new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false}),bulbSpots.length)
  bulbSpots.forEach(([x,y,z],i)=>{bulbs.setMatrixAt(i,new THREE.Matrix4().setPosition(x,y,z));bulbs.setColorAt(i,new THREE.Color(1,1,1))});scene.add(bulbs)
  const BULB=[new THREE.Color(2.4,1.7,0.5),new THREE.Color(2.2,0.7,1.4),new THREE.Color(0.6,1.8,2.4)],dim=new THREE.Color(0.35,0.25,0.12)
  // The lighthouse on the left of the dock: five rings that light up with the lamps, and a turning beacon.
  const house=new THREE.Group();house.position.set(-4.25,BTOP+0.6,BZ-0.35);house.scale.setScalar(0.62);scene.add(house)
  const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(0.9,0),toon('#b8a99a'));rock.scale.set(0.8,0.3,0.8);house.add(rock)
  const towerMat=toon('#ffffff',{map:stripeTexture()})
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.46,3,20),towerMat);tower.position.y=1.8;tower.castShadow=true;house.add(tower)
  const ringMats=Array.from({length:LAMPS},()=>new THREE.MeshStandardMaterial({color:'#3a3a3a',emissive:'#ffcf3d',emissiveIntensity:0}))
  ringMats.forEach((m,i)=>{const ring=new THREE.Mesh(new THREE.TorusGeometry(0.45-i*0.03,0.06,8,24),m);ring.rotation.x=Math.PI/2;ring.position.y=0.6+i*0.55;house.add(ring)})
  const lampRoom=new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.42,16),new THREE.MeshStandardMaterial({color:'#fff6d0',emissive:'#ffd36a',emissiveIntensity:1.6,transparent:true,opacity:.9}));lampRoom.position.y=3.5;house.add(lampRoom)
  const roof=new THREE.Mesh(new THREE.ConeGeometry(0.44,0.45,16),toon('#ff8fa3'));roof.position.y=3.93;house.add(roof)
  const beam=new THREE.Mesh(new THREE.ConeGeometry(0.9,5,24,1,true),new THREE.MeshBasicMaterial({color:'#fff2b0',transparent:true,opacity:.16,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}))
  beam.geometry.translate(0,-2.5,0);beam.rotation.z=Math.PI/2;const beamPivot=new THREE.Group();beamPivot.position.y=3.5;beamPivot.add(beam);house.add(beamPivot)
  // KONO on a dock post on the right, bobbing, and jumping for joy on a big win.
  // KONO's own animations (four frames each): breathing when it's quiet, waving as you drop, cheering on a win.
  const konoAnim=Object.fromEntries(['breathe','wave','cheer'].map(n=>{const t=loader.load('/garden/kono/anim/'+n+'.webp');t.colorSpace=THREE.SRGBColorSpace;t.repeat.set(0.25,1);return [n,t]})) as Record<'breathe'|'wave'|'cheer',THREE.Texture>
  const kono=new THREE.Sprite(new THREE.SpriteMaterial({map:konoAnim.breathe,alphaTest:0.04}));kono.center.set(0.5,0);kono.scale.set(1.5,1.5,1);scene.add(kono)
  // KONO sits on a little island on the cabinet's top right.
  // The Sanctuary's garden around the cabinet: trees behind, lanterns and flowers on the rails, the light
  // arch behind the giant tower, clouds in the sky, butterflies, a bird and falling petals.
  sprite('tree-blossom',5.6,-6.6,-0.6,-9);sprite('tree-leafy',5.2,6.7,-0.6,-9.2)
  sprite('light-arch',3.2,0,BTOP+0.45,BZ-1.3)
  sprite('lantern-post',1.5,-4.75,1.5,3.6);sprite('lantern-post',1.5,4.75,1.5,3.6).scale.x*=-1
  sprite('paper-lanterns',0.9,-4.6,1.5,-1.4);sprite('paper-lanterns',0.9,4.6,1.5,-1.4)
  ;[-4,-0.2,2.6].forEach((z,i)=>{sprite('flowers-'+(i%4+1),0.5,-5.25,1.5,z);sprite('flowers-'+((i+2)%4+1),0.5,5.25,1.5,z)})
  const clouds=['cloud-a','cloud-b','cloud-a','cloud-b'].map((n,i)=>sprite(n,1.4+i*0.2,0,BTOP+3.2+(i%2)*1.3,-15-i))
  const butterflies=['butterfly','butterfly-2'].map(n=>sprite(n,0.5,0,0,0))
  const bird=sprite('bird',0.45,0,0,-9)
  const petals=Array.from({length:24},(_,i)=>{const p=sprite(i%2?'petal-1':'petal-2',0.24,(Math.random()-.5)*12,Math.random()*(BTOP+4),-6+Math.random()*12);p.material.alphaTest=0.02;return p})
  const isle=new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.9,0.3,20),toon('#ffe6a8'));isle.position.set(4.1,BTOP+0.75,BZ-0.3);scene.add(isle)
  // Sparkles: gold glints, colored bursts and confetti, all in one additive point cloud.
  const SPARKS=500,sPos=new Float32Array(SPARKS*3),sCol=new Float32Array(SPARKS*3),sVel=new Float32Array(SPARKS*3),sLife=new Float32Array(SPARKS)
  const sGeo=new THREE.BufferGeometry();sGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));sGeo.setAttribute('color',new THREE.BufferAttribute(sCol,3))
  const sparks=new THREE.Points(sGeo,new THREE.PointsMaterial({size:0.16,vertexColors:true,map:pix('sparkle'),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));sparks.frustumCulled=false;scene.add(sparks)
  let sNext=0
  const emit=(x:number,y:number,z:number,n:number,palette:THREE.Color[],speed=2)=>{for(let k=0;k<n;k++){const i=sNext++%SPARKS,a=Math.random()*Math.PI*2,u=Math.random()*2-1,r=Math.sqrt(1-u*u),v=speed*(0.4+Math.random()*0.8)
   sPos.set([x,y,z],i*3);sVel.set([Math.cos(a)*r*v,Math.abs(u)*v+speed*0.6,Math.sin(a)*r*v],i*3);const col=palette[k%palette.length];sCol.set([col.r,col.g,col.b],i*3);sLife[i]=0.9+Math.random()*0.8}}
  const GOLD=[new THREE.Color(2.6,1.9,0.5),new THREE.Color(2.2,1.5,0.3)],CONFETTI=[new THREE.Color(2.6,0.6,0.7),new THREE.Color(2.6,2,0.4),new THREE.Color(0.5,1.6,2.8),new THREE.Color(0.7,2.4,1),new THREE.Color(2,0.9,2.6)]
  const POCKET_SPARK=[[new THREE.Color(2.8,0.9,0.6)],[new THREE.Color(2.8,2.2,0.5)],[new THREE.Color(0.6,1.8,2.8)]]
  // The three mini wheels on top of the pin board, one for each pocket, in its colors.
  const WHEEL_X=[-2.35,0,2.35],WHEEL_Y=BTOP+1.05
  const miniWheels=WHEELS.map((segs,i)=>{const g=new THREE.Group();g.position.set(WHEEL_X[i],WHEEL_Y,BZ-0.05);scene.add(g)
   const disc=new THREE.Mesh(new THREE.CircleGeometry(0.62,64),new THREE.MeshBasicMaterial({map:wheelSegTexture(segs,i),toneMapped:false,color:'#d6d6d6'}));g.add(disc)
   const rim=new THREE.Mesh(new THREE.TorusGeometry(0.64,0.05,8,40),new THREE.MeshStandardMaterial({color:'#ffe08a',metalness:.9,roughness:.25,emissive:'#ffb000',emissiveIntensity:.4}));g.add(rim)
   const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.08,16),new THREE.MeshStandardMaterial({color:'#fff',metalness:.8,roughness:.2}));hub.rotation.x=Math.PI/2;hub.position.z=0.03;g.add(hub)
   const tick=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.22,12),new THREE.MeshStandardMaterial({color:'#fff',emissive:'#ff5a7a',emissiveIntensity:1.5}));tick.rotation.z=Math.PI;tick.position.set(0,0.74,0.05);g.add(tick)
   return {g,disc,rim,angle:0,from:0,spinAt:-1,flash:0,seg:-1,end:0}})
  // The giant tower: a column of medals behind the board that grows with every layer won.
  const GIANT_MAX=60
  const giant=new THREE.InstancedMesh(new THREE.CylinderGeometry(R*1.25,R*1.25,HALF*2.2,26),new THREE.MeshStandardMaterial({color:'#ffd24a',metalness:1,roughness:.3,map:coinFace(),envMapIntensity:1.4,emissive:'#4a3000',emissiveIntensity:.25}),GIANT_MAX);giant.castShadow=true;scene.add(giant)
  const flyMesh=new THREE.InstancedMesh(giant.geometry,giant.material,48);flyMesh.frustumCulled=false;scene.add(flyMesh)
  const LAYER_TINT=[new THREE.Color(1,1,1),new THREE.Color(1,0.74,0.7),new THREE.Color(0.86,1,0.86),new THREE.Color(0.9,0.86,1)]
  const giantBase=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.72,0.2,24),new THREE.MeshStandardMaterial({color:'#2f6fb3',roughness:.4}));giantBase.position.set(0,BTOP+1.85,BZ-0.6);scene.add(giantBase)
  // Every texture sharp at an angle (the field, the coins, the wheels).
  scene.traverse(o=>{const mat=(o as THREE.Mesh).material as THREE.Material|THREE.Material[]|undefined;(Array.isArray(mat)?mat:mat?[mat]:[]).forEach(m=>{const t=(m as THREE.MeshStandardMaterial).map;if(t&&t.magFilter!==THREE.NearestFilter)t.anisotropy=aniso})})
  // ---- The physics world ----
  const world=new RAPIER.World({x:0,y:-22,z:0})
  world.integrationParameters.numSolverIterations=4
  const fixed=(hx:number,hy:number,hz:number,x:number,y:number,z:number,friction=0.5)=>world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setTranslation(x,y,z).setFriction(friction))
  fixed(5.2,0.2,6.8,0,-0.2,FRONT-6.8)            // the deck, ending at the front edge
  // Side walls, open near the front (the side drops), with a gap at the top where each slide comes over.
  for(const s of [-1,1]){const g0=RAMP_Z-RAMP_HALF-0.08,g1=RAMP_Z+RAMP_HALF+0.08
   fixed(0.1,1.2,(g0+7.2)/2,s*5.05,1.0,(g0-7.2)/2);fixed(0.1,1.2,(4.0-g1)/2,s*5.05,1.0,(4.0+g1)/2);fixed(0.1,0.625,(g1-g0)/2,s*5.05,0.425,RAMP_Z)}
  // The two side slides: troughs from up beside the pin board down onto the pusher's shelf (rails each side,
  // a stop at the top). Prize medals slide down them and balls roll; see the release in the loop.
  const rampQ:boolean[][]=[[],[]],rampLast=[-99,-99],rampGlow=[0,0]
  const rampMat=toon('#ffd7e6'),railMat=new THREE.MeshStandardMaterial({color:'#ffe08a',metalness:.85,roughness:.25,emissive:'#ffb000',emissiveIntensity:.15})
  const mouths:THREE.MeshStandardMaterial[]=[]
  RAMPS.forEach(r=>{const s=r.s,tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),s*r.angle),rot={x:tilt.x,y:tilt.y,z:tilt.z,w:tilt.w}
   const mid=new THREE.Vector3((r.top.x+r.bot.x)/2,(r.top.y+r.bot.y)/2,RAMP_Z),n=new THREE.Vector3(-s*Math.sin(r.angle),Math.cos(r.angle),0)
   const part=(hx:number,hy:number,hz:number,off:THREE.Vector3,mat:THREE.Material,friction:number)=>{const at=mid.clone().add(off)
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setTranslation(at.x,at.y,at.z).setRotation(rot).setFriction(friction).setRestitution(0.05))
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(hx*2,hy*2,hz*2),mat);mesh.position.copy(at);mesh.quaternion.copy(tilt);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh)}
   part(r.len/2,0.04,RAMP_HALF,n.clone().multiplyScalar(-0.04),rampMat,0.08)                                       // the slide
   part(r.len/2,0.16,0.03,new THREE.Vector3(0,0,-(RAMP_HALF-0.03)).add(n.clone().multiplyScalar(0.12)),railMat,0.02) // back rail
   part(r.len/2,0.16,0.03,new THREE.Vector3(0,0,RAMP_HALF-0.03).add(n.clone().multiplyScalar(0.12)),railMat,0.02)    // front rail
   // The stop at the outer top, a post holding it up out of the sea, and the glowing mouth the medals come out of.
   world.createCollider(RAPIER.ColliderDesc.cuboid(0.04,0.3,RAMP_HALF).setTranslation(r.top.x+s*0.05,r.top.y+0.25,RAMP_Z))
   const post=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.12,r.top.y+2.6,12),railMat);post.position.set(r.top.x-s*0.1,(r.top.y-2.6)/2,RAMP_Z);scene.add(post)
   const mouthMat=new THREE.MeshStandardMaterial({color:'#fff3c0',emissive:'#ffcf3d',emissiveIntensity:.4,metalness:.3,roughness:.4});mouths.push(mouthMat)
   const mouth=new THREE.Mesh(new THREE.CylinderGeometry(RAMP_HALF*0.9,RAMP_HALF*0.9,0.5,24,1,true),mouthMat);mouth.material.side=THREE.DoubleSide;mouth.rotation.z=Math.PI/2;mouth.position.set(r.top.x+s*0.15,r.top.y+0.32,RAMP_Z);scene.add(mouth)})
  fixed(5.2,1.5,0.2,0,1.1,-7.8)                   // back wall
  fixed(5.0,0.5,0.15,0,1.36,-6.55)                // the scraper above the pusher's shelf
  fixed(5.2,0.15,1.3,0,-2.15,7.4,0.9)             // the tray
  fixed(0.1,0.6,1.3,-5.2,-1.6,7.4);fixed(0.1,0.6,1.3,5.2,-1.6,7.4);fixed(5.2,0.6,0.1,0,-1.6,8.7)
  // ---- The gadgets ----
  // The ball run: a gold track zig-zagging down beside the pin board; a prize ball rolls down it (drawn
  // along the track), then onto the left slide as a real ball.
  const runCurve=new THREE.CurvePath<THREE.Vector3>();for(let i=1;i<RUN.length;i++)runCurve.add(new THREE.LineCurve3(new THREE.Vector3(...RUN[i-1]).add(new THREE.Vector3(0,-BALL-0.04,0)),new THREE.Vector3(...RUN[i]).add(new THREE.Vector3(0,-BALL-0.04,0))))
  const runMat=new THREE.MeshStandardMaterial({color:'#ffe08a',metalness:.9,roughness:.22,emissive:'#ffb000',emissiveIntensity:.15})
  for(const dz of [-0.17,0.17]){const tube=new THREE.Mesh(new THREE.TubeGeometry(runCurve,120,0.035,8,false),runMat);tube.position.z=dz;tube.castShadow=true;scene.add(tube)}
  RUN.forEach(([x,y,z],i)=>{if(i===0||i===RUN.length-1)return;const post=new THREE.Mesh(new THREE.SphereGeometry(0.09,12,8),runMat);post.position.set(x,y-BALL-0.04,z);scene.add(post)})
  const runBalls=Array.from({length:4},()=>{const m=new THREE.Mesh(new THREE.SphereGeometry(BALL,24,16),new THREE.MeshPhysicalMaterial({color:'#9d6bff',roughness:.15,clearcoat:1,emissive:'#5a2fd0',emissiveIntensity:.8}));m.visible=false;m.castShadow=true;scene.add(m);return m})
  const ballRuns:{t:number;seg:number}[]=[]
  // The turntable: a real spinning plate (kinematic) that drags the medals on it round and sideways.
  const turnBody=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,0.03,TURN.z))
  world.createCollider(RAPIER.ColliderDesc.cylinder(0.03,TURN.r).setFriction(0.7),turnBody)
  const turnMesh=new THREE.Mesh(new THREE.CylinderGeometry(TURN.r,TURN.r,0.06,64),[toon('#ffc7da'),new THREE.MeshStandardMaterial({map:turnTexture(),roughness:.5}),toon('#ffc7da')]);turnMesh.position.set(0,0.03,TURN.z);turnMesh.receiveShadow=true;scene.add(turnMesh)
  let turnAngle=0
  // The seesaw tray: open-topped, it catches what comes down the right slide; full, it tips onto the field.
  const seesaw=new THREE.Group();seesaw.position.set(SEESAW.x+0.55,SEESAW.y-0.12,SEESAW.z);scene.add(seesaw)
  const trayMat=toon('#8fdcc2'),trayParts:[number,number,number,number,number,number][]=[[-0.55,0,0,1.1,0.05,0.95],[-0.55,0.13,-0.47,1.1,0.26,0.04],[-0.55,0.13,0.47,1.1,0.26,0.04],[0,0.13,0,0.05,0.26,0.95],[-1.1,0.06,0,0.04,0.12,0.95]]
  for(const [x,y,z,w,h,d] of trayParts){const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),trayMat);b.position.set(x,y,z);b.castShadow=true;seesaw.add(b)}
  const seesawCoins=new THREE.InstancedMesh(new THREE.CylinderGeometry(R,R,HALF*2,32),coinsMaterial(),SEESAW.full+4);seesaw.add(seesawCoins);seesawCoins.count=0
  const see={n:0,tip:-1}
  // KONO's bucket, beside KONO: a medal goes in for every pocket hit; full, KONO throws them onto the field.
  const bucket=new THREE.Group();scene.add(bucket)
  const pail=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.22,0.36,20,1,true),new THREE.MeshStandardMaterial({color:'#7fd0ff',metalness:.4,roughness:.35,side:THREE.DoubleSide}));bucket.add(pail)
  const pailBottom=new THREE.Mesh(new THREE.CircleGeometry(0.22,20),pail.material);pailBottom.rotation.x=-Math.PI/2;pailBottom.position.y=-0.17;bucket.add(pailBottom)
  const handle=new THREE.Mesh(new THREE.TorusGeometry(0.3,0.02,6,20,Math.PI),new THREE.MeshStandardMaterial({color:'#c9d6e3',metalness:.9,roughness:.2}));handle.position.y=0.18;bucket.add(handle)
  const bucketCoins=new THREE.InstancedMesh(new THREE.CylinderGeometry(R*0.6,R*0.6,HALF*1.6,24),coinsMaterial(),BUCKET_FULL);bucket.add(bucketCoins);bucketCoins.count=0
  const pail2={n:0,toss:-1}
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
   pieces.set(body.handle,{body,ball,counted:0,board});return body}
  // The pile to start with: a few layers across the field, settled before you play.
  for(let layer=0;layer<2;layer++)for(let z=wz(FIELD.reach+3);z<FRONT-0.4;z+=R*1.9)for(let x=-4.6;x<=4.6;x+=R*2.05)if(layer===0||Math.random()<0.55)addCoin(x+(Math.random()-.5)*0.1,0.06+layer*0.13,z+(Math.random()-.5)*0.1)
  pusherBody.setNextKinematicTranslation({x:0,y:0.3,z:wz(FIELD.back)-3})
  for(let i=0;i<90;i++)world.step()
  // ---- Camera: one of four views, nudged by dragging off the field ----
  const orbit={yaw:VIEWS[0].yaw,pitch:VIEWS[0].pitch,dist:VIEWS[0].dist,dragYaw:0,dragPitch:0}
  const placeCamera=()=>{const v=VIEWS[viewRef.current]
   orbit.yaw+=(v.yaw+orbit.dragYaw-orbit.yaw)*0.12;orbit.pitch+=(Math.max(0.25,Math.min(1.25,v.pitch+orbit.dragPitch))-orbit.pitch)*0.12;orbit.dist+=(v.dist-orbit.dist)*0.12
   camera.position.set(Math.sin(orbit.yaw)*Math.cos(orbit.pitch)*orbit.dist,Math.sin(orbit.pitch)*orbit.dist,Math.cos(orbit.yaw)*Math.cos(orbit.pitch)*orbit.dist+0.5);camera.lookAt(0,2.2,-1.2)}
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);composer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w/h<0.8?52:42;camera.updateProjectionMatrix()}
  resize();const ro=new ResizeObserver(resize);ro.observe(el)
  // Big words that pop up where things happen ("IN!", a wheel's prize, COMBO, TIMBER!), and a buzz.
  const proj=new THREE.Vector3()
  const pop=(text:string,x:number,y:number,z:number,kind='')=>{proj.set(x,y,z).project(camera);const id=++popId.current
   setPops(ps=>[...ps.slice(-6),{id,text,x:(proj.x+1)/2*100,y:(1-proj.y)/2*100,kind}]);window.setTimeout(()=>setPops(ps=>ps.filter(p=>p.id!==id)),kind==='big'?2200:1300)}
  const buzz=(pattern:number|number[])=>{try{navigator.vibrate?.(pattern)}catch{/* no vibration here */}}
  // The moment: slow motion as a medal is about to drop into a pocket; a cinematic for the BIG BONUS.
  let slow=1,cine:{at:number;bank:number;released:boolean}|null=null
  // The giant tower as drawn: it grows a medal at a time toward what's banked, swaying as each one lands.
  let giantShown=Math.min(60,Math.round(BANK_START/2)),giantWhole=Math.floor(giantShown),sway=0
  // Tower layers arrive as medals flying in an arc from the wheel that won them to the top of the tower;
  // the tower only grows as each one lands (`giantHave`, one drawn medal for every two banked).
  let giantHave=Math.round(BANK_START/2),bankSeen=BANK_START,bankOwed=0,layerFrom=2
  const fliers:{from:THREE.Vector3;t:number}[]=[]
  // A jackpot win: the big counter counts up while it rains medals and fireworks go off.
  let jpAt=-1,jpAmount=0
  const wheelSeg=[-1,-1,-1],chanceTick={last:-1}
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
    // A drop goes in at the top of the pin board; every prize medal and ball queues for a side slide.
    for(const m of c.medals){if(m.y<0)addCoin(Math.max(-4.5,Math.min(4.5,wx(m.x)+(Math.random()-.5)*0.08)),BTOP+0.3,BZ,false,(Math.random()-.5)*3,true)
     else if(m.ball)ballRuns.push({t:-ballRuns.length*40,seg:0})
     else{const side=rampQ[0].length<rampQ[1].length?0:rampQ[1].length<rampQ[0].length?1:m.x<50?0:1;rampQ[side].push(false)}}
    // The slides let them out one at a time: medals slide (and sometimes roll on their edge), balls roll.
    for(const side of [0,1]){const q=rampQ[side];if(!q.length||c.frame-rampLast[side]<(q[0]?18:6))continue
     const ball=q.shift()!,s=side?1:-1,r=RAMPS[side],x=s*(RAMP_OUT-0.3);rampLast[side]=c.frame;rampGlow[side]=1
     const b=addCoin(x,r.at(x)+(ball?BALL:0.12)+0.06,RAMP_Z+(Math.random()-.5)*0.3,ball,(Math.random()-.5)*2)
     b.setLinvel({x:r.dir.x*1.2,y:r.dir.y*1.2,z:0},true);if(!ball&&Math.random()<0.25)b.setAngvel({x:(Math.random()-.5)*10,y:0,z:0},true);pieces.get(b.handle)!.ramp=side+1}
    // The ball run: each ball speeds up down the track, clicks at each corner, then drops onto the left slide.
    for(let k=ballRuns.length-1;k>=0;k--){const br=ballRuns[k];br.t++;if(br.t<0)continue
     const sd=0.035*br.t*(1+br.t/90),seg=Math.min(RUN.length-2,Math.floor(sd/RUN_LEN*(RUN.length-1)))
     if(seg!==br.seg){br.seg=seg;fx('tick',soundRef.current)}
     if(sd>=RUN_LEN){ballRuns.splice(k,1);const r=RAMPS[0],x=-(RAMP_OUT-0.3),b=addCoin(x,r.at(x)+BALL+0.06,RAMP_Z,true);b.setLinvel({x:r.dir.x*2,y:r.dir.y*2,z:0},true);rampGlow[0]=1;fx('zap',soundRef.current)}}
    // The turntable turns, slowly.
    turnAngle+=0.006;turnBody.setNextKinematicRotation({x:0,y:Math.sin(turnAngle/2),z:0,w:Math.cos(turnAngle/2)})
    c=spawned(c)
    // A tower stands as a real stack, a little in front of the pusher, until it's knocked over.
    const evNow=c.events[c.events.length-1]
    if(evNow&&evNow!==before.events[before.events.length-1]&&/BIG BONUS/.test(evNow.text))cine={at:c.frame,bank:before.bank??BANK_START,released:false}
    for(const t of c.towers)if(!builtTowers.has(t.at)&&!(cine&&t.at===cine.at)){builtTowers.add(t.at);const cols=Math.ceil(t.n/22),per=Math.ceil(t.n/cols)
      for(let k=0;k<cols;k++){const cx=cols===1?wx(t.x):(k-(cols-1)/2)*0.78,cz=wz(c.pusher+9)+(k%2)*0.5;for(let i=0;i<per&&k*per+i<t.n;i++)addCoin(cx+Math.cos(i*0.55)*0.035,0.06+i*0.112+(cols>1?1.2:0),cz+Math.sin(i*0.55)*0.035);emit(cx,1.6,cz,cols>1?60:40,GOLD,cols>1?4:2.5)}
      }
    // The pusher moves, the world steps.
    pusherBody.setNextKinematicTranslation({x:0,y:0.3,z:wz(c.pusher)-3})
    // A medal about to fall into a pocket: time slows, the pocket glows and a drum-roll ticks.
    const wide=inFever(c)?1.35:1
    let near=-1
    for(const p of pieces.values()){if(!p.board)continue;const t=p.body.translation();if(t.y>BBOTTOM&&t.y<BBOTTOM+0.7){const i=POCKET_W.findIndex((w,k)=>Math.abs(t.x-pocketX(k,c.frame))<w*wide/2);if(i>=0){near=i;break}}}
    const wantSlow=near>=0?0.32:cine&&c.frame-cine.at>TOPPLE_AT+28&&c.frame-cine.at<TOPPLE_AT+110?0.35:1
    slow+=(wantSlow-slow)*0.25;world.timestep=slow/60
    if(near>=0){pocketMeshes[near].flash=Math.max(pocketMeshes[near].flash,0.45);if(c.frame%5===0)fx('tick',soundRef.current)}
    world.step()
    // The board's bottom: into a pocket, or out onto the pusher's shelf (where it tips over and joins the pile).
    for(const [h,p] of pieces){if(!p.board)continue;const t=p.body.translation()
     // A medal sitting still on a pin gets the little nudge a real cabinet's rattle gives it.
     if(t.y>BBOTTOM){const v=p.body.linvel();if(Math.abs(v.x)+Math.abs(v.y)<0.25)p.body.setLinvel({x:(Math.random()<.5?-1:1)*(0.8+Math.random()*0.8),y:v.y,z:0},true);continue}
     const hit=POCKET_W.findIndex((w,i)=>Math.abs(t.x-pocketX(i,c.frame))<w*wide/2-0.05)
     if(hit>=0){world.removeRigidBody(p.body);pieces.delete(h);c=pocket(c,POCKETS[hit]);if(pail2.toss<0&&pail2.n<BUCKET_FULL)pail2.n++;pop('IN! '+POCKET_FACE[hit],pocketX(hit,c.frame),BBOTTOM+0.4,BZ+0.3,'in'+hit);buzz(30);pocketMeshes[hit].flash=1;emit(pocketX(hit,c.frame),BBOTTOM,BZ+0.3,30,POCKET_SPARK[hit],2.2);fx(hit===1?'star':'zap',soundRef.current)}
     else{p.board=false;p.body.setEnabledTranslations(true,true,true,true);p.body.setEnabledRotations(true,true,true,true);p.body.setLinvel({x:p.body.linvel().x*0.5,y:-1,z:0.6},true)}}
    // What fell: off the front is yours, off the sides is lost; a ball off the front goes to the ball lottery.
    // The seesaw catches what comes off the right slide; full (or at the end of a session), it tips it all out.
    for(const [h,p] of pieces){if(p.ramp!==2||p.counted||see.tip>=0||see.n>=SEESAW.full)continue;const t=p.body.translation()
     if(t.x>3.3&&t.x<4.45&&Math.abs(t.z-SEESAW.z)<0.55&&t.y<1.45&&t.y>0.9){world.removeRigidBody(p.body);pieces.delete(h);see.n++;fx('tick',soundRef.current)}}
    if(see.tip<0&&see.n>0&&(see.n>=SEESAW.full||(c.hand<=0&&!rampQ[1].length)))see.tip=0
    if(see.tip>=0){see.tip++
     if(see.tip===14){for(let k=0;k<see.n;k++){const b=addCoin(SEESAW.x-0.25+(Math.random()-.5)*0.4,SEESAW.y+0.25+k*0.05,SEESAW.z+(Math.random()-.5)*0.6);b.setLinvel({x:-2.6-Math.random(),y:1.2,z:0.6+Math.random()*0.6},true)}
      emit(SEESAW.x-0.4,SEESAW.y+0.3,SEESAW.z,14,GOLD,1.6);fx('land',soundRef.current);buzz(20);see.n=0}
     if(see.tip>60)see.tip=-1}
    // KONO's bucket: full, KONO cheers and throws the medals over the pin board onto the field.
    if(pail2.toss<0&&pail2.n>=BUCKET_FULL){pail2.toss=0;pop('KONO’s bucket!',3.4,BTOP+1.9,BZ,'prize2');fx('fanfare',soundRef.current)}
    if(pail2.toss>=0){pail2.toss++
     if(pail2.toss===34){const at=bucket.position;for(let k=0;k<pail2.n;k++){const b=addCoin(at.x-0.1+(Math.random()-.5)*0.2,at.y+0.15+k*0.06,at.z+0.2,false,(Math.random()-.5)*8);b.setLinvel({x:-1-Math.random()*2.4,y:1.6+Math.random(),z:4+Math.random()*1.6},true)}
      emit(at.x,at.y+0.2,at.z,24,GOLD,2.4);pail2.n=0;fx('star',soundRef.current)}
     if(pail2.toss>80)pail2.toss=-1}
    let won=0,lost=0,ballsWon=0
    for(const [h,p] of pieces){const t=p.body.translation()
     if(!p.counted&&t.y<-0.4){p.counted=c.frame;if(t.z>FRONT-0.2&&Math.abs(t.x)<5.3){if(p.ball)ballsWon++;else won++;emit(t.x,-0.3,FRONT+0.2,4,GOLD,1.4)}else{if(p.ball)ballsWon++;else lost++}}
     if(p.counted&&(p.ball||t.y<-3.5||c.frame-p.counted>150)){world.removeRigidBody(p.body);pieces.delete(h)}}
    c=settle(c,won,lost,ballsWon)
    cove.current=c;acc-=1000/60
    if(won)fx('ding',soundRef.current)
    const ev=c.events[c.events.length-1];if(ev&&ev!==before.events[before.events.length-1]){setHud(h=>({...h,event:ev.text,big:/BIG BONUS|JACKPOT[!]/.test(ev.text)}))
     if(/BIG BONUS/.test(ev.text)){show.party=300;buzz([60,40,60,40,200]);pop('BIG BONUS!',0,BTOP+2.6,BZ,'big');fx('fanfare',soundRef.current)}
     else if(/FEVER/.test(ev.text)){show.party=180;emit(0,BTOP,BZ+1,160,CONFETTI,4);pop('🌈 FEVER TIME!',0,BTOP-0.5,BZ+0.5,'big');buzz([40,30,40,30,120]);fx('blaze',soundRef.current)}
     else if(/COMBO/.test(ev.text)){const m=/×(\d+)/.exec(ev.text);pop('COMBO ×'+(m?.[1]??''),0,BTOP-1,BZ+0.5,'combo');fx('mult',soundRef.current)}
     if(/JACKPOT[!]/.test(ev.text)){show.party=420;show.shake=1.6;emit(0,3,0,300,CONFETTI,6);buzz([100,50,100,50,300,80,300]);jpAt=c.frame;jpAmount=Number(/\+(\d+)/.exec(ev.text)?.[1]??0);setJpWin(jpAmount)}
     else if(/So close/.test(ev.text))pop('So close…',0,2,1,'')
     if(/CHANCE/.test(ev.text)&&!/FEVER/.test(ev.text)){show.party=120;emit(0,2.5,0,90,CONFETTI,3.5)}else if(/shower/i.test(ev.text))emit(0,3,-1,60,GOLD,3);if(/JACKPOT!/.test(ev.text)){fx('mega',soundRef.current);gameSound('win',soundRef.current)}else if(/CHANCE|tower|shower|ball/i.test(ev.text))fx('fanfare',soundRef.current)}
    if(c.spinning&&!before.spinning)fx('charge',soundRef.current)
   }
   if(acc>1000/60*4)acc=0
   const c=cove.current,f=c.frame
   // Draw the machine where the physics has it.
   const pz=wz(c.pusher);pusherMesh.position.set(0,0.3,pz-3)
   const ax=Math.max(-4.5,Math.min(4.5,wx(aim.current)));chute.position.set(ax,BTOP+0.32+Math.sin(f/12)*0.03,BZ);chute.visible=c.hand>0
   pocketMeshes.forEach((pm,i)=>{pm.g.position.x=pocketX(i,f);pm.flash=Math.max(0,pm.flash-0.03);pm.mat.emissiveIntensity=0.9+pm.flash*4+(show.party>0?Math.abs(Math.sin(f/4+i)):0);const bounce=1+Math.sin(pm.flash*Math.PI)*0.35,widen=inFever(c)?1.35:1;pm.g.scale.set(bounce*widen,bounce,bounce)})
   let n=0,b=0
   for(const p of pieces.values()){const t=p.body.translation(),r=p.body.rotation()
    m4.compose(v3.set(t.x,t.y,t.z),q.set(r.x,r.y,r.z,r.w),s3)
    if(p.ball){if(b<16)balls.setMatrixAt(b++,m4)}else if(n<MAX)coins.setMatrixAt(n++,m4)}
   coins.count=n;coins.instanceMatrix.needsUpdate=true;balls.count=b;balls.instanceMatrix.needsUpdate=true
   // The mini wheels spin down onto their segment; the giant tower stands as high as it's grown.
   miniWheels.forEach((w,i)=>{const sp=c.wheels?.[i]
    if(sp&&sp.at!==w.spinAt){w.spinAt=sp.at;w.from=w.angle;fx('charge',soundRef.current);setDials(d=>d.map((x,k)=>k===i?{spin:true,prize:'',kind:'',at:f}:x))}
    // The rules may finish a spin between two drawn frames, so a spin also ends when the wheel's gone idle.
    let t=1
    if(sp){t=Math.min(1,(f-sp.at)/WHEEL_FRAMES);const target=sp.seg*Math.PI/4,base=w.from-(w.from%(Math.PI*2));w.end=base+Math.PI*2*4+target;w.seg=sp.seg
     w.angle=w.from+(w.end-w.from)*(1-(1-t)**3)
     // A click as each segment passes the pointer, slowing down with the wheel.
     const under=Math.round(w.angle/(Math.PI/4));if(under!==wheelSeg[i]&&t<1){wheelSeg[i]=under;fx('tick',soundRef.current)}}
    if(w.seg>=0&&t>=1){if(!sp)w.angle=w.end;w.flash=1;emit(WHEEL_X[i],WHEEL_Y,BZ+0.3,40,POCKET_SPARK[i],2.6);const seg=WHEELS[i][w.seg];w.seg=-1;fx(seg.kind==='lamp'||seg.kind==='ball'?'star':'ding',soundRef.current)
     pop(seg.kind==='medals'?'+'+seg.n+' 🪙':seg.kind==='layers'?'+'+seg.n+' 🗼 '+(seg.n===1?'LAYER':'LAYERS'):seg.kind==='ball'?'🔮 BALL!':seg.kind==='lamp'?'💡 LAMP!':'🎰 SPIN!',WHEEL_X[i],WHEEL_Y+0.5,BZ,'prize'+i)
     if(seg.kind==='layers')layerFrom=i;setDials(d=>d.map((x,k)=>k===i?{spin:false,prize:prizeText(seg),kind:seg.kind,at:f}:x))}
    else if(!sp&&w.seg<0)w.angle+=0.004
    w.disc.rotation.z=w.angle;dialEls.current[i]?.setAttribute('transform','rotate('+(-w.angle*180/Math.PI).toFixed(2)+')');w.flash=Math.max(0,w.flash-0.02);(w.rim.material as THREE.MeshStandardMaterial).emissiveIntensity=0.4+w.flash*3+(sp?0.6*Math.abs(Math.sin(f/4)):0)
    if(!sp&&w.flash<0.02)w.flash=0})
   // The giant tower. Normally it grows toward what's banked a medal at a time: each new medal drops onto
   // the top and the tower sways a little as it lands. On the BIG BONUS it wobbles, harder and harder, then
   // topples forward like a falling pole (slowly, then fast), and at the end every medal in it pours out as a
   // real medal onto the field.
   const ct=cine?f-cine.at:-1
   if(!cine||cine.released){
    // New layers banked: send their medals flying, a few frames apart.
    const bank=c.bank??BANK_START
    if(bank>bankSeen){bankOwed+=bank-bankSeen;const n=Math.floor(bankOwed/2);bankOwed-=n*2;for(let k=0;k<n;k++)fliers.push({from:new THREE.Vector3(WHEEL_X[layerFrom],WHEEL_Y,BZ+0.15),t:-k*5-fliers.length*0})}
    bankSeen=bank
    const want=Math.min(GIANT_MAX,giantHave)
    if(giantShown<want){giantShown=Math.min(want,giantShown+0.3);if(Math.floor(giantShown)!==giantWhole){giantWhole=Math.floor(giantShown);sway=Math.min(1,sway+0.5);if(giantWhole%2===0)fx('tick',soundRef.current)}}
    else if(giantShown>want){giantShown=want;giantWhole=Math.floor(want)}}
   sway*=0.94
   const whole=Math.floor(giantShown),part=giantShown-whole,gn=Math.min(GIANT_MAX,whole+(part>0?1:0))
   const baseY=BTOP+1.92,baseZ=BZ-0.6
   let tilt=0,lean=0,omega=0
   if(cine&&!cine.released){
    if(ct<TOPPLE_AT){lean=Math.sin(ct*0.45)*0.07*Math.min(1,ct/TOPPLE_AT)**1.5}
    else{const k=ct-TOPPLE_AT;tilt=0.04*Math.cosh(0.104*k);omega=0.04*0.104*Math.sinh(0.104*k)}
    if(ct===TOPPLE_AT){pop('TIMBER!',0,BTOP+2.6,BZ,'big');fx('charge',soundRef.current)}
    // It's fallen far enough: every medal it held becomes a real one, flying on with the tower's swing.
    if(tilt>=1.25){cine.released=true;builtTowers.add(cine.at)
     const n=Math.max(1,cine.bank),len=Math.max(0.3,gn*0.124),dir=new THREE.Vector3(0,Math.cos(tilt),Math.sin(tilt)),tan=new THREE.Vector3(0,-Math.sin(tilt),Math.cos(tilt))
     for(let k=0;k<n;k++){const r=(k+0.5)/n*len,p=new THREE.Vector3(0,baseY,baseZ).addScaledVector(dir,r),v=tan.clone().multiplyScalar(omega*60*r*0.8)
      addCoin(p.x+(Math.random()-.5)*0.5,p.y+(Math.random()-.5)*0.2,Math.max(BZ+0.5,p.z+(Math.random()-.5)*0.3),false,(Math.random()-.5)*6)
      const body=[...pieces.values()].pop()?.body;body?.setLinvel({x:(Math.random()-.5)*1.5,y:v.y,z:v.z},true)}
     emit(0,BTOP,BZ+1.5,160,GOLD,4);show.shake=1.4;buzz([120,40,200]);fx('boom',soundRef.current)
     giantShown=0;giantWhole=0;giantHave=0;bankSeen=0;bankOwed=0;fliers.length=0}}
   const spin=new THREE.Quaternion(),tip=new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt,0,lean+Math.sin(f*0.3)*sway*0.025))
   const showTower=!(cine&&cine.released&&ct<TOPPLE_AT+120)||giantShown>0
   const drawn=showTower?gn:0
   for(let i=0;i<drawn;i++){
    // The newest medal falls the last bit onto the top.
    const drop=i===whole&&part>0?(1-part)*1.4:0
    const local=new THREE.Vector3(Math.cos(i*0.5)*0.04,i*0.124+drop,Math.sin(i*0.5)*0.04).applyQuaternion(tip)
    spin.setFromEuler(new THREE.Euler(0,i*0.4,0));m4.compose(v3.set(local.x,baseY+local.y,baseZ+local.z),q.copy(tip).multiply(spin),s3);giant.setMatrixAt(i,m4)}
   giant.count=drawn;giant.instanceMatrix.needsUpdate=true
   // Each layer in its own tint, so you can see the tower's layers; it glows more the taller it gets.
   for(let i=0;i<drawn;i++)giant.setColorAt(i,LAYER_TINT[Math.floor(i*2/LAYER)%LAYER_TINT.length]);if(giant.instanceColor)giant.instanceColor.needsUpdate=true
   ;(giant.material as THREE.MeshStandardMaterial).emissiveIntensity=0.2+Math.min(0.9,giantHave/50)*(0.8+0.2*Math.sin(f/7))
   // The flying medals: up from the wheel in an arc, tumbling, onto the top. Each landing grows the tower.
   let nFly=0
   const topY=baseY+giantHave*0.124+0.2
   for(let k=fliers.length-1;k>=0;k--){const fly=fliers[k];fly.t++;if(fly.t<0)continue
    const p=Math.min(1,fly.t/26),e=p*p*(3-2*p)
    if(p>=1){fliers.splice(k,1);if(cine&&!cine.released)continue;giantHave++;sway=Math.min(1,sway+0.4);emit(0,topY,baseZ+0.2,5,GOLD,1.2);fx('tick',soundRef.current)
     if(giantHave*2%20===0){pop('🗼 '+giantHave*2+'!',0,topY+0.6,baseZ+0.4,'prize2');emit(0,topY,baseZ+0.3,40,GOLD,2.8);fx('star',soundRef.current)}
     continue}
    if(nFly>=48)continue
    m4.compose(v3.set(fly.from.x*(1-e),fly.from.y+(topY-fly.from.y)*e+Math.sin(p*Math.PI)*1.8,fly.from.z+(baseZ-fly.from.z)*e+Math.sin(p*Math.PI)*0.5),q.setFromEuler(new THREE.Euler(p*9,p*4,p*6)),s3);flyMesh.setMatrixAt(nFly++,m4)}
   flyMesh.count=nFly;flyMesh.instanceMatrix.needsUpdate=true
   if(cine&&ct>TOPPLE_AT+150)cine=null
   // The gadgets as they are now: balls on the run, the turntable, the seesaw and its medals, KONO's bucket.
   runBalls.forEach((m,k)=>{const br=ballRuns[k];m.visible=!!br&&br.t>=0;if(!m.visible)return
    const sd=0.035*br.t*(1+br.t/90),u=Math.min(0.999,sd/RUN_LEN);m.position.copy(runCurve.getPointAt(u)).add(new THREE.Vector3(0,BALL+0.04,0));m.rotation.z=-sd/BALL})
   turnMesh.rotation.y=turnAngle
   {const tipT=see.tip<0?0:see.tip<14?see.tip/14:see.tip<30?1:Math.max(0,1-(see.tip-30)/30);seesaw.rotation.z=tipT*0.9
    for(let k=0;k<see.n;k++){m4.compose(v3.set(-0.55+((k%3)-1)*0.28,0.08+Math.floor(k/3)*0.12,((k*7)%3-1)*0.24),q.setFromEuler(new THREE.Euler(0,k,0)),s3);seesawCoins.setMatrixAt(k,m4)}
    seesawCoins.count=see.n;seesawCoins.instanceMatrix.needsUpdate=true}
   {const tt=pail2.toss,tip=tt<0?0:tt<20?0:tt<34?(tt-20)/14:tt<50?1:Math.max(0,1-(tt-50)/30)
    bucket.position.set(kono.position.x-0.75,kono.position.y+0.3+(tt>=0&&tt<34?Math.sin(tt/34*Math.PI)*0.5:0),kono.position.z+0.15);bucket.rotation.set(tip*1.6,0,tip*0.4)
    for(let k=0;k<pail2.n;k++){m4.compose(v3.set(0,-0.14+k*0.05,0),q.setFromEuler(new THREE.Euler(0,k*0.8,0)),s3);bucketCoins.setMatrixAt(k,m4)}
    bucketCoins.count=pail2.n;bucketCoins.instanceMatrix.needsUpdate=true}
   // The slides' mouths glow as they let medals out.
   mouths.forEach((m,i)=>{rampGlow[i]=Math.max(0,rampGlow[i]-0.04);m.emissiveIntensity=0.4+rampGlow[i]*2.2})
   // The show.
   const party=show.party>0;show.party=Math.max(0,show.party-1);show.shake*=0.92
   const feverOn=inFever(c)||!!c.chance||jpAt>=0,RAINBOW=CONFETTI
   bulbSpots.forEach((_,i)=>{if(feverOn){bulbs.setColorAt(i,RAINBOW[(i+Math.floor(f/3))%RAINBOW.length]);return}const on=party?((i+Math.floor(f/3))%2===0):((i+Math.floor(f/5))%5===0);bulbs.setColorAt(i,on?BULB[(i+Math.floor(f/(party?6:40)))%3]:dim)});if(bulbs.instanceColor)bulbs.instanceColor.needsUpdate=true
   ringMats.forEach((m,i)=>{const lit=i<c.steps;m.emissiveIntensity=lit?2.2+0.6*Math.sin(f/6+i):party?(f/4+i)%2<1?2:0:0;m.color.set(lit?'#ffe08a':'#3a3a3a')})
   beamPivot.rotation.y=f*(party?0.12:0.03);(beam.material as THREE.MeshBasicMaterial).opacity=party?0.3:0.16
   const anim=party||pail2.toss>=0?konoAnim.cheer:now-lastDrop.current<900?konoAnim.wave:konoAnim.breathe;anim.offset.x=Math.floor(f/(party?6:10))%4*0.25;kono.material.map=anim
   kono.position.set(4.1,BTOP+0.9+(party?Math.abs(Math.sin(f/6))*0.5:0),BZ-0.25)
   // The garden around the cabinet: clouds drift, butterflies flutter, a bird passes, petals fall.
   clouds.forEach((cl,i)=>{cl.position.x=((f*0.004*(1+i*0.3)+i*7)%26)-13})
   butterflies.forEach((b,i)=>{const t=f/90+i*2.4;b.position.set(Math.sin(t)*3.6,BTOP-0.6+Math.sin(t*2)*0.6+i*0.5,BZ+1.6+Math.cos(t)*1.4);b.scale.x=0.5*(ASPECT['butterfly']??1)*(0.35+0.65*Math.abs(Math.sin(f/4+i)))})
   const bt=(f%1500)/1500;bird.visible=bt<0.35;bird.position.set(-9+bt/0.35*18,BTOP+2.6+Math.sin(f/20)*0.2,-9)
   petals.forEach((pt,i)=>{const fall=(party?3:1)*0.006;pt.position.y-=fall;pt.position.x+=Math.sin(f/40+i)*0.008;pt.material.rotation+=0.02;if(pt.position.y<-0.5){pt.position.set((Math.random()-.5)*12,BTOP+3+Math.random()*2,-6+Math.random()*12)}})
   if(f%2===0){const pos=seaGeo.attributes.position as THREE.BufferAttribute,a=pos.array as Float32Array;for(let k=0;k<a.length;k+=3)a[k+2]=seaBase[k+2]+Math.sin(seaBase[k]*0.5+f*0.03)*0.18+Math.cos(seaBase[k+1]*0.45+f*0.025)*0.15;pos.needsUpdate=true;seaGeo.computeVertexNormals()}
   for(let i=0;i<SPARKS;i++){if(sLife[i]<=0){sPos[i*3+1]=-99;continue}sLife[i]-=1/60;sVel[i*3+1]-=0.06;sPos[i*3]+=sVel[i*3]/60;sPos[i*3+1]+=sVel[i*3+1]/60;sPos[i*3+2]+=sVel[i*3+2]/60;const k=Math.max(0,sLife[i]);sCol[i*3]*=0.985;sCol[i*3+1]*=0.985;sCol[i*3+2]*=0.985;if(k===0)sPos[i*3+1]=-99}
   ;(sGeo.attributes.position as THREE.BufferAttribute).needsUpdate=true;(sGeo.attributes.color as THREE.BufferAttribute).needsUpdate=true
   placeCamera()
   // The BIG BONUS: the camera flies up to the giant tower as it shakes, then follows it down.
   if(cine){const t=f-cine.at,k=t<20?t/20:t<TOPPLE_AT+80?1:Math.max(0,1-(t-TOPPLE_AT-80)/60),e=k*k*(3-2*k)
    // Close on the tower while it wobbles; as it falls, swing round to the side so you see it arc down over
    // the board and pour onto the field (rather than fall into the camera).
    const side=Math.min(1,Math.max(0,(t-TOPPLE_AT+12)/30)),sd=side*side*(3-2*side)
    const camAt=new THREE.Vector3(0,BTOP+3.4,BZ+6.2).lerp(new THREE.Vector3(10.5,BTOP+4.5,4),sd),lookAt=new THREE.Vector3(0,BTOP+2.4,BZ-0.6).lerp(new THREE.Vector3(0,BTOP+1.6,BZ+2.4),sd)
    camera.position.lerp(camAt,e);camera.lookAt(new THREE.Vector3(0,2.2,-1.2).lerp(lookAt,e))}
   if(show.shake>0.02)camera.position.add(new THREE.Vector3((Math.random()-.5)*show.shake*0.35,(Math.random()-.5)*show.shake*0.25,0))
   const showing=!!(c.dish||c.chance)
   const sm=shade.material as THREE.MeshBasicMaterial;sm.opacity+=((showing?0.55:0)-sm.opacity)*0.15;shade.visible=sm.opacity>0.01
   const centre=new THREE.Vector3(0,0,0.8),toCam=new THREE.Vector3().subVectors(camera.position,centre).normalize()
   bonus.position.copy(centre).addScaledVector(toCam,5.2);bonus.quaternion.copy(camera.quaternion)
   shade.position.copy(centre).addScaledVector(toCam,4.2);shade.quaternion.copy(camera.quaternion)
   dishGroup.visible=!!c.dish;wheelGroup.visible=!!c.chance&&!c.dish
   if(c.dish&&f-c.dish.at===1)pop('BALL LOTTERY',0,3.4,1,'big')
   if(c.dish){const t=Math.min(1,(f-c.dish.at)/170),target=c.dish.pocket/DISH.length*Math.PI*2,turns=4*(1-(1-t)**2),a=target-Math.PI*8+turns*Math.PI*2,rr=1.95-0.4*t
    dishGroup.rotation.set(-1.1,0,0);dish.rotation.y=f/90;dishBall.position.set(Math.cos(a+dish.rotation.y)*rr,0.06*(rr/0.5)**2*0.25+0.2,-Math.sin(a+dish.rotation.y)*rr)}
   if(c.chance){if(wheelTex.pockets!==c.winPockets){wheelTex.pockets=c.winPockets;wheelTex.tex.image=wheelImage(c.winPockets);wheelTex.tex.needsUpdate=true}
    const t=Math.min(1,(f-c.chance.at)/200),gap=Math.floor(2+t*16);if(t<1&&f-chanceTick.last>=gap){chanceTick.last=f;fx('tick',soundRef.current)}
    if(f===c.chance.at+1)pop('JACKPOT CHANCE',0,3.6,1,'big');// Slows hard at the end and creeps the last bit, rocking on the pocket before it settles.
    const creep=t>0.88?Math.sin((t-0.88)/0.12*Math.PI*2)*0.05*(1-t)/0.12:0
    wheel.rotation.y=(1-(1-t)**4)*Math.PI*2*6+c.chance.pocket/CHANCE_POCKETS*Math.PI*2+creep
    const done=t>=1,chase=Math.floor(f/(t<0.7?2:t<0.95?4:8))
    for(let k=0;k<JP_BULBS;k++)jpBulbs.setColorAt(k,done?(f%10<5?CONFETTI[k%CONFETTI.length]:dim):(k+chase)%4===0?BULB[(k>>2)%3]:dim)
    if(jpBulbs.instanceColor)jpBulbs.instanceColor.needsUpdate=true}
   // The jackpot: the counter counts up as the medals rain, fireworks burst over the cabinet for a few seconds.
   if(jpAt>=0){const jt=f-jpAt
    if(jpCount.current)jpCount.current.textContent=String(Math.min(jpAmount,Math.round(jpAmount*Math.min(1,jt/170))))
    if(jt<330&&jt%14===0){const col=[CONFETTI[(jt/14)%CONFETTI.length|0]];emit((Math.random()-.5)*8,4+Math.random()*3,-3+Math.random()*3,70,jt%28===0?CONFETTI:col,3.6);if(jt%42===0)fx('zap',soundRef.current)}
    if(jt>420){jpAt=-1;setJpWin(null)}}
   composer.render()
   if(now-lastHud>120||c.spinning){lastHud=now
    const reels=c.spinning?[0,1,2].map(i=>f-c.spinning!.at<40+i*25?REEL_FACES[Math.floor((f+i*3)/3)%6]:c.spinning!.reels[i]):hudReels.current
    if(c.spinning)hudReels.current=reels
    setHud(h=>h.bank===(c.bank??BANK_START)&&h.hand===c.hand&&h.jp===c.jackpot&&h.steps===c.steps&&h.pockets===c.winPockets&&h.queue===c.queue&&h.reels.join()===reels.join()&&h.spinning===!!c.spinning&&h.chance===!!c.chance?h:{...h,chance:!!c.chance,bank:c.bank??BANK_START,hand:c.hand,jp:c.jackpot,steps:c.steps,pockets:c.winPockets,queue:c.queue,reels,spinning:!!c.spinning})}
   const fl=feverOn&&c.fever?Math.ceil((c.fever.until-f)/60):0;if(fl!==feverRef.current){feverRef.current=fl;setFever(fl)}
   if(c.hand<=0&&!busy(c)&&!rampQ[0].length&&!rampQ[1].length&&!ballRuns.length&&see.n===0&&see.tip<0){quiet.current+=1;if(quiet.current>300&&!ended.current){ended.current=true;onEndRef.current(c.hand,c.jpWins)}}else quiet.current=0
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
  // If the 3D machine can't start (no WebGL, the physics didn't load, or it's taking far too long), say why
  // and offer Try again or Leave, instead of "Filling the machine…" forever.
  let disposed=false,gaveUp=false,cleanup=()=>{}
  const timer=window.setTimeout(()=>{if(!ready.current&&!disposed){gaveUp=true;setFail('slow')}},15000)
  RAPIER.init().then(()=>{
   if(disposed||gaveUp)return
   if(!webglWorks()){setFail('webgl');return}
   try{cleanup=build(el)}catch{ready.current=false;el.querySelectorAll('canvas').forEach(c=>c.remove());setFail('webgl')}
  },()=>{if(!disposed&&!gaveUp)setFail('physics')})
  return ()=>{disposed=true;window.clearTimeout(timer);cleanup()}
 },[tries])

 useEffect(()=>{if(!hud.event)return;const t=window.setTimeout(()=>setHud(h=>({...h,event:''})),2200);return()=>window.clearTimeout(t)},[hud.event])
 return <div className="break-game medal-cove">
  <div className="cove-dials" aria-label="Bonus wheels">
   {WHEELS.map((segs,i)=><WheelDial key={i} i={i} segs={segs} state={dials[i]} turn={el=>{dialEls.current[i]=el}}/>)}
  </div>
  <div ref={host} className="cove-stage" role="img" aria-label={'KONO Medal Cove: '+hud.hand+' medals, jackpot '+hud.jp}>
   <div className="cove-board" aria-label="Backboard">
   <div className="cove-steps" aria-label={hud.steps+' of '+LAMPS+' lamps'}>{Array.from({length:LAMPS},(_,i)=><i key={i} className={i<hud.steps?'is-on':undefined}/>)}<small>💡 lamps</small></div>
   <div className="cove-jp"><small>JACKPOT</small><b key={hud.jp} className="is-bump">{hud.jp}</b></div>
   <div className="cove-pockets" aria-label={'Giant tower: '+hud.bank+' medals'}><b>🗼 {hud.bank}</b><small>giant tower</small><small>🎯 {hud.pockets}/{CHANCE_POCKETS} JP{best!==null?' · best '+best:''}</small></div>
   <div className={'cove-reels'+(hud.spinning?' is-spinning':'')} aria-label={'Lottery: '+hud.reels.join(' ')}>{hud.reels.map((r,i)=><span key={i}>{r}</span>)}</div>
   <div className="cove-queue" aria-label={hud.queue+' spins waiting'}>{Array.from({length:4},(_,i)=><i key={i} className={i<hud.queue?'is-on':undefined}/>)}</div>
  </div>
   {!hud.ready&&!fail&&<p className="cove-loading" role="status">Filling the machine with medals…</p>}
   {fail&&<CoveFail kind={fail} onRetry={()=>{setFail(null);setTries(n=>n+1)}} onLeave={onFail}/>}
   {hud.event&&<p key={hud.event} className={'cove-event'+(hud.big?' is-big':'')} role="status">{hud.event}</p>}
   {hud.event&&hud.big&&<span key={'f'+hud.event} className="cove-flash" aria-hidden="true"/>}
   {jpWin!==null&&<div className="cove-jp-win" role="status" aria-label={'Jackpot! '+jpWin+' medals'}><b>JACKPOT!!</b><span><i aria-hidden="true">🪙</i> +<strong ref={jpCount}>0</strong></span></div>}
   {hud.chance&&jpWin===null&&<div className="cove-chance" aria-hidden="true"><b>JACKPOT CHANCE</b><span>🎯 {hud.pockets} of {CHANCE_POCKETS} pockets win · JP {hud.jp}</span></div>}
   {fever>0&&<span className="cove-fever" role="status" aria-label={'Fever time: '+fever+' seconds'}>🌈 FEVER {fever}s</span>}
   {pops.map(p=><b key={p.id} className={'cove-pop is-'+p.kind.replace(/\d/,'')+(p.kind.match(/\d/)?' is-c'+p.kind.match(/\d/)![0]:'')} style={{left:p.x+'%',top:p.y+'%'}} aria-hidden="true">{p.text}</b>)}
   <button type="button" className="cove-view" aria-label="Change the camera" onClick={()=>setView(v=>(v+1)%VIEWS.length)}>🎥</button>
   <span className="cove-hand" aria-hidden="true">🪙 {hud.hand}</span>
  </div>
  <p className="blast-help">Touch to aim along the top of the pin board and tap to drop (hold to keep dropping). Medals bounce down the pins into a pocket, and its mini wheel spins: medals, giant-tower layers, a prize ball, a lamp or a lottery spin. Light all 5 lamps for the BIG BONUS: the giant tower comes down! Drag around the edges to look around.</p>
 </div>
}

// ---- Textures, drawn once ----
/** How many pixels per drawing unit the textures get: 2 (HD) unless the device draws 3D in software. */
let TEX=2
/** Whether WebGL is running in software (SwiftShader, llvmpipe, Microsoft's basic renderer): no GPU. */
function softwareGL(gl:WebGLRenderingContext|WebGL2RenderingContext){
 try{const ext=gl.getExtension('WEBGL_debug_renderer_info');const name=String(ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));return /swiftshader|llvmpipe|software|basic render/i.test(name)}catch{return false}
}
/** A canvas `w` × `h` in drawing units, `k` times as many pixels (so the textures are HD). */
function canvas(w:number,h:number,k=1){const c=document.createElement('canvas');c.width=w*k;c.height=h*k;const g=c.getContext('2d')!;g.scale(k,k);return [c,g] as const}
function woodTexture(){const [c,g]=canvas(512,512,TEX);g.fillStyle='#c79a63';g.fillRect(0,0,512,512)
 for(let i=0;i<10;i++){g.fillStyle=i%2?'#bf9058':'#cfa36c';g.fillRect(i*51.2,0,51.2,512);g.strokeStyle='rgba(90,55,25,.45)';g.lineWidth=3;g.beginPath();g.moveTo(i*51.2,0);g.lineTo(i*51.2,512);g.stroke()
  for(let k=0;k<6;k++){g.strokeStyle='rgba(120,80,40,.18)';g.lineWidth=1.5;g.beginPath();const x=i*51.2+8+k*7;g.moveTo(x,0);g.bezierCurveTo(x+6,170,x-6,340,x+3,512);g.stroke()}}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
function coinFace(){const [c,g]=canvas(128,128,TEX*2);const grad=g.createRadialGradient(54,48,6,64,64,64);grad.addColorStop(0,'#fff3b0');grad.addColorStop(.6,'#f2c230');grad.addColorStop(1,'#b8860b');g.fillStyle=grad;g.fillRect(0,0,128,128)
 g.strokeStyle='rgba(140,90,10,.7)';g.lineWidth=5;g.beginPath();g.arc(64,64,44,0,Math.PI*2);g.stroke();g.fillStyle='rgba(140,90,10,.75)';g.font='bold 44px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText('K',64,66)
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function dishTexture(){const [c,g]=canvas(512,512,TEX);g.fillStyle='#fff6e0';g.fillRect(0,0,512,512)
 // The lathe maps around (x) and outward (y); the pockets sit near the rim as colored bands.
 DISH.forEach((p,i)=>{const x0=i/DISH.length*512;g.fillStyle=p.prize.kind==='chance'?'#ff5a7a':p.prize.kind==='tower'?'#ffb347':'#7fd0ff';g.fillRect(x0+2,300,512/DISH.length-4,180)
  g.save();g.translate(x0+512/DISH.length/2,390);g.fillStyle='#2b1a3a';g.font='bold 22px system-ui';g.textAlign='center';g.fillText(p.label.replace('JP CHANCE','JP!'),0,8);g.restore()})
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function wheelImage(winPockets:number){const [c,g]=canvas(512,512,TEX),cx=256,cy=256,R=250
 for(let i=0;i<CHANCE_POCKETS;i++){const a0=i/CHANCE_POCKETS*Math.PI*2-Math.PI/2-Math.PI/CHANCE_POCKETS,a1=a0+Math.PI*2/CHANCE_POCKETS,win=isWinPocket(i,winPockets)
  g.fillStyle=win?'#ffd34d':i%2?'#6a4bc4':'#8a6ae0';g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,R,a0,a1);g.closePath();g.fill();g.strokeStyle='#2b1a3a';g.lineWidth=3;g.stroke()
  const am=(a0+a1)/2;g.fillStyle=win?'#5a3200':'#fff';g.font='bold 30px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(win?'JP':'+10',cx+Math.cos(am)*R*.72,cy+Math.sin(am)*R*.72)}
 g.fillStyle='#2b1a3a';g.beginPath();g.arc(cx,cy,80,0,Math.PI*2);g.fill();g.fillStyle='#ffd34d';g.font='bold 30px system-ui';g.fillText('JACKPOT',cx,cy-14);g.fillText('CHANCE',cx,cy+22)
 return c}
/** The pin board's backplate: a soft sky with the Sanctuary's own trees, lanterns, clouds and flowers painted
 * behind the pins (drawn in as each picture loads), and the cabinet's name. */
function boardTexture(){const [c,g]=canvas(1024,384,TEX)
 const paint=()=>{const grad=g.createLinearGradient(0,0,0,384);grad.addColorStop(0,'#bfe7ff');grad.addColorStop(.7,'#ffeef5');grad.addColorStop(1,'#ffe1ec');g.fillStyle=grad;g.fillRect(0,0,1024,384)}
 paint()
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace
 const parts:[string,number,number,number][]=[['cloud-a',90,40,170],['cloud-b',640,24,190],['cloud-a',820,70,150],['tree-blossom',-30,96,290],['tree-leafy',800,110,270],['lantern-post',250,190,170],['lantern-post',700,190,170],['flowers-1',120,316,130],['flowers-3',330,322,120],['flowers-2',520,316,130],['flowers-4',720,318,130],['flowers-1',900,320,120]]
 const imgs=parts.map(([n])=>Object.assign(new Image(),{src:'/games/cove/'+n+'.webp'}))
 let left=imgs.length
 const draw=()=>{paint();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high'
  parts.forEach(([,x,y,h],i)=>{const im=imgs[i];if(!im.complete||!im.naturalWidth)return;const w=h*im.naturalWidth/im.naturalHeight;g.globalAlpha=0.92;g.drawImage(im,x,y-(h-(384-y)>0?0:0),w,h);g.globalAlpha=1})
  g.fillStyle='rgba(255,255,255,.85)';g.strokeStyle='rgba(214,112,150,.9)';g.lineWidth=6;g.font='900 44px system-ui';g.textAlign='center';g.strokeText('KONO MEDAL COVE',512,372);g.fillText('KONO MEDAL COVE',512,372)
  t.needsUpdate=true}
 imgs.forEach(im=>{im.onload=im.onerror=()=>{left--;draw()}})
 if(!left)draw()
 return t}
function emojiTexture(e:string){const [c,g]=canvas(128,128,TEX);g.font='96px system-ui,"Apple Color Emoji","Noto Color Emoji"';g.textAlign='center';g.textBaseline='middle';g.fillText(e,64,70)
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function stripeTexture(){const [c,g]=canvas(64,256,TEX);for(let i=0;i<8;i++){g.fillStyle=i%2?'#f6f1e7':'#d8443a';g.fillRect(0,i*32,64,32)}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function wheelSegTexture(segs:{label:string;kind:string}[],w:number){const [c,g]=canvas(256,256,TEX),n=segs.length,cx=128,cy=128,r=126
 const pal=[['#ff6b5e','#ffb3a8'],['#ffd34d','#fff0b8'],['#4fb3ff','#b9e2ff']][w]
 segs.forEach((sg,k)=>{const a0=-Math.PI/2+k*2*Math.PI/n-Math.PI/n,a1=a0+2*Math.PI/n
  g.fillStyle=sg.kind==='lamp'?'#fff3a0':sg.kind==='ball'?'#c8a8ff':sg.kind==='layers'?'#9fe0ff':pal[k%2];g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,r,a0,a1);g.closePath();g.fill();g.strokeStyle='#5a3a24';g.lineWidth=3;g.stroke()
  g.save();g.translate(cx,cy);g.rotate((a0+a1)/2+Math.PI/2);g.fillStyle='#2b1a3a';g.font='900 '+(sg.label.length>6?17:21)+'px system-ui';g.textAlign='center'
  g.fillText(sg.kind==='lamp'?'💡':sg.kind==='ball'?'🔮':sg.kind==='spin'?'🎰':sg.kind==='layers'?'🗼':'🪙',0,-r+33);g.fillText(sg.label.replace(' layers',' L').replace(' layer',' L'),0,-r+59);g.restore()})
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t}
const ASPECT:Record<string,number>={'lantern-post':293/480,'lantern-post-night':293/480,'paper-lanterns':480/379,'light-arch':640/590,'tree-blossom':564/570,'tree-leafy':492/554,'flowers-1':99/49,'flowers-2':112/61,'flowers-3':100/58,'flowers-4':110/64,'shell':72/56,'petal-1':91/120,'petal-2':107/120,'sparkle':160/157,'cloud-a':209/67,'cloud-b':247/79,'butterfly':60/33,'butterfly-2':42/33,'bird':63/42}
function skyTexture(){const [c,g]=canvas(16,256);const grad=g.createLinearGradient(0,0,0,256);grad.addColorStop(0,'#a9dcff');grad.addColorStop(.55,'#d9efff');grad.addColorStop(1,'#ffe9f2');g.fillStyle=grad;g.fillRect(0,0,16,256);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
const segIcon=(kind:string)=>kind==='lamp'?'💡':kind==='ball'?'🔮':kind==='spin'?'🎰':kind==='layers'?'🗼':'🪙'
function segColor(kind:string,w:number,k:number){const pal=[['#ff6b5e','#ffb3a8'],['#ffd34d','#fff0b8'],['#4fb3ff','#b9e2ff']][w]
 return kind==='lamp'?'#fff3a0':kind==='ball'?'#c8a8ff':kind==='layers'?'#9fe0ff':pal[k%2]}
function prizeText(seg:{kind:string;n?:number}){return seg.kind==='medals'?'+'+seg.n+' 🪙':seg.kind==='layers'?'+'+seg.n+' 🗼':seg.kind==='ball'?'🔮 Ball!':seg.kind==='lamp'?'💡 Lamp!':'🎰 Spin!'}

/** One bonus wheel, zoomed in: glossy segments (icon and amount on each), a gold rim of bulbs that chase
 * (fast while it spins), the pointer at the top, and its pocket and last prize under it. The rotating
 * group (`turn`) is turned by the game's loop to match the wheel in the machine. */
const POCKET_NAME=['Lottery wheel','Lamp wheel','Tower wheel']
function WheelDial({i,segs,state,turn}:{i:number;segs:{label:string;kind:string;n:number}[];state:{spin:boolean;prize:string;kind:string};turn:(el:SVGGElement|null)=>void}){
 const R=50,seg=(k:number)=>{const a0=(k-0.5)*Math.PI/4-Math.PI/2,a1=a0+Math.PI/4;return {a0,a1,am:(a0+a1)/2}}
 const at=(r:number,a:number)=>(r*Math.cos(a)).toFixed(2)+' '+(r*Math.sin(a)).toFixed(2)
 const spoke=(r:number,a:number,deg:number)=>({x:(r*Math.cos(a)).toFixed(2),y:(r*Math.sin(a)).toFixed(2),transform:'rotate('+deg.toFixed(1)+' '+at(r,a)+')'})
 return <figure className={'cove-dial is-c'+i+(state.spin?' is-spinning':'')+(state.prize&&!state.spin?' is-won':'')} aria-label={POCKET_FACE[i]+' wheel'+(state.spin?', spinning':state.prize?', won '+state.prize:'')}>
  <b className="cove-dial-name"><span aria-hidden="true">{POCKET_FACE[i]}</span> {POCKET_NAME[i]}</b>
  <svg viewBox="-64 -68 128 132" aria-hidden="true">
   <defs>
    <radialGradient id={'cove-shine-'+i} cx="35%" cy="28%" r="75%"><stop offset="0" stopColor="#fff" stopOpacity=".55"/><stop offset=".45" stopColor="#fff" stopOpacity=".08"/><stop offset="1" stopColor="#000" stopOpacity=".18"/></radialGradient>
    <linearGradient id={'cove-rim-'+i} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3b8"/><stop offset=".5" stopColor="#f2c230"/><stop offset="1" stopColor="#b8860b"/></linearGradient>
   </defs>
   <circle r="61" fill={'url(#cove-rim-'+i+')'} stroke="#7a5200" strokeWidth="1.5"/>
   <g ref={turn}>{segs.map((sg,k)=>{const {a0,a1,am}=seg(k),deg=am*180/Math.PI+90
    return <g key={k}><path d={'M0 0L'+at(R,a0)+'A'+R+' '+R+' 0 0 1 '+at(R,a1)+'Z'} fill={segColor(sg.kind,i,k)} stroke="#fff" strokeWidth="1.6"/>
     <text className="cove-dial-icon" {...spoke(38,am,deg)} textAnchor="middle" dominantBaseline="central">{segIcon(sg.kind)}</text>
     {(sg.kind==='medals'||sg.kind==='layers')&&<text className="cove-dial-label" {...spoke(23,am,am*180/Math.PI)} textAnchor="middle" dominantBaseline="central">{'+'+sg.n}</text>}</g>})}</g>
   <circle r={R} fill={'url(#cove-shine-'+i+')'} pointerEvents="none"/>
   <g className="cove-dial-bulbs">{Array.from({length:16},(_,k)=><circle key={k} cx={(56*Math.cos(k*Math.PI/8)).toFixed(2)} cy={(56*Math.sin(k*Math.PI/8)).toFixed(2)} r="2.6" style={{animationDelay:(k%2?-0.5:0)+'s'}}/>)}</g>
   <circle r="9" fill="#fff" stroke="#c9a14a" strokeWidth="2.5"/><circle r="4" fill="#f2c230"/>
   <path d="M-9 -67 L9 -67 L0 -45 Z" fill="#ff4d6d" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/>
  </svg>
  <figcaption>{state.spin?'Spinning…':state.prize||'Drop into '+POCKET_FACE[i]}</figcaption>
 </figure>
}
/** The turntable's top: pink and cream wedges round a star, so you can see it turn. */
function turnTexture(){const [c,g]=canvas(256,256,TEX);for(let k=0;k<12;k++){g.fillStyle=k%2?'#fff1e0':'#ffb3cc';g.beginPath();g.moveTo(128,128);g.arc(128,128,128,k*Math.PI/6,(k+1)*Math.PI/6);g.closePath();g.fill()}
 g.fillStyle='#ffd34d';g.beginPath();for(let k=0;k<10;k++){const r=k%2?18:40,a=k*Math.PI/5-Math.PI/2;g.lineTo(128+Math.cos(a)*r,128+Math.sin(a)*r)}g.closePath();g.fill()
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
/** The gold medal look, for the little stacks in the seesaw and KONO's bucket. */
function coinsMaterial(){return new THREE.MeshStandardMaterial({color:'#ffd24a',metalness:1,roughness:.32,map:coinFace(),envMapIntensity:1.3})}
