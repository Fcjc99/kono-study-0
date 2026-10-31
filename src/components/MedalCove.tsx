import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import * as THREE from 'three'
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js'
import RAPIER from '@dimforge/rapier3d-compat'
import {BloomEffect,EffectComposer,EffectPass,RenderPass,SMAAEffect} from 'postprocessing'
import {BANK_START,CHANCE_POCKETS,DISH,FIELD,LAMPS,POCKETS,inFever,WHEELS,WHEEL_FRAMES,busy,drop,isWinPocket,newCove,pocket,settle,spawned,step,type Cove,type Reel} from '../store/pusher'
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
const wx=(x:number)=>(x-50)*U,wz=(y:number)=>y*U-6
const REEL_FACES:Reel[]=['🪙','🗼','🔮','⭐','🐚','🌺']
const VIEWS=[{yaw:0,pitch:0.5,dist:15},{yaw:0,pitch:0.95,dist:14},{yaw:0.55,pitch:0.45,dist:15},{yaw:-0.55,pitch:0.45,dist:15}]

type Piece={body:RAPIER.RigidBody;ball:boolean;counted:number;board:boolean}

export default function MedalCove({ref,best,sound,onEnd,onFail}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;onEnd:(medals:number,jackpots:number)=>void;onFail?:()=>void}){
 const [fail,setFail]=useState<CoveFailure|null>(null),[tries,setTries]=useState(0)
 const [start]=useState<Cove>(()=>newCove(Math.random,100,true))
 const cove=useRef<Cove>(start),host=useRef<HTMLDivElement>(null),aim=useRef(50),holding=useRef(false),lastDrop=useRef(0)
 const [hud,setHud]=useState({hand:start.hand,jp:start.jackpot,steps:0,pockets:1,queue:0,event:'',big:false,bank:BANK_START,reels:['🌺','🌺','🌺'] as string[],spinning:false,ready:false})
 const [pops,setPops]=useState<{id:number;text:string;x:number;y:number;kind:string}[]>([]),popId=useRef(0)
 const [fever,setFever]=useState(0)
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
  renderer.setPixelRatio(Math.min(small?1.5:2,window.devicePixelRatio||1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05
  el.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true')
  const scene=new THREE.Scene();scene.background=skyTexture();scene.fog=new THREE.Fog('#d9efff',22,40)
  // Soft toon shading in three tones and pastel colors, to sit with the Sanctuary's art.
  const tones=new THREE.DataTexture(new Uint8Array([150,150,150,255,205,205,205,255,255,255,255,255]),3,1,THREE.RGBAFormat);tones.magFilter=tones.minFilter=THREE.NearestFilter;tones.needsUpdate=true
  const toon=(color:string,extra:THREE.MeshToonMaterialParameters={})=>new THREE.MeshToonMaterial({color,gradientMap:tones,...extra})
  // The Sanctuary's own pixel art, as sprites standing in the scene (crisp pixels, bottom-centered).
  const loader=new THREE.TextureLoader()
  const pix=(name:string)=>{const t=loader.load('/games/cove/'+name+'.webp');t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;return t}
  const sprite=(name:string,h:number,x:number,y:number,z:number)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:pix(name),alphaTest:0.04}));s.center.set(0.5,0);s.scale.set(h*(ASPECT[name]??1),h,1);s.position.set(x,y,z);scene.add(s);return s}
  const camera=new THREE.PerspectiveCamera(42,1,0.1,80)
  const pmrem=new THREE.PMREMGenerator(renderer),envRT=pmrem.fromScene(new RoomEnvironment(),0.04);scene.environment=envRT.texture;pmrem.dispose()
  scene.add(new THREE.HemisphereLight('#dff3ff','#4a3424',0.8))
  const sun=new THREE.DirectionalLight('#fff4dc',2.2);sun.position.set(4,12,6);sun.castShadow=true;sun.shadow.mapSize.set(small?512:1024,small?512:1024)
  Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:30});scene.add(sun)
  // One merged effect pass: bloom on what's bright (the lantern, the shine on the gold, the jackpot pieces)
  // and SMAA for smooth edges. Half-resolution bloom on phones.
  const composer=new EffectComposer(renderer,{multisampling:0})
  composer.addPass(new RenderPass(scene,camera))
  const bloom=new BloomEffect({intensity:small?0.7:0.9,luminanceThreshold:0.92,luminanceSmoothing:0.2,mipmapBlur:true,resolutionScale:small?0.5:0.75})
  composer.addPass(new EffectPass(camera,bloom,new SMAAEffect()))
  // ---- The cabinet you see ----
  const deckMat=toon('#f6dcb4',{map:woodTexture()})
  const deck=new THREE.Mesh(new THREE.BoxGeometry(10.4,0.4,13.6),deckMat);deck.position.set(0,-0.2,-0.8);deck.receiveShadow=true;scene.add(deck)
  const frameMat=toon('#f4a6c1')
  const glass=new THREE.MeshPhysicalMaterial({color:'#e8f7ff',transparent:true,opacity:.14,roughness:.05})
  for(const s of [-1,1]){const g=new THREE.Mesh(new THREE.BoxGeometry(0.12,1.4,12),glass);g.position.set(s*5.15,0.7,-1.6);scene.add(g)
   const rail=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.18,12),frameMat);rail.position.set(s*5.2,1.45,-1.6);scene.add(rail)}
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
   const disc=new THREE.Mesh(new THREE.CircleGeometry(0.62,48),new THREE.MeshStandardMaterial({map:wheelSegTexture(segs,i),emissive:'#ffffff',emissiveMap:wheelSegTexture(segs,i),emissiveIntensity:.35,roughness:.5}));g.add(disc)
   const rim=new THREE.Mesh(new THREE.TorusGeometry(0.64,0.05,8,40),new THREE.MeshStandardMaterial({color:'#ffe08a',metalness:.9,roughness:.25,emissive:'#ffb000',emissiveIntensity:.4}));g.add(rim)
   const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.08,16),new THREE.MeshStandardMaterial({color:'#fff',metalness:.8,roughness:.2}));hub.rotation.x=Math.PI/2;hub.position.z=0.03;g.add(hub)
   const tick=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.22,12),new THREE.MeshStandardMaterial({color:'#fff',emissive:'#ff5a7a',emissiveIntensity:1.5}));tick.rotation.z=Math.PI;tick.position.set(0,0.74,0.05);g.add(tick)
   return {g,disc,rim,angle:0,from:0,spinAt:-1,flash:0}})
  // The giant tower: a column of medals behind the board that grows with every layer won.
  const GIANT_MAX=60
  const giant=new THREE.InstancedMesh(new THREE.CylinderGeometry(R*1.25,R*1.25,HALF*2.2,26),new THREE.MeshStandardMaterial({color:'#ffd24a',metalness:1,roughness:.3,map:coinFace(),envMapIntensity:1.4,emissive:'#4a3000',emissiveIntensity:.25}),GIANT_MAX);giant.castShadow=true;scene.add(giant)
  const giantBase=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.72,0.2,24),new THREE.MeshStandardMaterial({color:'#2f6fb3',roughness:.4}));giantBase.position.set(0,BTOP+1.85,BZ-0.6);scene.add(giantBase)
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
   camera.position.set(Math.sin(orbit.yaw)*Math.cos(orbit.pitch)*orbit.dist,Math.sin(orbit.pitch)*orbit.dist,Math.cos(orbit.yaw)*Math.cos(orbit.pitch)*orbit.dist+0.5);camera.lookAt(0,2.2,-1.2)}
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h,false);composer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w/h<0.8?52:42;camera.updateProjectionMatrix()}
  resize();const ro=new ResizeObserver(resize);ro.observe(el)
  // Big words that pop up where things happen ("IN!", a wheel's prize, COMBO, TIMBER!), and a buzz.
  const proj=new THREE.Vector3()
  const pop=(text:string,x:number,y:number,z:number,kind='')=>{proj.set(x,y,z).project(camera);const id=++popId.current
   setPops(ps=>[...ps.slice(-6),{id,text,x:(proj.x+1)/2*100,y:(1-proj.y)/2*100,kind}]);window.setTimeout(()=>setPops(ps=>ps.filter(p=>p.id!==id)),kind==='big'?2200:1300)}
  const buzz=(pattern:number|number[])=>{try{navigator.vibrate?.(pattern)}catch{/* no vibration here */}}
  // The moment: slow motion as a medal is about to drop into a pocket; a cinematic for the BIG BONUS.
  let slow=1,cine:{at:number;bank:number}|null=null
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
    for(const m of c.medals){if(m.y<0)addCoin(Math.max(-4.5,Math.min(4.5,wx(m.x)+(Math.random()-.5)*0.08)),BTOP+0.3,BZ,false,(Math.random()-.5)*3,true);else addCoin(wx(m.x),1.6+Math.random()*1.4,wz(m.y),!!m.ball,(Math.random()-.5)*4)}
    c=spawned(c)
    // A tower stands as a real stack, a little in front of the pusher, until it's knocked over.
    for(const t of c.towers)if(!builtTowers.has(t.at)&&!(cine&&t.at===cine.at&&c.frame-t.at<75)){builtTowers.add(t.at);const cols=Math.ceil(t.n/22),per=Math.ceil(t.n/cols)
      for(let k=0;k<cols;k++){const cx=cols===1?wx(t.x):(k-(cols-1)/2)*0.78,cz=wz(c.pusher+9)+(k%2)*0.5;for(let i=0;i<per&&k*per+i<t.n;i++)addCoin(cx+Math.cos(i*0.55)*0.035,0.06+i*0.112+(cols>1?1.2:0),cz+Math.sin(i*0.55)*0.035);emit(cx,1.6,cz,cols>1?60:40,GOLD,cols>1?4:2.5)}
      if(cine&&t.at===cine.at){show.shake=1.2;buzz(200);fx('boom',soundRef.current)}}
    // The pusher moves, the world steps.
    pusherBody.setNextKinematicTranslation({x:0,y:0.3,z:wz(c.pusher)-3})
    // A medal about to fall into a pocket: time slows, the pocket glows and a drum-roll ticks.
    const wide=inFever(c)?1.35:1
    let near=-1
    for(const p of pieces.values()){if(!p.board)continue;const t=p.body.translation();if(t.y>BBOTTOM&&t.y<BBOTTOM+0.7){const i=POCKET_W.findIndex((w,k)=>Math.abs(t.x-pocketX(k,c.frame))<w*wide/2);if(i>=0){near=i;break}}}
    const wantSlow=near>=0?0.32:cine&&c.frame-cine.at>75&&c.frame-cine.at<150?0.4:1
    slow+=(wantSlow-slow)*0.25;world.timestep=slow/60
    if(near>=0){pocketMeshes[near].flash=Math.max(pocketMeshes[near].flash,0.45);if(c.frame%5===0)fx('tick',soundRef.current)}
    world.step()
    // The board's bottom: into a pocket, or out onto the pusher's shelf (where it tips over and joins the pile).
    for(const [h,p] of pieces){if(!p.board)continue;const t=p.body.translation()
     // A medal sitting still on a pin gets the little nudge a real cabinet's rattle gives it.
     if(t.y>BBOTTOM){const v=p.body.linvel();if(Math.abs(v.x)+Math.abs(v.y)<0.25)p.body.setLinvel({x:(Math.random()<.5?-1:1)*(0.8+Math.random()*0.8),y:v.y,z:0},true);continue}
     const hit=POCKET_W.findIndex((w,i)=>Math.abs(t.x-pocketX(i,c.frame))<w*wide/2-0.05)
     if(hit>=0){world.removeRigidBody(p.body);pieces.delete(h);c=pocket(c,POCKETS[hit]);pop('IN! '+POCKET_FACE[hit],pocketX(hit,c.frame),BBOTTOM+0.4,BZ+0.3,'in'+hit);buzz(30);pocketMeshes[hit].flash=1;emit(pocketX(hit,c.frame),BBOTTOM,BZ+0.3,30,POCKET_SPARK[hit],2.2);fx(hit===1?'star':'zap',soundRef.current)}
     else{p.board=false;p.body.setEnabledTranslations(true,true,true,true);p.body.setEnabledRotations(true,true,true,true);p.body.setLinvel({x:p.body.linvel().x*0.5,y:-1,z:0.6},true)}}
    // What fell: off the front is yours, off the sides is lost; a ball off the front goes to the ball lottery.
    let won=0,lost=0,ballsWon=0
    for(const [h,p] of pieces){const t=p.body.translation()
     if(!p.counted&&t.y<-0.4){p.counted=c.frame;if(t.z>FRONT-0.2&&Math.abs(t.x)<5.3){if(p.ball)ballsWon++;else won++;emit(t.x,-0.3,FRONT+0.2,4,GOLD,1.4)}else{if(p.ball)ballsWon++;else lost++}}
     if(p.counted&&(p.ball||t.y<-3.5||c.frame-p.counted>150)){world.removeRigidBody(p.body);pieces.delete(h)}}
    c=settle(c,won,lost,ballsWon)
    cove.current=c;acc-=1000/60
    if(won)fx('ding',soundRef.current)
    const ev=c.events[c.events.length-1];if(ev&&ev!==before.events[before.events.length-1]){setHud(h=>({...h,event:ev.text,big:/BIG BONUS|JACKPOT[!]/.test(ev.text)}))
     if(/BIG BONUS/.test(ev.text)){cine={at:c.frame,bank:before.bank??BANK_START};show.party=300;buzz([60,40,60,40,200]);pop('BIG BONUS!',0,BTOP+2.6,BZ,'big');fx('fanfare',soundRef.current)}
     else if(/FEVER/.test(ev.text)){show.party=180;emit(0,BTOP,BZ+1,160,CONFETTI,4);pop('🌈 FEVER TIME!',0,BTOP-0.5,BZ+0.5,'big');buzz([40,30,40,30,120]);fx('blaze',soundRef.current)}
     else if(/COMBO/.test(ev.text)){const m=/×(\d+)/.exec(ev.text);pop('COMBO ×'+(m?.[1]??''),0,BTOP-1,BZ+0.5,'combo');fx('mult',soundRef.current)}
     if(/JACKPOT[!]/.test(ev.text)){show.party=360;show.shake=1.4;emit(0,3,0,300,CONFETTI,6);pop('🎉 JACKPOT!!',0,2,1,'big');buzz([100,50,100,50,300])}
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
    if(sp&&sp.at!==w.spinAt){w.spinAt=sp.at;w.from=w.angle;fx('charge',soundRef.current)}
    if(sp){const t=Math.min(1,(f-sp.at)/WHEEL_FRAMES),target=sp.seg*Math.PI/4,base=w.from-(w.from%(Math.PI*2)),end=base+Math.PI*2*4+target
     w.angle=w.from+(end-w.from)*(1-(1-t)**3)
     // A click as each segment passes the pointer, slowing down with the wheel.
     const under=Math.round(w.angle/(Math.PI/4));if(under!==wheelSeg[i]&&t<1){wheelSeg[i]=under;fx('tick',soundRef.current)}
     if(t>=1&&w.flash<0.5){w.flash=1;emit(WHEEL_X[i],WHEEL_Y,BZ+0.3,40,POCKET_SPARK[i],2.6);const seg=WHEELS[i][sp.seg];fx(seg.kind==='lamp'||seg.kind==='ball'?'star':'ding',soundRef.current)
      pop(seg.kind==='medals'?'+'+seg.n+' 🪙':seg.kind==='layers'?'+'+seg.n+' 🗼 '+(seg.n===1?'LAYER':'LAYERS'):seg.kind==='ball'?'🔮 BALL!':seg.kind==='lamp'?'💡 LAMP!':'🎰 SPIN!',WHEEL_X[i],WHEEL_Y+0.5,BZ,'prize'+i)}}
    else w.angle+=0.004
    w.disc.rotation.z=w.angle;w.flash=Math.max(0,w.flash-0.02);(w.rim.material as THREE.MeshStandardMaterial).emissiveIntensity=0.4+w.flash*3+(sp?0.6*Math.abs(Math.sin(f/4)):0)
    if(!sp&&w.flash<0.02)w.flash=0})
   const inCine=cine&&f-cine.at<75,bank=inCine?cine!.bank:c.bank??BANK_START,gn=Math.min(GIANT_MAX,Math.round(bank/2)),quake=inCine?Math.sin(f*1.7)*0.06*Math.min(1,(f-cine!.at)/30):0
   if(cine&&f-cine.at===50)pop('TIMBER!',0,BTOP+2.4,BZ,'big')
   if(cine&&f-cine.at>200)cine=null
   for(let i=0;i<gn;i++){m4.compose(v3.set(Math.cos(i*0.5)*0.04+quake*(i/gn),BTOP+1.98+i*0.124,BZ-0.6+Math.sin(i*0.5)*0.04),q.setFromEuler(new THREE.Euler(0,i*0.4,0)),s3);giant.setMatrixAt(i,m4)}
   giant.count=gn;giant.instanceMatrix.needsUpdate=true
   // The show.
   const party=show.party>0;show.party=Math.max(0,show.party-1);show.shake*=0.92
   const feverOn=inFever(c),RAINBOW=CONFETTI
   bulbSpots.forEach((_,i)=>{if(feverOn){bulbs.setColorAt(i,RAINBOW[(i+Math.floor(f/3))%RAINBOW.length]);return}const on=party?((i+Math.floor(f/3))%2===0):((i+Math.floor(f/5))%5===0);bulbs.setColorAt(i,on?BULB[(i+Math.floor(f/(party?6:40)))%3]:dim)});if(bulbs.instanceColor)bulbs.instanceColor.needsUpdate=true
   ringMats.forEach((m,i)=>{const lit=i<c.steps;m.emissiveIntensity=lit?2.2+0.6*Math.sin(f/6+i):party?(f/4+i)%2<1?2:0:0;m.color.set(lit?'#ffe08a':'#3a3a3a')})
   beamPivot.rotation.y=f*(party?0.12:0.03);(beam.material as THREE.MeshBasicMaterial).opacity=party?0.3:0.16
   const anim=party?konoAnim.cheer:now-lastDrop.current<900?konoAnim.wave:konoAnim.breathe;anim.offset.x=Math.floor(f/(party?6:10))%4*0.25;kono.material.map=anim
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
   if(cine){const t=f-cine.at,k=t<20?t/20:t<120?1:Math.max(0,1-(t-120)/60),e=k*k*(3-2*k)
    camera.position.lerp(new THREE.Vector3(0,BTOP+3.4,BZ+6.2),e);const look=new THREE.Vector3(0,2.2,-1.2).lerp(new THREE.Vector3(0,BTOP+2.4,BZ-0.6),t<75?e:e*0.4);camera.lookAt(look)}
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
    if(f===c.chance.at+1)pop('JACKPOT CHANCE',0,3.6,1,'big');wheel.rotation.y=(1-(1-t)**3)*Math.PI*2*5+c.chance.pocket/CHANCE_POCKETS*Math.PI*2}
   composer.render()
   if(now-lastHud>120||c.spinning){lastHud=now
    const reels=c.spinning?[0,1,2].map(i=>f-c.spinning!.at<40+i*25?REEL_FACES[Math.floor((f+i*3)/3)%6]:c.spinning!.reels[i]):hudReels.current
    if(c.spinning)hudReels.current=reels
    setHud(h=>h.bank===(c.bank??BANK_START)&&h.hand===c.hand&&h.jp===c.jackpot&&h.steps===c.steps&&h.pockets===c.winPockets&&h.queue===c.queue&&h.reels.join()===reels.join()&&h.spinning===!!c.spinning?h:{...h,bank:c.bank??BANK_START,hand:c.hand,jp:c.jackpot,steps:c.steps,pockets:c.winPockets,queue:c.queue,reels,spinning:!!c.spinning})}
   const fl=feverOn&&c.fever?Math.ceil((c.fever.until-f)/60):0;if(fl!==feverRef.current){feverRef.current=fl;setFever(fl)}
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
  <div ref={host} className="cove-stage" role="img" aria-label={'KONO Medal Cove: '+hud.hand+' medals, jackpot '+hud.jp}>
   <div className="cove-board" aria-label="Backboard">
   <div className="cove-steps" aria-label={hud.steps+' of '+LAMPS+' lamps'}>{Array.from({length:LAMPS},(_,i)=><i key={i} className={i<hud.steps?'is-on':undefined}/>)}<small>💡 lamps</small></div>
   <div className="cove-jp"><small>JACKPOT</small><b>{hud.jp}</b></div>
   <div className="cove-pockets" aria-label={'Giant tower: '+hud.bank+' medals'}><b>🗼 {hud.bank}</b><small>giant tower</small><small>🎯 {hud.pockets}/{CHANCE_POCKETS} JP{best!==null?' · best '+best:''}</small></div>
   <div className={'cove-reels'+(hud.spinning?' is-spinning':'')} aria-label={'Lottery: '+hud.reels.join(' ')}>{hud.reels.map((r,i)=><span key={i}>{r}</span>)}</div>
   <div className="cove-queue" aria-label={hud.queue+' spins waiting'}>{Array.from({length:4},(_,i)=><i key={i} className={i<hud.queue?'is-on':undefined}/>)}</div>
  </div>
   {!hud.ready&&!fail&&<p className="cove-loading" role="status">Filling the machine with medals…</p>}
   {fail&&<CoveFail kind={fail} onRetry={()=>{setFail(null);setTries(n=>n+1)}} onLeave={onFail}/>}
   {hud.event&&<p key={hud.event} className={'cove-event'+(hud.big?' is-big':'')} role="status">{hud.event}</p>}
   {hud.event&&hud.big&&<span key={'f'+hud.event} className="cove-flash" aria-hidden="true"/>}
   {fever>0&&<span className="cove-fever" role="status" aria-label={'Fever time: '+fever+' seconds'}>🌈 FEVER {fever}s</span>}
   {pops.map(p=><b key={p.id} className={'cove-pop is-'+p.kind.replace(/\d/,'')+(p.kind.match(/\d/)?' is-c'+p.kind.match(/\d/)![0]:'')} style={{left:p.x+'%',top:p.y+'%'}} aria-hidden="true">{p.text}</b>)}
   <button type="button" className="cove-view" aria-label="Change the camera" onClick={()=>setView(v=>(v+1)%VIEWS.length)}>🎥</button>
   <span className="cove-hand" aria-hidden="true">🪙 {hud.hand}</span>
  </div>
  <p className="blast-help">Touch to aim along the top of the pin board and tap to drop (hold to keep dropping). Medals bounce down the pins into a pocket, and its mini wheel spins: medals, giant-tower layers, a prize ball, a lamp or a lottery spin. Light all 5 lamps for the BIG BONUS: the giant tower comes down! Drag around the edges to look around.</p>
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
/** The pin board's backplate: a soft sky with the Sanctuary's own trees, lanterns, clouds and flowers painted
 * behind the pins (drawn in as each picture loads), and the cabinet's name. */
function boardTexture(){const [c,g]=canvas(1024,384)
 const paint=()=>{const grad=g.createLinearGradient(0,0,0,384);grad.addColorStop(0,'#bfe7ff');grad.addColorStop(.7,'#ffeef5');grad.addColorStop(1,'#ffe1ec');g.fillStyle=grad;g.fillRect(0,0,1024,384)}
 paint()
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace
 const parts:[string,number,number,number][]=[['cloud-a',90,40,170],['cloud-b',640,24,190],['cloud-a',820,70,150],['tree-blossom',-30,96,290],['tree-leafy',800,110,270],['lantern-post',250,190,170],['lantern-post',700,190,170],['flowers-1',120,316,130],['flowers-3',330,322,120],['flowers-2',520,316,130],['flowers-4',720,318,130],['flowers-1',900,320,120]]
 const imgs=parts.map(([n])=>Object.assign(new Image(),{src:'/games/cove/'+n+'.webp'}))
 let left=imgs.length
 const draw=()=>{paint();g.imageSmoothingEnabled=false
  parts.forEach(([,x,y,h],i)=>{const im=imgs[i];if(!im.complete||!im.naturalWidth)return;const w=h*im.naturalWidth/im.naturalHeight;g.globalAlpha=0.92;g.drawImage(im,x,y-(h-(384-y)>0?0:0),w,h);g.globalAlpha=1})
  g.fillStyle='rgba(255,255,255,.85)';g.strokeStyle='rgba(214,112,150,.9)';g.lineWidth=6;g.font='900 44px system-ui';g.textAlign='center';g.strokeText('KONO MEDAL COVE',512,372);g.fillText('KONO MEDAL COVE',512,372)
  t.needsUpdate=true}
 imgs.forEach(im=>{im.onload=im.onerror=()=>{left--;draw()}})
 if(!left)draw()
 return t}
function emojiTexture(e:string){const [c,g]=canvas(128,128);g.font='96px system-ui,"Apple Color Emoji","Noto Color Emoji"';g.textAlign='center';g.textBaseline='middle';g.fillText(e,64,70)
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function stripeTexture(){const [c,g]=canvas(64,256);for(let i=0;i<8;i++){g.fillStyle=i%2?'#f6f1e7':'#d8443a';g.fillRect(0,i*32,64,32)}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function wheelSegTexture(segs:{label:string;kind:string}[],w:number){const [c,g]=canvas(256,256),n=segs.length,cx=128,cy=128,r=126
 const pal=[['#ff6b5e','#ffb3a8'],['#ffd34d','#fff0b8'],['#4fb3ff','#b9e2ff']][w]
 segs.forEach((sg,k)=>{const a0=-Math.PI/2+k*2*Math.PI/n-Math.PI/n,a1=a0+2*Math.PI/n
  g.fillStyle=sg.kind==='lamp'?'#fff3a0':sg.kind==='ball'?'#c8a8ff':sg.kind==='layers'?'#9fe0ff':pal[k%2];g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,r,a0,a1);g.closePath();g.fill();g.strokeStyle='#5a3a24';g.lineWidth=3;g.stroke()
  g.save();g.translate(cx,cy);g.rotate((a0+a1)/2+Math.PI/2);g.fillStyle='#2b1a3a';g.font='bold '+(sg.label.length>6?15:20)+'px system-ui';g.textAlign='center'
  g.fillText(sg.kind==='lamp'?'💡':sg.kind==='ball'?'🔮':sg.kind==='spin'?'🎰':sg.kind==='layers'?'🗼':'🪙',0,-r+30);g.fillText(sg.label.replace(' layers',' L').replace(' layer',' L'),0,-r+54);g.restore()})
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
const ASPECT:Record<string,number>={'lantern-post':117/192,'lantern-post-night':117/192,'paper-lanterns':192/151,'light-arch':256/236,'tree-blossom':253/256,'tree-leafy':227/256,'flowers-1':99/49,'flowers-2':112/61,'flowers-3':100/58,'flowers-4':110/64,'shell':72/56,'petal-1':36/48,'petal-2':43/48,'sparkle':1,'cloud-a':209/67,'cloud-b':220/70,'butterfly':60/33,'butterfly-2':42/33,'bird':63/42}
function skyTexture(){const [c,g]=canvas(16,256);const grad=g.createLinearGradient(0,0,0,256);grad.addColorStop(0,'#a9dcff');grad.addColorStop(.55,'#d9efff');grad.addColorStop(1,'#ffe9f2');g.fillStyle=grad;g.fillRect(0,0,16,256);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
