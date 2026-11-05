import type {MedalMusic} from '../medalMusic'
import {KonoCinema} from './KonoCinema'
import {boundedAccumulator,mayStep,retainedRemainder,PHYSICS_STEP_MS} from '../store/frameBudget'
import {flipperPose} from '../store/flipper'
import BonusConsole from './BonusConsole'
import TideDeliveryPanel from './TideDeliveryPanel'
import {createBoatTarget,createReferenceBuildBay} from './referenceCabinet'
import {createPusherFacade,createInputChute,createRampMouth,createSanctuaryPost,addSanctuaryCabinetTrim,createDockRail,createBallMagazine,createTowerHead} from './sanctuaryAssets'
import {useBonusReveals} from './BonusReveals'
import {createContactBegins,createMachineFeedback} from './machineFeedback'
import {createLocalReveals} from './localReveals'
import {createMachineEventScreen} from './machineEventScreen'
import {createTowerCeremony} from './towerCeremony'
import {useEffect,useImperativeHandle,useRef,useState,type Ref} from 'react'
import {createPortal} from 'react-dom'
import * as THREE from 'three'
import {CAMERA_VIEWS,FRONT_EYE_HEIGHT,RESERVE_BOUNDS,frameBoundsForView,fitWholeRouteFrame,fitTieredFrame,TIERED_VIEW_INDEX,fitMachineFrame,type FramePoint} from './framing'
import {cameraPoseFrame,createCameraGesture,panCamera,readCameraPose,saveCameraPose,validateCameraPose,type CameraPose,type CameraDragMode} from './cameraControl'
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js'
import RAPIER from '@dimforge/rapier3d-compat'
import {BloomEffect,EffectComposer,EffectPass,RenderPass,SMAAEffect} from 'postprocessing'
import {BANK_START,FIELD,LAMPS,POCKETS,inFever,WHEELS,WHEEL_FRAMES,awardField,launchBonus,claimBoardClear,drop,newCove,pocket,recordStartingBalls,settle,spawned,step,type Cove,type Reel} from '../store/pusher'
import {createRewardRoute} from '../store/rewardRoute'
import {createBoardClearMachine} from '../store/boardClear'
import {updateRearContactAccuracy} from '../store/contactAccuracy'
import {gameSound} from '../konoSounds'
import {fx} from '../arcadeAudio'
import type {GameHandle} from './GameScreen'
import CoveFail,{type CoveFailure} from './CoveFail'
import {webglWorks} from './webgl'
import {CABINET,PLINKO,FIELD_MOTION,PIN_POSITIONS,PUSHER_SHELF,BOARD_BACKSTOP,shelfFront,shelfCenter,fieldStock} from '../store/motion'
import {bindFeedSafety,createFeedControl,FEED_CAPACITY,feederHasRoom} from '../store/interaction'
import {newPractice,practiceCommand,PRACTICE_ACTIONS,type PracticeCommand} from '../store/practice'
import {TOWER,createTowerMachine} from '../store/tower'
import {TIDE,createTideMachine,tideLaneZ,tideLoadBlocked,type TideLane,type TideStatus} from '../store/tide'
import BonusDraw,{bonusPresentation,type BonusPresentation} from './BonusDraw'
import {assertDeliveryConserved,deliveryLedger,pendingMedals,hasPendingWork,ballProgress,type DeliveryRoute} from '../store/delivery'
import {TRAY,capturePiece,COIN_MOTION,BALL_MOTION,createDispenser,enqueueDispense,releaseDispense,reserveDisplay,RESERVE_DISPLAY} from '../store/dispense'

/** KONO Medal Cove (rules in store/pusher), in 3D with real physics: a medal pusher cabinet on KONO's dock.
 * Every medal is a coin in a physics world (Rapier): they drop from the chute, land on each other, pile up
 * against the pusher, get shoved forward and teeter off the front into the tray (or slip off the sides
 * near the front). The pusher is a moving block with a shelf on top; a wall above its back scrapes off
 * what lands on it. Medal towers stand as real stacks until the pusher knocks into them. The lottery,
 * ball lottery and Jackpot Chance retain their software-selected rules. Readable
 * dashboard outcome maps hand a fixed JP award to the physical Sanctuary Tide.
 * Watch the sweeping flipper; Drop releases medals. Camera editing is explicit and cannot spend medals. */
const U=0.1 // world units per field unit
const MAX=900 // medal body budget; no live body is evicted to make room
const R=FIELD.r*U,HALF=0.055,BALL=FIELD.ball*U
const FRONT=CABINET.front // the field's front edge (z)
// The pin board at the back: medals go in at the top, bounce down the pins and land in a pocket or on the
// pusher's shelf. Pockets: 🏮 (left), ⭐ (the middle one, sliding), 🗼 (right).
const BZ=PLINKO.z,BTOP=PLINKO.top,BBOTTOM=PLINKO.bottom,POCKET_W=[1.25,1.05,1.25]
const pocketX=(i:number,f:number)=>i===0?-3.0:i===2?3.0:Math.sin(f/80)*1.4
// Pins 1.2 apart, rows 0.5 apart and offset by half: every gap (straight and diagonal) lets a medal through.
const PINS=PIN_POSITIONS
const POCKET_FACE=['🏮','⭐','🗼']
// The side slides: one each side of the cabinet, from outside it, over a gap in the side wall, down toward
// the middle; each ends up high over the pusher's shelf (so the medals on the shelf pass under it) and the
// medals drop off its end onto the shelf.
const RAMP_Z=-5.25,RAMP_HALF=0.52,RAMP_OUT=6.6-CABINET.sideShift,RAMP_IN=5.12-CABINET.sideShift
// Shared mesh/contact wall sections. A low physical sill lets the loaded tower
// and open empty cradle cross from the outside workshop without ghosting glass.
const sideWallSections=(side:number)=>{
 const g0=RAMP_Z-RAMP_HALF-.08,g1=RAMP_Z+RAMP_HALF+.08
 const crossingEnd=TOWER.z+TOWER.leafHalfDepth*2+TOWER.opening+.10
 return side<0?[[FRONT-CABINET.depth+.4,g0,1,2.4],[g1,FRONT,1,2.4],[g0,g1,.425,1.25]]:
 [[FRONT-CABINET.depth+.4,g0,1,2.4],[g0,g1,.425,1.25],[g1,crossingEnd,.45,1.3],[crossingEnd,FRONT,1,2.4]]
}

const RAMPS=[0,1].map(side=>{const s=side?1:-1,top={x:s*RAMP_OUT,y:2.6},bot={x:s*RAMP_IN,y:1.58},dx=RAMP_OUT-RAMP_IN,dy=top.y-bot.y,len=Math.hypot(dx,dy)
 return {s,top,bot,len,angle:Math.atan2(dy,dx),dir:{x:-s*dx/len,y:-dy/len},at:(x:number)=>bot.y+(Math.abs(x)-RAMP_IN)/dx*dy}})
// The ball run: a zig-zag track outside the cabinet on the left that ends at the top of the left slide.
const RUN:[number,number,number][]=[[-5.9+CABINET.sideShift,6.3,RAMP_Z],[-6.95+CABINET.sideShift,5.75,RAMP_Z],[-5.9+CABINET.sideShift,5.2,RAMP_Z],[-6.95+CABINET.sideShift,4.65,RAMP_Z],[-5.9+CABINET.sideShift,4.1,RAMP_Z],[-6.12+CABINET.sideShift,2.90,RAMP_Z]]
const RUN_LEN=RUN.slice(1).reduce((a,p,i)=>a+Math.hypot(p[0]-RUN[i][0],p[1]-RUN[i][1],p[2]-RUN[i][2]),0)
// The seesaw tray at the foot of the right slide (fills, then tips onto the field), KONO's bucket (one medal
// for each pocket hit, thrown onto the field when full). The lower wooden bed stays still.
const BUCKET_FULL=6
// A compact nonphysical sample of the exact bank; overflow remains in the HUD.
const GSTEP=0.17
const AIM_UNIT=CABINET.aimHalfWidth/45
const wx=(x:number)=>(x-50)*AIM_UNIT
const REEL_FACES:Reel[]=['🪙','🗼','🔮','⭐','🐚','🌺']
const VIEWS=CAMERA_VIEWS

/** `ramp`: which side slide it came down (1 left, 2 right), for the seesaw. */
type Piece={body:RAPIER.RigidBody;ball:boolean;counted:number;board:boolean;ramp?:number;capturedPocket?:number;born:number;reward?:boolean;towerHeld?:boolean;tideHeld?:boolean;tideId?:number}

export default function MedalCove({ref,best,sound,music,onEnd,onFail,toolsTarget,blocked=false}:{ref:Ref<GameHandle>;best:number|null;sound:boolean;music?:MedalMusic;onEnd:(medals:number,jackpots:number,practice:boolean)=>void;blocked?:boolean;onFail?:()=>void;toolsTarget?:HTMLElement|null}){
 const [fail,setFail]=useState<CoveFailure|null>(null),[tries,setTries]=useState(0)
 const [start]=useState<Cove>(()=>newCove(Math.random,100,true))
 const cove=useRef<Cove>(start),host=useRef<HTMLDivElement>(null),aim=useRef(50),feed=useRef(createFeedControl()),lastDrop=useRef(-Infinity)
 const [hud,setHud]=useState({hand:start.hand,jp:start.jackpot,steps:0,pockets:1,queue:0,event:'',big:false,bank:BANK_START,reels:['🌺','🌺','🌺'] as string[],spinning:false,ready:false,chance:false})
 const [pops,setPops]=useState<{id:number;text:string;x:number;y:number;kind:string}[]>([]),popId=useRef(0)
 const [fever,setFever]=useState(0)
 const [looking,setLooking]=useState(false),lookRef=useRef(false)
 const [savedCamera,setSavedCamera]=useState<CameraPose|null>(()=>{try{return readCameraPose(window.localStorage)}catch{return null}})
 const [cameraPose,setCameraPose]=useState<CameraPose|null>(()=>{try{return window.localStorage.getItem('kono-medal-cove.tier-view.v1')==='saved'?savedCamera:null}catch{return null}}),cameraPoseRef=useRef(cameraPose)
 const cameraToggle=useRef<HTMLButtonElement>(null)
 const cameraSnapshot=useRef<(()=>CameraPose)|null>(null),[cameraDrag,setCameraDrag]=useState<CameraDragMode>('pan'),cameraDragRef=useRef<CameraDragMode>('pan')
 const [cameraNotice,setCameraNotice]=useState(cameraPose?'View locked · saved on this device':'')
 const [routePreview,setRoutePreview]=useState(false),routePreviewRef=useRef(false),previousCameraNotice=useRef('')
 const previewWholeRoute=()=>{if(!ready.current||blockedRef.current||detailsPauseRef.current||lookRef.current)return;stopFeed();gestureStop.current?.();if(routePreviewRef.current){routePreviewRef.current=false;setRoutePreview(false);setCameraNotice(previousCameraNotice.current)}else{previousCameraNotice.current=cameraNotice;routePreviewRef.current=true;setRoutePreview(true);setCameraNotice('Reference view · your previous view is unchanged')}}
 const updateCamera=(pose:CameraPose)=>{const valid=validateCameraPose(pose);if(valid){cameraPoseRef.current=valid;setCameraPose(valid)}}
 const saveView=(pose:CameraPose|null)=>{try{if(pose){if(!saveCameraPose(window.localStorage,pose))return false;setSavedCamera(pose)}window.localStorage.setItem('kono-medal-cove.tier-view.v1',pose?'saved':'tiered');return true}catch{return false}}
 const restoreSavedView=()=>{if(!savedCamera||!ready.current||blockedRef.current||routePreviewRef.current)return;stopFeed();gestureStop.current?.();lookRef.current=false;setLooking(false);updateCamera(savedCamera);saveView(savedCamera);setCameraNotice('Saved view restored · Tiered shows the whole machine')}
 const editCamera=()=>{if(!ready.current||blockedRef.current||routePreviewRef.current)return;stopFeed();gestureStop.current?.();if(!cameraPoseRef.current&&cameraSnapshot.current)updateCamera({...cameraSnapshot.current(),zoom:1.25});lookRef.current=true;setLooking(true);setCameraNotice('Camera editing · drops are off')}
 const lockCamera=()=>{if(!cameraPoseRef.current)return;stopFeed();gestureStop.current?.();lookRef.current=false;setLooking(false);setCameraNotice(saveView(cameraPoseRef.current)?'View locked · saved on this device':'View locked for now · browser could not save it');cameraToggle.current?.focus({preventScroll:true})}
 const selectView=(index:number)=>{if(routePreviewRef.current)return;stopFeed();gestureStop.current?.();lookRef.current=false;setLooking(false);cameraPoseRef.current=null;setCameraPose(null);viewRef.current=index;setView(index);setCameraNotice(saveView(null)?'':'Tiered view selected for this visit')}
 const adjustCamera=(changes:Partial<CameraPose>)=>{if(lookRef.current&&cameraPoseRef.current)updateCamera({...cameraPoseRef.current,...changes})}
 const moveCamera=(right:number,up:number)=>{if(lookRef.current&&cameraPoseRef.current)updateCamera(panCamera(cameraPoseRef.current,right,up))}
 const [delivery,setDelivery]=useState({awarded:0,delivered:0,pending:0,live:0,collected:0,lost:0,tray:0,ballWaiting:0,ballArriving:0,ballField:0,captured:0,phase:'Push a ball to the catcher',tower:'Reserve ready',routes:[] as DeliveryRoute[],wheelQueue:[0,0,0]}),[practice,setPractice]=useState(false),[practiceUsed,setPracticeUsed]=useState(false)
 const practiceState=useRef(newPractice()),[practiceMessage,setPracticeMessage]=useState('Choose a sample. Original physics and random wheel outcomes still apply.')
 const [clearView,setClearView]=useState({tokens:0,active:false,phase:'idle',total:0,collected:0,remaining:0,practice:false}),clearRequest=useRef<(()=>void)|null>(null)
 const requestBoardClear=()=>{if(!ready.current||ended.current||blockedRef.current||detailsPauseRef.current||lookRef.current||document.hidden)return;const c=claimBoardClear(cove.current);if(c===cove.current)return;stopFeed();gestureStop.current?.();cove.current=c;clearRequest.current?.()}
 const acceptedFeedback=useRef<((x:number)=>void)|null>(null)
 const cinemaFrame=useRef<((dt:number,c:Cove)=>void)|null>(null)
 const drawFrame=useRef<((c:Cove)=>void)|null>(null)
 const requestBonusLaunch=(kind:'dish'|'chance',id:number)=>{
  if(!ready.current||ended.current||blockedRef.current||detailsPauseRef.current||lookRef.current||document.hidden||cove.current.boardClearBusy)return
  cove.current=launchBonus(cove.current,kind,id);setDraw(bonusPresentation(cove.current))
 }
 const [draw,setDraw]=useState<BonusPresentation|null>(null),[tide,setTide]=useState<TideStatus|null>(null)
 const [tideSummary,setTideSummary]=useState<{total:number;lane:TideLane;practice:boolean;collected:number}|null>(null),[tideCollected,setTideCollected]=useState(0)
 const tideChoice=useRef<((id:number,lane:TideLane)=>boolean)|null>(null)
 const selectTideLane=(id:number,lane:TideLane)=>{
  if(!ready.current||ended.current||blockedRef.current||detailsPauseRef.current||lookRef.current||document.hidden||cove.current.boardClearBusy)return
  stopFeed();gestureStop.current?.();tideChoice.current?.(id,lane)
 }
 const command=useRef<((kind:PracticeCommand)=>void)|null>(null),hotspots=useRef<(HTMLButtonElement|null)[]>([])
 const [detailsPaused,setDetailsPaused]=useState(false),detailsPauseRef=useRef(false),practiceDialog=useRef<HTMLDialogElement>(null)
 const pauseDetails=(open:boolean)=>{detailsPauseRef.current=open;setDetailsPaused(open);if(open){stopFeed();gestureStop.current?.()}}
 useEffect(()=>()=>{detailsPauseRef.current=false},[])
 const closePractice=()=>{practiceState.current.enabled=false;setPractice(false)}
 useEffect(()=>{if(practice){practiceDialog.current?.showModal();pauseDetails(true)}else{practiceDialog.current?.close();pauseDetails(false)}},[practice])
 const inputQueued=useRef(0),[inputStatus,setInputStatus]=useState({queued:0,capacity:FEED_CAPACITY,headAim:null as number|null,reason:''})
 const canAcceptInput=(c:Cove)=>feederHasRoom(inputQueued.current,c.medals.filter(m=>m.y<0).length)
 const [feeding,setFeeding]=useState(false),feedingRef=useRef(false),blockedRef=useRef(blocked),spaceButton=useRef(false),gestureStop=useRef<(()=>void)|null>(null)
 const stopFeed=(owner?:string)=>{if(owner===undefined)spaceButton.current=false;feed.current.stop(owner);feedingRef.current=feed.current.active;setFeeding(feedingRef.current)}
 const togglePractice=()=>{if(blockedRef.current||lookRef.current||document.hidden)return;stopFeed();practiceState.current.enabled=!practiceState.current.enabled;setPractice(practiceState.current.enabled)}
 useEffect(()=>{lookRef.current=looking;stopFeed();gestureStop.current?.()},[looking])
 useEffect(()=>{blockedRef.current=blocked;if(blocked){stopFeed();gestureStop.current?.()}},[blocked])
 useEffect(()=>bindFeedSafety(window,document,stopFeed),[])
 const [,setJpWin]=useState<number|null>(null),jpCount=useRef<HTMLElement>(null)
 const [bigWin,setBigWin]=useState<number|null>(null),bbCount=useRef<HTMLElement>(null),[win,setWin]=useState<{n:number;id:number}|null>(null)
 // The three always-visible wheels above the cabinet: each turns with its wheel; a spin lights it up and its prize shows.
 const dialEls=useRef<(SVGGElement|null)[]>([])
 const [dials,setDials]=useState(()=>[0,1,2].map(()=>({spin:false,prize:'',kind:'',at:0})))
 const [view,setView]=useState(4),viewRef=useRef(4),hudReels=useRef<string[]>(['🌺','🌺','🌺'])
 const feverRef=useRef(0)
 const {reveals,overlay:revealOverlay,control:revealControl}=useBonusReveals()
 const musicRef=useRef(music)
 useEffect(()=>{musicRef.current=music},[music])
 useEffect(()=>{music?.setActive(hud.ready&&!blocked&&!detailsPaused&&!looking&&!fail);return()=>music?.setActive(false)},[music,hud.ready,blocked,detailsPaused,looking,fail])
 const ended=useRef(false),onEndRef=useRef(onEnd),soundRef=useRef(sound),quiet=useRef(0),ready=useRef(false)
 useEffect(()=>{onEndRef.current=onEnd;soundRef.current=sound},[onEnd,sound])
 useEffect(()=>{viewRef.current=view},[view])
 useImperativeHandle(ref,()=>({end:()=>{if(ended.current)return;ended.current=true;stopFeed();onEndRef.current(cove.current.hand,cove.current.jpWins,practiceState.current.used)}}),[])
 const dropOne=()=>{const c=cove.current;if(!ready.current||ended.current||blockedRef.current||detailsPauseRef.current||lookRef.current||document.hidden||c.boardClearBusy||c.hand<=0||!canAcceptInput(c))return;cove.current=drop(c,aim.current);acceptedFeedback.current?.(wx(aim.current));lastDrop.current=performance.now();fx('tick',soundRef.current)}
 const beginFeed=(owner:string)=>{if(!ready.current||ended.current||blockedRef.current||detailsPauseRef.current||lookRef.current||document.hidden||cove.current.boardClearBusy||cove.current.hand<=0)return;if(feed.current.begin(owner,performance.now()))dropRef.current();feedingRef.current=feed.current.active;setFeeding(feedingRef.current)}
 const tapDrop=()=>{if(lookRef.current)return;if(feed.current.tap(performance.now()))dropRef.current()}
 const retryMachine=()=>{
  reveals.reset()
  inputQueued.current=0;setInputStatus({queued:0,capacity:FEED_CAPACITY,headAim:null,reason:''});cove.current={...newCove(Math.random,100,true),bonusSequence:cove.current.bonusSequence};ended.current=false;ready.current=false;feed.current.reset();feedingRef.current=false;setFeeding(false);quiet.current=0;lastDrop.current=-Infinity;aim.current=50
  lookRef.current=false;setLooking(false);setView(4);viewRef.current=4;setPractice(false);setPracticeUsed(false);practiceState.current=newPractice();setPracticeMessage('Choose a sample. Original physics and random wheel outcomes still apply.');setDelivery({awarded:0,delivered:0,pending:0,live:0,collected:0,lost:0,tray:0,ballWaiting:0,ballArriving:0,ballField:0,captured:0,phase:'Push a ball to the catcher',tower:'Reserve ready',routes:[] as DeliveryRoute[],wheelQueue:[0,0,0]});setPops([]);setFever(0);feverRef.current=0;setJpWin(null);setBigWin(null);setWin(null)
  setClearView({tokens:0,active:false,phase:'idle',total:0,collected:0,remaining:0,practice:false});setDraw(null);setTide(null);setTideSummary(null);setTideCollected(0)
  hudReels.current=['🌺','🌺','🌺'];setDials([0,1,2].map(()=>({spin:false,prize:'',kind:'',at:0})))
  setHud({hand:100,jp:100,steps:0,pockets:1,queue:0,event:'',big:false,bank:BANK_START,reels:['🌺','🌺','🌺'],spinning:false,ready:false,chance:false});setFail(null);setTries(n=>n+1)
 }
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
  renderer.setPixelRatio(soft?1:Math.min(small?1.5:2,window.devicePixelRatio||1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05
  el.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true')
  // The original Sanctuary daylight garden, using its own trees, blossoms and lantern art.
  const scene=new THREE.Scene();scene.background=sanctuaryBackdrop();scene.fog=new THREE.Fog('#d9efff',28,60)
  const localReveals=createLocalReveals(scene,reveals)
  const eventScreen=createMachineEventScreen(scene,reveals)
  const machineFeedback=createMachineFeedback(scene,reveals),contactBegins=createContactBegins()
  acceptedFeedback.current=x=>machineFeedback.cue('accepted',{x,y:BTOP+.3,z:BZ})
  const towerCeremony=createTowerCeremony(scene,reveals)
  // Soft toon shading in three tones and pastel colors, to sit with the Sanctuary's art.
  const tones=new THREE.DataTexture(new Uint8Array([150,150,150,255,205,205,205,255,255,255,255,255]),3,1,THREE.RGBAFormat);tones.magFilter=tones.minFilter=THREE.NearestFilter;tones.needsUpdate=true
  const toon=(color:string,extra:THREE.MeshToonMaterialParameters={})=>new THREE.MeshToonMaterial({color,gradientMap:tones,...extra})
  const loader=new THREE.TextureLoader(),aniso=renderer.capabilities.getMaxAnisotropy()
  const pix=(name:string)=>{const t=loader.load('/games/cove/'+name+'.webp');t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=aniso;return t}
  const camera=new THREE.PerspectiveCamera(42,1,0.1,80)
  const pmrem=new THREE.PMREMGenerator(renderer),envRT=pmrem.fromScene(new RoomEnvironment(),0.04);scene.environment=envRT.texture;pmrem.dispose()
  scene.add(new THREE.HemisphereLight('#dff3ff','#4a3424',0.8))
  const sun=new THREE.DirectionalLight('#fff4dc',2.2);sun.position.set(4,12,6);sun.castShadow=true;sun.shadow.mapSize.setScalar(soft?512:small?1024:2048)
  Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:30});scene.add(sun)
  // One merged effect pass: bloom on what's bright (the lantern, the shine on the gold, the jackpot pieces)
  // and SMAA for smooth edges. Half-resolution bloom on phones.
  // Phones use SMAA alone instead of paying for both multisampling and SMAA.
  const composer=new EffectComposer(renderer,{multisampling:soft||small?0:Math.min(4,renderer.capabilities.maxSamples||0)})
  composer.addPass(new RenderPass(scene,camera))
  const bloom=new BloomEffect({intensity:small?0.28:0.35,luminanceThreshold:0.92,luminanceSmoothing:0.2,mipmapBlur:true,resolutionScale:soft?0.5:small?0.75:1})
  composer.addPass(new EffectPass(camera,bloom,new SMAAEffect()))
  // ---- The cabinet you see ----
  const deckMat=toon('#f6dcb4',{map:woodTexture()})
  const deck=new THREE.Mesh(new THREE.BoxGeometry(CABINET.width,0.4,CABINET.depth),deckMat);deck.position.set(0,-0.2,FRONT-CABINET.depth/2);deck.receiveShadow=true;scene.add(deck)
  const frameMat=toon('#f4a6c1')
  const glass=new THREE.MeshPhysicalMaterial({color:'#e8f7ff',transparent:true,opacity:.14,roughness:.05})
  for(const s of [-1,1]){const g0=RAMP_Z-RAMP_HALF-.08
   for(const [z0,z1,y,h] of sideWallSections(s)){const g=new THREE.Mesh(new THREE.BoxGeometry(.2,h,z1-z0),glass);g.position.set(s*CABINET.wallX,y,(z0+z1)/2);scene.add(g)}
   // The top rail, with a gap where the slide comes over.
   for(const [z0,z1,,h] of sideWallSections(s)){if(z0===g0)continue;const rail=createDockRail(z0,z1,frameMat);rail.position.set(s*CABINET.halfWidth,s>0&&h===1.3?1.04:1.45,0);scene.add(rail)}}
  const back=new THREE.Mesh(new THREE.BoxGeometry(CABINET.width+.4,2.6,0.4),frameMat);back.position.set(0,1.1,FRONT-CABINET.depth-.2);back.castShadow=true;scene.add(back)
  const scraper=new THREE.Mesh(new THREE.BoxGeometry(CABINET.width-.2,1.0,0.3),frameMat);scraper.position.set(0,1.35,-6.55);scene.add(scraper)
  const tray=new THREE.Mesh(new THREE.BoxGeometry(CABINET.width,0.3,2.6),new THREE.MeshStandardMaterial({color:'#c0d3d9',metalness:.85,roughness:.3}));tray.position.set(0,-2.15,FRONT+1.4);tray.receiveShadow=true;scene.add(tray)
  // Open Sanctuary dock, not the later tall, closed arcade cabinet.
  const trimMat=new THREE.MeshStandardMaterial({color:'#ffd34d',metalness:.9,roughness:.25,emissive:'#7a4a00',emissiveIntensity:.25})
  const solid=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);b.position.set(x,y,z);b.castShadow=b.receiveShadow=true;scene.add(b);return b}
  const water=new THREE.Mesh(new THREE.PlaneGeometry(60,60),toon('#8fd3f0'));water.rotation.x=-Math.PI/2;water.position.y=-3;scene.add(water)
  const pusherMesh=new THREE.Mesh(new THREE.BoxGeometry(PUSHER_SHELF.width,PUSHER_SHELF.height,PUSHER_SHELF.depth),toon('#8fdcc2'));pusherMesh.castShadow=true;pusherMesh.receiveShadow=true;scene.add(pusherMesh);pusherMesh.add(createPusherFacade(PUSHER_SHELF.width,PUSHER_SHELF.height,PUSHER_SHELF.depth))
  // The pin board: a painted backplate, chrome pins, and three glowing pockets.
  const boardBackSlabs=[{name:'pin-board-backplate',bottom:BOARD_BACKSTOP.seam,top:BOARD_BACKSTOP.top,material:new THREE.MeshBasicMaterial({map:boardTexture(),toneMapped:false})},{name:'pin-board-rear-apron',bottom:BOARD_BACKSTOP.bottom,top:BOARD_BACKSTOP.seam,material:frameMat}]
  for(const slab of boardBackSlabs){const mesh=solid(BOARD_BACKSTOP.width,slab.top-slab.bottom,BOARD_BACKSTOP.depth,0,(slab.top+slab.bottom)/2,BOARD_BACKSTOP.z,slab.material);mesh.name=slab.name}
  const boardGlass=new THREE.Mesh(new THREE.BoxGeometry(CABINET.boardWidth,BTOP-BBOTTOM+1.1,0.04),new THREE.MeshPhysicalMaterial({color:'#ffffff',transparent:true,opacity:.05,roughness:.05}));boardGlass.position.set(0,(BTOP+BBOTTOM)/2+0.05,BZ+0.2);scene.add(boardGlass)
  const pinMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06,0.06,0.42,10),new THREE.MeshStandardMaterial({color:'#eef3f8',metalness:1,roughness:.2}),PINS.length)
  PINS.forEach(([x,y],i)=>{const m=new THREE.Matrix4().makeRotationX(Math.PI/2);m.setPosition(x,y,BZ);pinMesh.setMatrixAt(i,m)});scene.add(pinMesh)
  const pocketMeshes=POCKET_W.map((w,i)=>{
   const mat=new THREE.MeshStandardMaterial({color:['#f4a6c1','#ffd34d','#8fdcc2'][i],emissive:['#ad405e','#a36a10','#3f886b'][i],emissiveIntensity:.6,roughness:.4})
   const g=createBoatTarget(w,i,mat,emojiTexture(POCKET_FACE[i]))
   g.position.set(pocketX(i,0),BBOTTOM-0.2,BZ);scene.add(g);return {g,mat,flash:0}})
  // Automatic left-right feeder: medals emerge from its current visible mouth.
  const slotMat=new THREE.MeshStandardMaterial({color:'#ffe6a3',metalness:.8,roughness:.26})
  const {chute,inputGate}=createInputChute(slotMat);scene.add(chute)
  let inputPulse=0,flipperFrame=0
  const aimLine=new THREE.Mesh(new THREE.BoxGeometry(CABINET.boardWidth-.1,.035,.07),new THREE.MeshBasicMaterial({color:'#ffd78a'}));aimLine.position.set(0,BTOP+.7,BZ);scene.add(aimLine)
  // A curved visible paddle travels with the automatic feeder, not a phantom coin.
  const paddle=new THREE.Mesh(new THREE.CapsuleGeometry(.055,.50,4,12),slotMat);paddle.name='sweeping-flipper-paddle';paddle.position.set(0,.36,.22);chute.add(paddle)


  const coins=new THREE.InstancedMesh(new THREE.CylinderGeometry(R,R,HALF*2,40),new THREE.MeshStandardMaterial({color:'#ffd24a',metalness:1,roughness:.32,map:coinFace(),envMapIntensity:1.3}),MAX)
  // These instance matrices travel from the nozzle to the tray. A sphere
  // cached on the seed pile must never cull later falling medals/balls.
  coins.frustumCulled=false;
  coins.castShadow=!small;coins.receiveShadow=true;coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(coins)
  const balls=new THREE.InstancedMesh(new THREE.SphereGeometry(BALL,24,16),new THREE.MeshPhysicalMaterial({color:'#ef5260',roughness:.15,clearcoat:1,emissive:'#7b2535',emissiveIntensity:.8}),16);balls.frustumCulled=false;balls.castShadow=true;scene.add(balls)
  // Software bonus maps live in the dashboard. No billboard roulette or dark
  // scene veil can hide the physical gate, landing zone, or collection tray.
  // ---- The show: marquee bulbs, the lighthouse and its lamps, KONO on the dock, sparkles ----
  const show={party:0}
  // Bulbs round the pin board and along both top rails; they chase, and all flash for a big win.
  const bulbSpots:[number,number,number][]=[]
  for(let x=-CABINET.boardWallX;x<=CABINET.boardWallX+.01;x+=0.42)bulbSpots.push([x,BTOP+0.66,BZ+0.1])
  for(let y=BBOTTOM-0.3;y<=BTOP+0.62;y+=0.42){bulbSpots.push([-CABINET.boardWallX-.14,y,BZ+0.1]);bulbSpots.push([CABINET.boardWallX+.14,y,BZ+0.1])}
  for(let z=-5.4;z<=FRONT-.4;z+=0.55){bulbSpots.push([-CABINET.halfWidth,1.62,z]);bulbSpots.push([CABINET.halfWidth,1.62,z])}
  const bulbs=new THREE.InstancedMesh(new THREE.SphereGeometry(0.075,10,8),new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false}),bulbSpots.length)
  bulbSpots.forEach(([x,y,z],i)=>{bulbs.setMatrixAt(i,new THREE.Matrix4().setPosition(x,y,z));bulbs.setColorAt(i,new THREE.Color(1,1,1))});scene.add(bulbs)
  const BULB=[new THREE.Color(2.4,1.7,0.5),new THREE.Color(2.2,0.7,1.4),new THREE.Color(0.6,1.8,2.4)],dim=new THREE.Color(0.35,0.25,0.12)
  // The Sanctuary lighthouse: its five bands show the same earned BIG BONUS lamps.
  const lighthouse=new THREE.Group();lighthouse.position.set(-5.15,4.5,-6.5);lighthouse.scale.setScalar(.62);scene.add(lighthouse)
  const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.9,0),toon('#b8a99a'));rock.scale.set(.8,.3,.8);lighthouse.add(rock)
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(.3,.46,3,20),toon('#fff',{map:lighthouseStripes()}));tower.position.y=1.8;tower.castShadow=true;lighthouse.add(tower)
  const lampMats=Array.from({length:LAMPS},()=>new THREE.MeshStandardMaterial({color:'#3a3a3a',emissive:'#ffcf3d',emissiveIntensity:0}))
  lampMats.forEach((m,i)=>{const band=new THREE.Mesh(new THREE.TorusGeometry(.45-i*.03,.06,8,24),m);band.rotation.x=Math.PI/2;band.position.y=.6+i*.55;lighthouse.add(band)})
  const beacon=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.42,16),new THREE.MeshStandardMaterial({color:'#fff6d0',emissive:'#ffd36a',emissiveIntensity:1.6,transparent:true,opacity:.9}));beacon.position.y=3.5;lighthouse.add(beacon)
  const roof=new THREE.Mesh(new THREE.ConeGeometry(.44,.45,16),toon('#ff8fa3'));roof.position.y=3.93;lighthouse.add(roof)
  const beam=new THREE.Mesh(new THREE.ConeGeometry(.9,5,24,1,true),new THREE.MeshBasicMaterial({color:'#fff2b0',transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}));beam.geometry.translate(0,-2.5,0);beam.rotation.z=Math.PI/2;beam.position.y=3.5;lighthouse.add(beam)
  // KONO on a dock post on the right, bobbing, and jumping for joy on a big win.
  // KONO's own animations (four frames each): breathing when it's quiet, waving as you drop, cheering on a win.
  const konoAnim=Object.fromEntries(['breathe','wave','cheer'].map(n=>{const t=loader.load('/garden/kono/anim/'+n+'.webp');t.colorSpace=THREE.SRGBColorSpace;t.repeat.set(0.25,1);return [n,t]})) as Record<'breathe'|'wave'|'cheer',THREE.Texture>
  const kono=new THREE.Sprite(new THREE.SpriteMaterial({map:konoAnim.breathe,alphaTest:0.04}));kono.center.set(0.5,0);kono.scale.set(1.25,1.25,1);scene.add(kono)
  // A quiet Sanctuary backdrop: two original trees, no second copy of the
  // garden on the pin board and no foreground decorations hiding the medals.
  const sprite=(name:string,height:number,x:number,y:number,z:number)=>{const m=new THREE.Sprite(new THREE.SpriteMaterial({map:pix(name),alphaTest:.04}));m.center.set(.5,0);m.scale.set(height*(GARDEN_ASPECT[name]??1),height,1);m.position.set(x,y,z);scene.add(m);return m}
  sprite('tree-blossom',4.8,-7.5,-.6,-10.5);sprite('tree-leafy',4.6,7.6,-.6,-10.7)
  sprite('cloud-a',.85,-5,9.1,-18);sprite('cloud-b',.85,5.5,9.5,-19)
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.75,.9,.3,20),toon('#ffe6a8'));pedestal.position.set(5.15,5.25,-6.45);scene.add(pedestal)
  // Sparkles: gold glints, colored bursts and confetti, all in one additive point cloud.
  const SPARKS=120,sPos=new Float32Array(SPARKS*3),sCol=new Float32Array(SPARKS*3),sVel=new Float32Array(SPARKS*3),sLife=new Float32Array(SPARKS)
  const sGeo=new THREE.BufferGeometry();sGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));sGeo.setAttribute('color',new THREE.BufferAttribute(sCol,3))
  const sparks=new THREE.Points(sGeo,new THREE.PointsMaterial({size:0.16,vertexColors:true,map:pix('sparkle'),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));sparks.frustumCulled=false;scene.add(sparks)
  let sNext=0
  const emit=(x:number,y:number,z:number,n:number,palette:THREE.Color[],speed=2)=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const count=Math.min(18,Math.ceil(n*.18));for(let k=0;k<count;k++){const i=sNext++%SPARKS,a=Math.random()*Math.PI*2,u=Math.random()*2-1,r=Math.sqrt(1-u*u),v=speed*(0.4+Math.random()*0.8)
   sPos.set([x,y,z],i*3);sVel.set([Math.cos(a)*r*v,Math.abs(u)*v+speed*0.6,Math.sin(a)*r*v],i*3);const col=palette[k%palette.length];sCol.set([col.r,col.g,col.b],i*3);sLife[i]=0.9+Math.random()*0.8}}
  const GOLD=[new THREE.Color(2.6,1.9,0.5),new THREE.Color(2.2,1.5,0.3)],CONFETTI=[new THREE.Color(2.6,0.6,0.7),new THREE.Color(2.6,2,0.4),new THREE.Color(0.5,1.6,2.8),new THREE.Color(0.7,2.4,1),new THREE.Color(2,0.9,2.6)]
  const POCKET_SPARK=[[new THREE.Color(2.8,0.9,0.6)],[new THREE.Color(2.8,2.2,0.5)],[new THREE.Color(0.6,1.8,2.8)]]
  // The three large HUD wheels own the presentation. Keep their animation
  // controllers, but no redundant miniature wheel meshes over the pegboard.
  const WHEEL_X=[-2.35,0,2.35],WHEEL_Y=BTOP+1.05
  const miniWheels=WHEELS.map(()=>({angle:0,from:0,spinAt:-1,flash:0,seg:-1,end:0}))
  // This is a bank diagram, not a pile waiting to turn into duplicate medals.
  const giant=new THREE.InstancedMesh(new THREE.CylinderGeometry(R*2.1,R*2.1,GSTEP*0.92,32),new THREE.MeshStandardMaterial({color:'#ffd24a',metalness:1,roughness:.3,map:coinFace(),envMapIntensity:1.4,emissive:'#4a3000',emissiveIntensity:.25}),15);giant.castShadow=true;giant.name='bounded-reserve-diagram';giant.visible=false;scene.add(giant)
  const LAYER_TINT=[new THREE.Color(1,1,1),new THREE.Color(1,0.74,0.7),new THREE.Color(0.86,1,0.86),new THREE.Color(0.9,0.86,1)]
  const giantBase=new THREE.Mesh(new THREE.BoxGeometry(4.5,.16,1.5),new THREE.MeshStandardMaterial({color:'#6eacc2',roughness:.6}));giantBase.position.set(0,RESERVE_DISPLAY.baseY-.16,RESERVE_DISPLAY.baseZ);giantBase.visible=false;scene.add(giantBase)
  // Every texture sharp at an angle (the field, the coins, the wheels).
  scene.traverse(o=>{const mat=(o as THREE.Mesh).material as THREE.Material|THREE.Material[]|undefined;(Array.isArray(mat)?mat:mat?[mat]:[]).forEach(m=>{const t=(m as THREE.MeshStandardMaterial).map;if(t&&t.magFilter!==THREE.NearestFilter)t.anisotropy=aniso})})
  // ---- The physics world ----
  // Fixed horizontal bed. No concealed conveyor force or spinning plate under the pile.
  const world=new RAPIER.World(FIELD_MOTION.gravity)
  world.timestep=FIELD_MOTION.timestep
  world.integrationParameters.numSolverIterations=FIELD_MOTION.solverIterations
  const fixed=(hx:number,hy:number,hz:number,x:number,y:number,z:number,friction=0.5)=>world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setTranslation(x,y,z).setFriction(friction).setFrictionCombineRule(friction<.1?RAPIER.CoefficientCombineRule.Min:RAPIER.CoefficientCombineRule.Average))
  fixed(CABINET.halfWidth,0.2,CABINET.depth/2,0,-0.2,FRONT-CABINET.depth/2,FIELD_MOTION.deckFriction)            // the deck, ending at the front edge
  // Side walls, open near the front (the side drops), with a gap at the top where each slide comes over.
  for(const side of [-1,1])for(const [z0,z1,y,h] of sideWallSections(side))fixed(.1,h/2,(z1-z0)/2,side*CABINET.wallX,y,(z0+z1)/2)
  // The two side slides: troughs from up beside the pin board down onto the pusher's shelf (rails each side,
  // a stop at the top). Prize medals slide down them and balls roll; see the release in the loop.
  let dispensers=[createDispenser(13),createDispenser(13)]
  const rampGlow=[0,0],gates:THREE.Mesh[]=[]
  let physicsFrame=0,collectionFrame=0,ballWaiting=0,ballLast=-99
  const inputQueue:number[]=[]
  const rampMat=toon('#ffd7e6'),railMat=new THREE.MeshStandardMaterial({color:'#ffe08a',metalness:.85,roughness:.25,emissive:'#ffb000',emissiveIntensity:.15})
  const mouths:THREE.MeshStandardMaterial[]=[]
  RAMPS.forEach(r=>{const s=r.s,tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),s*r.angle),rot={x:tilt.x,y:tilt.y,z:tilt.z,w:tilt.w}
   const mid=new THREE.Vector3((r.top.x+r.bot.x)/2,(r.top.y+r.bot.y)/2,RAMP_Z),n=new THREE.Vector3(-s*Math.sin(r.angle),Math.cos(r.angle),0)
   const part=(hx:number,hy:number,hz:number,off:THREE.Vector3,mat:THREE.Material,friction:number)=>{const at=mid.clone().add(off)
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz).setTranslation(at.x,at.y,at.z).setRotation(rot).setFriction(friction).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(0.05))
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(hx*2,hy*2,hz*2),mat);mesh.position.copy(at);mesh.quaternion.copy(tilt);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh)}
   part(r.len/2,0.04,RAMP_HALF,n.clone().multiplyScalar(-0.04),rampMat,0.08)                                       // the slide
   part(r.len/2,0.16,0.03,new THREE.Vector3(0,0,-(RAMP_HALF-0.03)).add(n.clone().multiplyScalar(0.12)),railMat,0.02) // back rail
   part(r.len/2,0.16,0.03,new THREE.Vector3(0,0,RAMP_HALF-0.03).add(n.clone().multiplyScalar(0.12)),railMat,0.02)    // front rail
   // The stop at the outer top, a post holding it up out of the sea, and the glowing mouth the medals come out of.
   world.createCollider(RAPIER.ColliderDesc.cuboid(0.04,0.3,RAMP_HALF).setTranslation(r.top.x+s*0.05,r.top.y+0.25,RAMP_Z))
   const post=createSanctuaryPost(r.top.y+2.6,railMat);post.position.set(r.top.x-s*0.1,-2.6,RAMP_Z);scene.add(post)
   const mouthMat=new THREE.MeshStandardMaterial({color:'#fff3c0',emissive:'#ffcf3d',emissiveIntensity:.4,metalness:.3,roughness:.4});mouths.push(mouthMat)
   const mouth=createRampMouth(rampMat,mouthMat,s);mouth.position.set(r.top.x+s*.14,r.top.y+.26,RAMP_Z);scene.add(mouth)
   const gate=new THREE.Mesh(new THREE.BoxGeometry(.055,.2,.91),mouthMat);gate.position.set(r.top.x-s*.31,r.top.y+.15,RAMP_Z);scene.add(gate);gates.push(gate)})
  fixed(CABINET.halfWidth,1.5,0.2,0,1.1,FRONT-CABINET.depth-.2)                   // back wall
  fixed(CABINET.width/2-.2,0.5,0.15,0,1.36,-6.55)                // the scraper above the pusher's shelf
  const trayFloor=fixed(CABINET.halfWidth,.15,1.3,0,-2.15,FRONT+1.4,.9) // the actual catcher contact, not a height guess
  for(let x=-CABINET.halfWidth+.4;x<=CABINET.halfWidth-.4;x+=.48)solid(.06,.025,2.25,x,-1.98,FRONT+1.4,new THREE.MeshStandardMaterial({color:'#956e91',metalness:.6,roughness:.4}))
  const trayCatchers=[trayFloor,fixed(.1,.6,1.3,-CABINET.halfWidth,-1.6,FRONT+1.4),fixed(.1,.6,1.3,CABINET.halfWidth,-1.6,FRONT+1.4),fixed(CABINET.halfWidth,.6,.1,0,-1.6,FRONT+2.7)]
  addSanctuaryCabinetTrim(scene,{halfWidth:CABINET.halfWidth,frameMat,woodMat:deckMat,goldMat:trimMat})
  // ---- The gadgets ----
  // The ball run: a gold track zig-zagging down beside the pin board; a prize ball rolls down it (drawn
  // along the track), then onto the left slide as a real ball.
  const runCurve=new THREE.CurvePath<THREE.Vector3>();for(let i=1;i<RUN.length;i++)runCurve.add(new THREE.LineCurve3(new THREE.Vector3(...RUN[i-1]).add(new THREE.Vector3(0,-BALL-0.04,0)),new THREE.Vector3(...RUN[i]).add(new THREE.Vector3(0,-BALL-0.04,0))))
  const runMat=new THREE.MeshStandardMaterial({color:'#ffe08a',metalness:.9,roughness:.22,emissive:'#ffb000',emissiveIntensity:.15})
  for(const dz of [-0.17,0.17]){const tube=new THREE.Mesh(new THREE.TubeGeometry(runCurve,120,0.035,8,false),runMat);tube.position.z=dz;tube.castShadow=true;scene.add(tube)}
  RUN.forEach(([x,y,z],i)=>{if(i===0||i===RUN.length-1)return;const post=new THREE.Mesh(new THREE.SphereGeometry(0.09,12,8),runMat);post.position.set(x,y-BALL-0.04,z);scene.add(post)})
  const runBalls=Array.from({length:4},()=>{const m=new THREE.Mesh(new THREE.SphereGeometry(BALL,24,16),new THREE.MeshPhysicalMaterial({color:'#ef5260',roughness:.15,clearcoat:1,emissive:'#7b2535',emissiveIntensity:.8}));m.visible=false;m.castShadow=true;scene.add(m);return m})
  const ballRuns:{t:number;seg:number}[]=[]
  // Opaque ball magazine covers the beginning of the rail; one ball exits its gate at a time.
  const ballMagazine=createBallMagazine(toon('#b39aef'),runMat);ballMagazine.position.set(RUN[0][0]+.06,RUN[0][1]+.3,RAMP_Z-.1);scene.add(ballMagazine)
  const ballGate=solid(.11,.55,.92,RUN[0][0]-.38,RUN[0][1],RAMP_Z,runMat)
  // Both real side slides now discharge directly onto the raised shelf.
  // The old right seesaw occupied the reference builder's return corridor;
  // its mesh, colliders and motor are removed together, not made invisible.
  // KONO's bucket, beside KONO: a medal goes in for every pocket hit; full, KONO throws them onto the field.
  const bucket=new THREE.Group();scene.add(bucket)
  const pail=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.22,0.36,20,1,true),new THREE.MeshStandardMaterial({color:'#7fd0ff',metalness:.4,roughness:.35,side:THREE.DoubleSide}));bucket.add(pail)
  const pailBottom=new THREE.Mesh(new THREE.CircleGeometry(0.22,20),pail.material);pailBottom.rotation.x=-Math.PI/2;pailBottom.position.y=-0.17;bucket.add(pailBottom)
  const handle=new THREE.Mesh(new THREE.TorusGeometry(0.3,0.02,6,20,Math.PI),new THREE.MeshStandardMaterial({color:'#c9d6e3',metalness:.9,roughness:.2}));handle.position.y=0.18;bucket.add(handle)
  const bucketCoins=new THREE.InstancedMesh(new THREE.CylinderGeometry(R*0.6,R*0.6,HALF*1.6,24),coinsMaterial(),BUCKET_FULL);bucket.add(bucketCoins);bucketCoins.count=0
  const pail2={n:0,toss:-1}
  // Matching solid painted back/apron prevent loose shelf medals going behind
  // the board. The decorative front glass stays non-solid so the normal bottom
  // handoff remains open; edge-on board medals retain their existing z lock.
  for(const slab of boardBackSlabs)fixed(BOARD_BACKSTOP.width/2,(slab.top-slab.bottom)/2,BOARD_BACKSTOP.depth/2,0,(slab.top+slab.bottom)/2,BOARD_BACKSTOP.z)
  // The pin board: pins (cylinders across the board) and its side walls.
  const across=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)
  const feedbackPins=new Map<number,{x:number;y:number;z:number}>()
  for(const [x,y] of PINS){const pin=world.createCollider(RAPIER.ColliderDesc.cylinder(0.21,0.06).setTranslation(x,y,BZ).setRotation({x:across.x,y:across.y,z:across.z,w:across.w}).setRestitution(0.35).setFriction(0.02).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min));feedbackPins.set(pin.handle,{x,y,z:BZ})}
  fixed(0.1,(BTOP-BBOTTOM)/2+0.4,0.3,-CABINET.boardWallX,(BTOP+BBOTTOM)/2,BZ);fixed(0.1,(BTOP-BBOTTOM)/2+0.4,0.3,CABINET.boardWallX,(BTOP+BBOTTOM)/2,BZ)
  const pusherBody=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,PUSHER_SHELF.height/2,shelfCenter(FIELD.back)))
  world.createCollider(RAPIER.ColliderDesc.cuboid(PUSHER_SHELF.width/2,PUSHER_SHELF.height/2,PUSHER_SHELF.depth/2).setFriction(FIELD_MOTION.shelfFriction),pusherBody)
  const pieces=new Map<number,Piece>()
  let rewardDelivered=0,rewardCollected=0,rewardLost=0
  const addCoin=(x:number,y:number,z:number,ball=false,spin=0,board=false,resting=false,reward=false)=>{
   // Capacity is checked before every emission. Never delete a live/earned coin to make room.
   const motion=ball?BALL_MOTION:COIN_MOTION
   // On the board a medal stands on its edge, facing you, and only moves across and down (and spins).
   const q=board?across.clone():resting?new THREE.Quaternion():new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random()-.5)*0.2,Math.random()*6,(Math.random()-.5)*0.2))
   const desc=RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,z).setRotation({x:q.x,y:q.y,z:q.z,w:q.w}).setLinearDamping(board?0.05:motion.linearDamping).setAngularDamping(motion.angularDamping).setCcdEnabled(true).setAngvel(board?{x:0,y:0,z:spin}:{x:0,y:spin,z:0})
   if(board)desc.enabledTranslations(true,true,false).enabledRotations(false,false,true)
   const body=world.createRigidBody(desc)
   world.createCollider((ball?RAPIER.ColliderDesc.ball(BALL).setDensity(0.6):RAPIER.ColliderDesc.cylinder(HALF,R).setDensity(1.4)).setFriction(motion.friction).setRestitution(motion.restitution),body)
   pieces.set(body.handle,{body,ball,counted:0,board,born:physicsFrame,reward});if(reward&&!ball)rewardDelivered++;return body}
  const room=()=>{let n=0;for(const p of pieces.values())if(!p.ball)n++;return MAX-n}
  const ballRoom=()=>{let n=0;for(const p of pieces.values())if(p.ball)n++;return 16-n}
  const clearAt=(x:number,y:number,z:number,r=.68)=>{for(const p of pieces.values()){if(p.counted)continue;const at=p.body.translation();if(Math.hypot(at.x-x,at.y-y,at.z-z)<r)return false}return true}
  // Starting field stock is close-packed but non-overlapping, not an award.
  // It settles under gravity; only the real shelf/dropped bodies drive it later.
  for(const at of fieldStock(R,shelfFront(FIELD.reach),FRONT))addCoin(at.x,at.y,at.z,false,0,false,true)
  pusherBody.setNextKinematicTranslation({x:0,y:PUSHER_SHELF.height/2,z:shelfCenter(FIELD.back)})
  for(let i=0;i<180;i++)world.step()
  // Real starting supply, separate from earned rail balls. Place above the
  // settled pile with conservative rotated-cylinder clearance; no impulses,
  // wallet credit, Practice award or pre-completed ball challenge.
  const startingBallSites=[[-3.15,1.3],[-3.15,.35],[-3.15,-.6],[-2.5,-1.5],[-1.55,-1.5],[-.6,-1.4]]
  let startingBalls=0
  for(const [x,z] of startingBallSites){
   let y=BALL+.025
   for(const p of pieces.values()){
    const at=p.body.translation();if(Math.hypot(at.x-x,at.z-z)>BALL+(p.ball?BALL:R))continue
    const q=p.body.rotation(),upY=1-2*(q.x*q.x+q.z*q.z)
    const extent=p.ball?BALL:HALF*Math.abs(upY)+R*Math.sqrt(Math.max(0,1-upY*upY))
    y=Math.max(y,at.y+extent+BALL+.025)
   }
   let blocked=false
   world.forEachCollider(collider=>{if(collider.contactShape(new RAPIER.Ball(BALL),{x,y,z},{x:0,y:0,z:0,w:1},.005))blocked=true})
   if(blocked||ballRoom()<=0)continue
   addCoin(x,y,z,true,0,false,true);startingBalls++
  }
  cove.current=recordStartingBalls(cove.current,startingBalls)

  // One scene and one camera. Presets auto-fit; a custom view never re-fits.
  const orbit={yaw:VIEWS[0].yaw as number,pitch:VIEWS[0].pitch as number}
  // The diagram's bounded hull is constant, even when the bank grows.
  const cameraBounds:readonly FramePoint[]=RESERVE_BOUNDS
  let lastPose:CameraPose={target:[0,3,0],distance:30,yaw:0,pitch:0,zoom:1,fov:42}
  cameraSnapshot.current=()=>({...lastPose,target:[...lastPose.target]})
  const placeCamera=()=>{
   const custom=cameraPoseRef.current,v=VIEWS[viewRef.current],preview=routePreviewRef.current
   if(!custom&&!preview){orbit.yaw+=(v.yaw-orbit.yaw)*.12;orbit.pitch+=(v.pitch-orbit.pitch)*.12}
   // Actual DOM toolbar rows are excluded, including phone wrapping. The
   // fallback is used only before layout and by the CPU-only test harness.
   const toolbar=el.querySelector?.<HTMLElement>('.cove-view-toolbar'),hint=el.querySelector?.<HTMLElement>('.cove-play-hint')
   const framePadding=!custom&&viewRef.current===TIERED_VIEW_INDEX?6:14
   const insets={top:((toolbar?.offsetHeight??44)+framePadding)/Math.max(1,el.clientHeight),bottom:((hint?.offsetHeight??28)+framePadding)/Math.max(1,el.clientHeight),side:.04}
   const route=preview?fitWholeRouteFrame(camera.aspect,insets):!custom&&viewRef.current===TIERED_VIEW_INDEX?fitTieredFrame(camera.aspect,insets):null
   const fov=route?.fov??custom?.fov??(camera.aspect<.8?49:42),zoom=route?.zoom??custom?.zoom??1
   if(camera.fov!==fov||camera.zoom!==zoom){camera.fov=fov;camera.zoom=zoom;camera.updateProjectionMatrix()}
   const fit=route??(custom?cameraPoseFrame(custom):fitMachineFrame(frameBoundsForView(viewRef.current,cameraBounds),camera.aspect,camera.fov,orbit.yaw,orbit.pitch,FRONT_EYE_HEIGHT))
   if(!custom&&!preview)lastPose={target:fit.target,distance:fit.distance,yaw:route?.yaw??orbit.yaw,pitch:route?.pitch??orbit.pitch,zoom:1,fov:camera.fov}
   camera.position.set(...fit.position);camera.lookAt(...fit.target);camera.updateMatrixWorld()
   if(camera.far!==fit.far){camera.far=fit.far;camera.updateProjectionMatrix()}
   const fog=scene.fog as THREE.Fog;fog.near=fit.fogNear;fog.far=fit.fogNear+32}
  const resize=()=>{const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);renderer.setSize(w,h,false);composer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();placeCamera()}
  resize();const ro=new ResizeObserver(resize);ro.observe(el)
  // Big words that pop up where things happen ("IN!", a wheel's prize, COMBO, TIMBER!), and a buzz.
  const proj=new THREE.Vector3()
  const pop=(text:string,x:number,y:number,z:number,kind='')=>{proj.set(x,y,z).project(camera);const id=++popId.current
   setPops(ps=>[...ps.slice(-6),{id,text,x:(proj.x+1)/2*100,y:(1-proj.y)/2*100,kind}]);window.setTimeout(()=>setPops(ps=>ps.filter(p=>p.id!==id)),kind==='big'?2200:1300)}
  const buzz=(pattern:number|number[])=>{try{navigator.vibrate?.(pattern)}catch{/* no vibration here */}}
  // The BIG BONUS presentation never changes the fixed physical timestep.
  const slow=1 // all machinery and contacts share a fixed physical clock
  // Real side workshop: ordinary medals build on a supported split carriage,
  // slide left-to-center and become dynamic only at the stopped field dock.
  const rewardRoute=createRewardRoute()
  let towerRelease=0,towerReleaseFrame=-1,lastMusicTower:number|null=null,lastMusicDraw:string|null=null
  const towerMachine=createTowerMachine(world,{
   room,initialStock:128,
   // An admitted tower owns this route until its empty carriage is home. A
   // newly selected Tide waits; an already-active Tide finishes before admission.
   clear:()=>rewardRoute.owner==='tower',
   createCoin:(at,request)=>{const body=addCoin(at.x,at.y,at.z,false,0,false,true);const piece=pieces.get(body.handle)!;piece.reward=request.source!=='stock';piece.towerHeld=true;return body},
   onRelease:(body,request)=>{if(towerReleaseFrame!==physicsFrame){towerReleaseFrame=physicsFrame;reveals.emit({kind:'tower',phase:'release',magnitude:request.total,at:{x:TOWER.dockX,y:TOWER.releaseTop,z:TOWER.z}})}pieces.get(body.handle)!.towerHeld=false;if(request.source!=='stock')rewardDelivered++;if(request.source==='bank')towerRelease++},
  })
  const tideCollections=new Map<number,number>()
  const tideMachine=createTideMachine(world,{
   yieldRequested:()=>towerMachine.status().pending>0,routeAvailable:()=>rewardRoute.owner==='tide',
   room,
   clear:lane=>rewardRoute.owner==='tide'&&towerMachine.status().stage==='idle'&&!tideLoadBlocked(world,lane,body=>{const p=pieces.get(body.handle);return !!p&&!p.tideHeld&&!p.counted}),
   createCoin:at=>{const body=addCoin(at.x,at.y,at.z,false,0,false,true);const piece=pieces.get(body.handle)!;piece.reward=true;piece.tideHeld=true;return body},
   onRelease:(body,request)=>{if(request.released===1)reveals.emit({kind:'tide',phase:'release',at:body.translation()});const p=pieces.get(body.handle)!;p.tideHeld=false;p.tideId=request.id;rewardDelivered++},
   onComplete:request=>{setTideSummary({total:request.total,lane:request.lane!,practice:request.practice,collected:tideCollections.get(request.id)??0});fx('ding',soundRef.current)},
  })
  tideChoice.current=(id,lane)=>{const accepted=tideMachine.chooseLane(id,lane);if(accepted){setTide(tideMachine.status());fx('tick',soundRef.current)}return accepted}
  // Tide is a paced shower of real medals, not an overhead reservoir.
  // Soft light marks the selected entry only while delivering; no slab,
  // transparent guard or invisible solid remains above the playfield.
  const tideLights=(Object.entries(TIDE.lanes) as [TideLane,number][]).map(([lane,x])=>{
   const material=new THREE.MeshBasicMaterial({color:'#f5dba0',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide})
   const mesh=new THREE.Mesh(new THREE.RingGeometry(.36,.41,32),material)
   mesh.rotation.x=-Math.PI/2;mesh.position.set(x,TIDE.top+.12,tideLaneZ(lane));mesh.name='tide-'+lane+'-entry-light';mesh.visible=false;scene.add(mesh)
   return {lane,mesh,material}
  })
  // Transparent rear shaft: exact static triangle colliders match every visible
  // surface. Front/transfer side stay open; no roof masks real construction.
  const workshop=createReferenceBuildBay(TOWER.x,TOWER.z,TOWER.leafHalfDepth);scene.add(workshop);workshop.updateMatrixWorld(true)
  workshop.traverse(object=>{if(!(object instanceof THREE.Mesh))return
   const geo=object.geometry as THREE.BufferGeometry,vertices=new Float32Array(geo.attributes.position.array),indices=geo.index?new Uint32Array(geo.index.array):Uint32Array.from({length:geo.attributes.position.count},(_,i)=>i)
   const at=object.getWorldPosition(new THREE.Vector3())
   const shape=object.userData.collider==='convexHull'?RAPIER.ColliderDesc.convexHull(vertices):RAPIER.ColliderDesc.trimesh(vertices,indices)
   if(!shape)throw new Error('Reference cabinet hull is invalid')
   world.createCollider(shape.setTranslation(at.x,at.y,at.z).setFriction(object.userData.friction??.4))
  })
  const cradleLeaves=[-1,1].map(()=>solid(TOWER.leafHalfWidth*2,TOWER.leafHalfHeight*2,TOWER.leafHalfDepth*2,0,TOWER.buildTop,TOWER.z,toon('#8fdcc2')))
  const buildHead=createTowerHead(trimMat);scene.add(buildHead)
  const headMouth=new THREE.Group();headMouth.name='open-tower-bore';scene.add(headMouth)
  // Decorative structure is behind/outside the pegboard, never a central
  // gold frame over falling medals. Actual cradle leaves remain visible.
  for(const x of [-CABINET.halfWidth-.15,CABINET.halfWidth+.15]){const post=solid(.07,4.95,.07,x,3.0,-6.6,trimMat);post.name='rear-gantry-post'}
  const gantryBeam=solid(CABINET.width+.3,.10,.12,0,5.5,-6.6,trimMat);gantryBeam.name='rear-gantry-beam'
  // A jackpot win displays its fixed award; delivery accounting is independent.
  let jpAt=-1,jpAmount=0
  // Medals into the tray, added up over a moment and shown as "+n" by your medals; the BIG BONUS banner's count.
  let winAcc=0,winAt=0,bbAt=-1,bbAmount=0
  const wheelSeg=[-1,-1,-1]
  // ---- Touch ----
  // Field touches no longer aim. Dragging is reserved for explicit camera editing.
  const cameraGesture=createCameraGesture(()=>cameraPoseRef.current,updateCamera,()=>cameraDragRef.current,()=>el.clientHeight)
  const down=(e:PointerEvent)=>{if(e.button!==0||blockedRef.current||!lookRef.current)return;e.preventDefault();if(cameraGesture.down(e.pointerId,e.clientX,e.clientY))renderer.domElement.setPointerCapture?.(e.pointerId)}
  const move=(e:PointerEvent)=>{if(blockedRef.current||!lookRef.current)return;e.preventDefault();cameraGesture.move(e.pointerId,e.clientX,e.clientY)}
  const up=(e?:PointerEvent)=>{if(e)cameraGesture.up(e.pointerId);else cameraGesture.cancel()}
  const cancel=()=>up()
  const zoomWheel=(e:WheelEvent)=>{if(!lookRef.current||blockedRef.current||!cameraPoseRef.current)return;e.preventDefault();adjustCamera({zoom:cameraPoseRef.current.zoom*Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.003)})}
  const blur=()=>{up();stopFeed()};gestureStop.current=()=>up()
  const hidden=()=>{if(document.hidden)blur()}
  renderer.domElement.style.touchAction='none'
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',cancel);renderer.domElement.addEventListener('lostpointercapture',up);renderer.domElement.addEventListener('wheel',zoomWheel,{passive:false})
  const key=(e:KeyboardEvent)=>{
   if(lookRef.current&&!blockedRef.current&&e.code==='Escape'){e.preventDefault();lockCamera();return}
   if(blockedRef.current||lookRef.current||document.querySelector('dialog[open], [aria-modal="true"]')||(e.target as HTMLElement)?.matches('input,button,summary,textarea,select,[contenteditable="true"]'))return
   if(e.code==='Space'){e.preventDefault();if(!e.repeat)beginFeed('keyboard')}
  }
  window.addEventListener('keydown',key);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden)
  ready.current=true;setHud(h=>({...h,ready:true}))
  // ---- The loop: the rules and the physics at a steady 60 steps a second ----
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),v3=new THREE.Vector3(),s3=new THREE.Vector3(1,1,1)
  command.current=kind=>{
   const c=cove.current,result=practiceCommand(practiceState.current,c,kind,performance.now(),{ready:ready.current&&!blockedRef.current&&!lookRef.current&&!document.hidden,ended:ended.current,towerBusy:towerMachine.status().stage!=='idle'||towerMachine.status().pending>0,pending:dispensers[0].queued+dispensers[1].queued+towerMachine.status().pending+tideMachine.status().pending+(c.tides??[]).reduce((n,t)=>n+t.n,0)+ballWaiting,balls:ballWaiting+ballRuns.length+16-ballRoom()})
   setPracticeMessage(result.message)
   if(!result.accepted)return
   stopFeed();practiceState.current=result.state;setPracticeUsed(true);cove.current=result.cove
   if(kind==='clear')clearRequest.current?.()
   practiceState.current={...result.state,enabled:false};setPractice(false);practiceDialog.current?.close();pauseDetails(false)
   if(result.coins){dispensers[0]=enqueueDispense(dispensers[0],result.coins);cove.current=awardField(cove.current,result.coins)}
   ballWaiting+=result.balls;fx('tick',soundRef.current)
  }
  // Board Clear is a visible magnetic bonus, not a change to normal deck physics.
  // Pause on a completed simulation boundary: pending mechanisms keep their exact
  // FIFO/age/pose. Balls and unhanded supply are clamped here, then restored.
  const clearProtected=new Map<number,{type:RAPIER.RigidBodyType;linear:ReturnType<RAPIER.RigidBody['linvel']>;angular:ReturnType<RAPIER.RigidBody['angvel']>}>()
  let clearActive=false,clearSeeded=0,clearStartedAt=0
  const boardClearMachine=createBoardClearMachine(world,{trayHalfWidth:TRAY.halfWidth,piece:id=>pieces.get(id)})
  const syncClear=()=>{const state=boardClearMachine.status(),c=cove.current;setClearView({tokens:c.boardClears??0,active:!!c.boardClearBusy,phase:state.stage,total:state.total,collected:state.collected,remaining:state.remaining,practice:!!c.boardClearPractice})}
  clearRequest.current=()=>{stopFeed();syncClear()}
  const beginBoardClear=()=>{
   clearActive=true;clearSeeded=0;clearStartedAt=collectionFrame;stopFeed()
   const ids:number[]=[]
   for(const [id,p] of pieces){
    if(p.ball||p.towerHeld||p.tideHeld||p.capturedPocket!==undefined){
     clearProtected.set(id,{type:p.body.bodyType(),linear:{...p.body.linvel()},angular:{...p.body.angvel()}})
     if(p.body.isDynamic())p.body.setBodyType(RAPIER.RigidBodyType.Fixed,true)
    }else if(!p.counted){
     // A not-yet-captured player input joins this special collection instead of
     // earning a pin-board pocket. Its original body/provenance is retained.
     p.board=false;p.body.setEnabledTranslations(true,true,true,true);p.body.setEnabledRotations(true,true,true,true);ids.push(id)
    }
   }
   boardClearMachine.begin(ids)
   pop('MAGNETIC BOARD CLEAR',0,2,1,'big');fx('fanfare',soundRef.current);syncClear()
  }
  const finishBoardClear=()=>{
   // Every target has already contacted the real tray, rested and returned
   // through its visible grate. Only then can fresh, non-award stock appear.
   if(!clearActive)return
   const fresh=fieldStock(R,shelfFront(FIELD.reach),FRONT,Math.random,true,pusherBody.translation().z)
   const occupiedAt=(at:{x:number;y:number;z:number})=>{
    let occupied=false
    world.intersectionsWithShape(at,{x:0,y:0,z:0,w:1},new RAPIER.Cylinder(HALF,R),collider=>{const body=collider.parent();if(body&&pieces.has(body.handle)){occupied=true;return false}return true})
    return occupied
   }
   // A ring is an indivisible starting formation: never seed a partial,
   // unsupported column through a preserved ball or held supply. Its rear
   // position follows the ACTUAL paused upper shelf, not a timer guess.
   for(const formation of [0,1]){
    const ring=fresh.filter(at=>at.formation===formation)
    if(room()<ring.length||ring.some(occupiedAt))continue
    for(const at of ring){addCoin(at.x,at.y,at.z,false,0,false,true);clearSeeded++}
   }
   for(const at of fresh.filter(at=>at.formation===undefined)){
    if(room()<1)break
    const shelfCoin=at.y>PUSHER_SHELF.height
    if(occupiedAt(at)||(!shelfCoin&&at.z-R<pusherBody.translation().z+PUSHER_SHELF.depth/2))continue
    addCoin(at.x,at.y,at.z,false,0,false,true);clearSeeded++
   }
   for(const [id,saved] of clearProtected){const p=pieces.get(id);if(!p)throw new Error('Board Clear lost protected supply');if(p.counted)p.counted+=collectionFrame-clearStartedAt;p.body.setBodyType(saved.type,true);p.body.setLinvel(saved.linear,true);p.body.setAngvel(saved.angular,true)}
   reveals.emit({kind:'clear',phase:'complete'});clearProtected.clear();clearActive=false;cove.current={...cove.current,boardClearBusy:false};syncClear();fx('mega',soundRef.current)
  }
  const collectPieces=(c:Cove,clearing=false)=>{
   let won=0,lost=0,ballsWon=0
    for(const [h,p] of pieces){if(clearing&&clearProtected.has(h))continue;const t=p.body.translation()
     if(p.ramp&&t.y<.8)p.ramp=undefined
     if(!p.counted&&!p.towerHeld&&!p.tideHeld){let touchingTray=false
      if(t.y<-.4)for(const catcher of trayCatchers){const contact=catcher.contactCollider(p.body.collider(0),.012);if(contact&&contact.distance<=.012&&contact.normal1.y>.4){touchingTray=true;break}}
      const candidate=capturePiece(t,p.ball,touchingTray),caught=clearing&&boardClearMachine.isTarget(h)&&candidate==='lost'?null:candidate;if(caught){p.counted=Math.max(1,collectionFrame);if(caught==='medal')won++;else if(caught==='ball')ballsWon++;else lost++;if(p.reward&&!p.ball){if(caught==='medal'){rewardCollected++;if(p.tideId!==undefined)tideCollections.set(p.tideId,(tideCollections.get(p.tideId)??0)+1)}else if(caught==='lost')rewardLost++}if(caught==='medal')machineFeedback.cue('collect',{x:t.x,y:t.y,z:t.z},{key:h});if(caught==='ball')reveals.emit({kind:'ball',phase:'capture',at:{x:t.x,y:t.y,z:t.z}});if(caught==='ball')pop('🔮 CAPTURED · +1 challenge',t.x,0.3,Math.min(t.z,7.4),'prize1');if(caught!=='lost')emit(t.x,t.y+.1,t.z,3,GOLD,.6)}}
     // Tray floor is a visible return grate: collected pieces sink through it after resting, never vanish in midair.
     if(p.counted&&collectionFrame-p.counted>90){p.body.setEnabled(false);p.body.setTranslation({x:t.x,y:t.y-.045,z:t.z},false)}
     if(p.counted&&t.y<-2.7){world.removeRigidBody(p.body);pieces.delete(h)}}
   if(won){fx('coinTray',soundRef.current);winAcc+=won;winAt=performance.now()}
   return settle(c,won,lost,ballsWon)
  }
  // Holographic rings identify the magnetic force on the SAME dynamic medals.
  // They are effect graphics, not invisible replacement collision geometry.
  const clearHalo=new THREE.InstancedMesh(new THREE.TorusGeometry(.39,.025,6,20),new THREE.MeshBasicMaterial({color:'#56dfdc',transparent:true,opacity:.85,depthWrite:false}),MAX)
  clearHalo.name='board-clear-magnetic-halos';clearHalo.frustumCulled=false;clearHalo.count=0;scene.add(clearHalo)
  let raf=0,last=performance.now(),acc=0,lastHud=0
  const loop=(now:number)=>{
   // Pausing preserves selected outcomes and all delivery bodies/queues. No hidden
   // bonus resolution or catch-up burst when returning from a tab or options.
   if(document.hidden||blockedRef.current||detailsPauseRef.current||ended.current){last=now;acc=0;raf=requestAnimationFrame(tick);return}
   acc=boundedAccumulator(acc,now-last);last=now
   if(lookRef.current&&cove.current.boardClearBusy)acc=0 // camera edit pauses this special collection, but still redraws the camera
   let steps=0
   const workStarted=performance.now()
   while(mayStep(acc,steps,performance.now()-workStarted)){steps++
    const before=cove.current
    if(before.boardClearBusy){
     if(!clearActive)beginBoardClear()
     collectionFrame+=slow
     boardClearMachine.update()
     updateRearContactAccuracy(world,pieces.values(),R)
     world.step()
     cove.current=collectPieces(before,true)
     if(boardClearMachine.status().stage==='complete')finishBoardClear()
     acc-=PHYSICS_STEP_MS
     continue
    }
    if(!lookRef.current)flipperFrame++
    const flipper=flipperPose(flipperFrame,CABINET.aimHalfWidth);aim.current=flipper.aim
    let c=step(before)
    if(feed.current.tick(now,ready.current&&!ended.current&&!blockedRef.current&&!lookRef.current&&!document.hidden&&c.hand>0,canAcceptInput(c))){c=drop(c,aim.current);lastDrop.current=now;fx('tick',soundRef.current)}
    // Put what the rules dropped into the machine: medals fall from the chute, showers rain over the field.
    // A drop goes in at the top of the pin board; every prize medal and ball queues for a side slide.
    // Queue tokens represent paid medals, not old aiming coordinates. Release samples the live flipper.
    for(const m of c.medals){if(m.y<0)inputQueue.push(1)
     else if(m.ball)ballWaiting++
     else{const side=dispensers[0].queued<dispensers[1].queued?0:dispensers[1].queued<dispensers[0].queued?1:m.x<50?0:1;dispensers[side]=enqueueDispense(dispensers[side],1)}}
    if(inputQueue.length&&!lookRef.current&&room()>0&&inputPulse<.2){const x=flipper.x;if(clearAt(x,BTOP+.3,BZ,.63)){inputQueue.shift();addCoin(x,BTOP+.3,BZ,false,0,true);machineFeedback.cue('launch',{x,y:BTOP+.3,z:BZ});fx('coinDrop',soundRef.current);inputPulse=1}}
    inputQueued.current=inputQueue.length
    // Physical-time metering + mouth clearance prevent overlap even during slow-motion celebrations.
    physicsFrame+=slow;collectionFrame+=slow;if(!lookRef.current)inputPulse=Math.max(0,inputPulse-slow*.09)
    for(const side of [0,1]){const r=RAMPS[side],x=r.s*(RAMP_OUT-.28),y=r.at(x)+.16
     const result=releaseDispense(dispensers[side],physicsFrame,room()>0&&clearAt(x,y,RAMP_Z)?1:0);dispensers[side]=result.state
     if(!result.released)continue
     rampGlow[side]=1;const body=addCoin(x,y,RAMP_Z,false,0,false,false,true)
     const tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),r.s*r.angle)
     body.setRotation({x:tilt.x,y:tilt.y,z:tilt.z,w:tilt.w},true)
     body.setLinvel({x:r.dir.x*2.1,y:r.dir.y*2.1,z:0},true);pieces.get(body.handle)!.ramp=side+1;fx('tick',soundRef.current)}
    if(ballWaiting&&ballRuns.length<Math.min(4,ballRoom())&&physicsFrame-ballLast>=48){ballWaiting--;ballLast=physicsFrame;ballRuns.push({t:0,seg:0})}
    // The visible rail motion ends at exactly the physical handoff position (no teleport).
    for(let k=ballRuns.length-1;k>=0;k--){const br=ballRuns[k];br.t+=slow
     const sd=.035*br.t*(1+br.t/90),seg=Math.min(RUN.length-2,Math.floor(sd/RUN_LEN*(RUN.length-1)))
     if(seg!==br.seg){br.seg=seg;fx('tick',soundRef.current)}
     if(sd>=RUN_LEN&&ballRoom()>0&&clearAt(...RUN[RUN.length-1],BALL*2.1)){
      const at=RUN[RUN.length-1],prev=RUN[RUN.length-2],len=Math.hypot(at[0]-prev[0],at[1]-prev[1]),body=addCoin(...at,true)
      body.setLinvel({x:(at[0]-prev[0])/len*1.8,y:(at[1]-prev[1])/len*1.8,z:0},true)
      reveals.emit({kind:'ball',phase:'release',at:{x:at[0],y:at[1],z:at[2]}});ballRuns.splice(k,1);rampGlow[0]=1}}
    c=spawned(c)
    // FIFO requests retain their source even if multiple bank/prize awards
    // arrive in one frame. A full body budget pauses construction, never clips.
    for(const t of c.towers){towerMachine.enqueue(t.n,t.source??'prize');reveals.emit({kind:'tower',phase:'award',magnitude:t.n,at:{x:TOWER.x,y:TOWER.buildTop,z:TOWER.z}});if(t.source==='bank'){if(bbAt<0)towerRelease=0;bbAmount+=t.n;bbAt=c.frame;setBigWin(bbAmount)}}
    if(c.towers.length)c={...c,towers:[]}
    for(const award of c.tides??[]){reveals.emit({kind:'tide',phase:'award',magnitude:award.n});tideMachine.enqueue(award.n,{key:String(award.id),practice:award.practice});setTideSummary(null)}
    if(c.tides?.length)c={...c,tides:[]}
    rewardRoute.update({safe:towerMachine.status().stage==='idle',pending:towerMachine.status().pending>0},{safe:tideMachine.status().routeSafe,pending:tideMachine.status().pending>0&&tideMachine.status().stage!=='choosing'})
    towerMachine.update(physicsFrame)
    const musicTower=towerMachine.status()
    if(musicTower.stage==='building'&&musicTower.source!=='stock'&&musicTower.requestId!==lastMusicTower){lastMusicTower=musicTower.requestId;musicRef.current?.cue('tower')}
    const musicDraw=c.chance??c.dish
    const musicDrawKey=musicDraw?(c.chance?'chance:':'dish:')+(musicDraw.launchId??musicDraw.at):null
    if(musicDraw&&c.frame>=musicDraw.at&&musicDrawKey!==lastMusicDraw){lastMusicDraw=musicDrawKey;musicRef.current?.cue('bonus')}
    if(c.jpWins>before.jpWins)musicRef.current?.cue('jackpot')
    tideMachine.update(physicsFrame)
    c={...c,tideBusy:tideMachine.status().stage!=='idle'}
    // The pusher moves, the world steps.
    pusherBody.setNextKinematicTranslation({x:0,y:PUSHER_SHELF.height/2,z:shelfCenter(c.pusher)})
    // A medal about to fall into a pocket lights it up without altering physical time.
    const wide=inFever(c)?1.35:1
    let near=-1
    for(const p of pieces.values()){if(!p.board)continue;const t=p.body.translation();if(t.y>BBOTTOM&&t.y<BBOTTOM+0.7){const i=POCKET_W.findIndex((w,k)=>Math.abs(t.x-pocketX(k,c.frame))<w*wide/2);if(i>=0){near=i;break}}}
    // Keep kinematic machinery and contacts on the same clock; cinematic slowdown used to amplify impacts.
    if(near>=0)pocketMeshes[near].flash=Math.max(pocketMeshes[near].flash,.35)
    updateRearContactAccuracy(world,pieces.values(),R)
    world.step()
    contactBegins.beginFrame()
    // The board's bottom: into a pocket, or out onto the pusher's shelf (where it tips over and joins the pile).
    for(const [h,p] of pieces){if(!p.board)continue;const t=p.body.translation()
     if(p.capturedPocket===undefined)world.contactPairsWith(p.body.collider(0),other=>{const pin=feedbackPins.get(other.handle);if(pin&&contactBegins.contact(h,other.handle)&&!lookRef.current){fx('coinPin',soundRef.current,other.handle);if(reveals.mode!=='off')machineFeedback.cue('pin',pin,{key:other.handle})}})
     // A balanced medal may rest on a pin until another medal contacts it; no random kicks.
     if(t.y>BBOTTOM)continue
     const hit=POCKET_W.findIndex((w,i)=>Math.abs(t.x-pocketX(i,c.frame))<w*wide/2-0.05)
     if(p.capturedPocket!==undefined){if(t.y<BBOTTOM-.35){world.removeRigidBody(p.body);pieces.delete(h)}continue}
     if(hit>=0){p.capturedPocket=hit;c=pocket(c,POCKETS[hit]);machineFeedback.cue('pocket',{x:pocketX(hit,c.frame),y:BBOTTOM,z:BZ},{target:{x:WHEEL_X[hit],y:WHEEL_Y,z:BZ},key:h});if(pail2.toss<0&&pail2.n<BUCKET_FULL){pail2.n++;c=awardField(c,1)};
      p.body.setLinvel({x:0,y:-1.3,z:0},true);pop('IN! '+POCKET_FACE[hit],pocketX(hit,c.frame),BBOTTOM+.4,BZ+.3,'in'+hit);buzz(20);pocketMeshes[hit].flash=1;fx(hit===1?'star':'zap',soundRef.current)}
     else{p.board=false;p.body.setEnabledTranslations(true,true,true,true);p.body.setEnabledRotations(true,true,true,true);p.body.setLinvel({x:p.body.linvel().x*.5,y:-1,z:.6},true)}}
    contactBegins.endFrame()
    // What fell: off the front is yours, off the sides is lost; a ball off the front goes to the ball lottery.
    // KONO's bucket: full, KONO cheers and throws the medals over the pin board onto the field.
    if(pail2.toss<0&&pail2.n>0&&(pail2.n>=BUCKET_FULL||c.hand<=0)){pail2.toss=0;pop('KONO’s bucket!',3.4,BTOP+1.9,BZ,'prize2');fx('fanfare',soundRef.current)}
    if(pail2.toss>=0){pail2.toss++
     if(pail2.toss>=34&&pail2.toss%7===0&&pail2.n>0&&room()>0&&clearAt(bucket.position.x-.2,bucket.position.y+.12,bucket.position.z+.28,.64)){const at=bucket.position;const body=addCoin(at.x-.2,at.y+.12,at.z+.28,false,1.5,false,false,true);body.setLinvel({x:-1.6,y:.5,z:3.3},true);pail2.n--;fx('tick',soundRef.current)}
     if(pail2.toss>95&&pail2.n===0)pail2.toss=-1}
    c=collectPieces(c)
    cove.current=c;acc-=PHYSICS_STEP_MS
    const ev=c.events[c.events.length-1];if(ev&&ev!==before.events[before.events.length-1]){setHud(h=>({...h,event:ev.text,big:/BIG BONUS|JACKPOT[!]/.test(ev.text)}))
     if(/BIG BONUS/.test(ev.text)){show.party=300;buzz([60,40,60,40,200]);fx('fanfare',soundRef.current);setBigWin(bbAmount)}
     else if(/FEVER/.test(ev.text)){show.party=180;emit(0,BTOP,BZ+1,160,CONFETTI,4);pop('🌈 FEVER TIME!',0,BTOP-0.5,BZ+0.5,'big');buzz([40,30,40,30,120]);fx('blaze',soundRef.current)}
     else if(/COMBO/.test(ev.text)){const m=/×(\d+)/.exec(ev.text);pop('COMBO ×'+(m?.[1]??''),0,BTOP-1,BZ+0.5,'combo');fx('mult',soundRef.current)}
     if(/JACKPOT[!]/.test(ev.text)){show.party=420;emit(0,3,0,300,CONFETTI,6);buzz([100,50,100,50,300,80,300]);jpAt=c.frame;jpAmount=Number(/\+(\d+)/.exec(ev.text)?.[1]??0);setJpWin(jpAmount)}

     if(/CHANCE/.test(ev.text)&&!/FEVER/.test(ev.text)){show.party=120;emit(0,2.5,0,90,CONFETTI,3.5)}else if(/shower/i.test(ev.text))emit(0,3,-1,60,GOLD,3);if(/JACKPOT!/.test(ev.text)){fx('mega',soundRef.current);gameSound('win',soundRef.current)}else if(/CHANCE|tower|shower|ball/i.test(ev.text))fx('fanfare',soundRef.current)}
    if(c.spinning&&!before.spinning)fx('charge',soundRef.current)
   }
   acc=retainedRemainder(acc)
   machineFeedback.update(lookRef.current?0:steps/60)
   localReveals.update(lookRef.current&&cove.current.boardClearBusy?0:steps/60)
   const c=cove.current,f=c.frame
   if(feedingRef.current&&!feed.current.active){feedingRef.current=false;setFeeding(false)}
   // Draw the machine where the physics has it.
   const shelfAt=pusherBody.translation();pusherMesh.position.set(shelfAt.x,shelfAt.y,shelfAt.z)
   const flipper=flipperPose(flipperFrame,CABINET.aimHalfWidth);chute.position.set(flipper.x,BTOP+.32,BZ);paddle.rotation.z=flipper.tilt+inputPulse*.35;inputGate.position.y=-.16+inputPulse*.22

   pocketMeshes.forEach((pm,i)=>{pm.g.position.x=pocketX(i,f);pm.flash=Math.max(0,pm.flash-0.03);pm.mat.emissiveIntensity=0.9+pm.flash*4+(show.party>0?Math.abs(Math.sin(f/4+i)):0);const bounce=1+Math.sin(pm.flash*Math.PI)*0.35,widen=inFever(c)?1.35:1;pm.g.scale.set(bounce*widen,bounce,bounce)})
   let n=0,b=0
   for(const p of pieces.values()){const t=p.body.translation(),r=p.body.rotation()
    m4.compose(v3.set(t.x,t.y,t.z),q.set(r.x,r.y,r.z,r.w),s3)
    if(p.ball){if(b<16)balls.setMatrixAt(b++,m4)}else if(n<MAX)coins.setMatrixAt(n++,m4)}
   const clearStatus=boardClearMachine.status();let haloCount=0
   if(clearActive)for(const id of clearStatus.targetIds){const piece=pieces.get(id);if(!piece||piece.counted)continue;const pos=piece.body.translation();m4.compose(v3.set(pos.x,pos.y+.17,pos.z),q.setFromEuler(new THREE.Euler(Math.PI/2,0,0)),s3);clearHalo.setMatrixAt(haloCount++,m4)}
   clearHalo.count=haloCount;clearHalo.instanceMatrix.needsUpdate=true
   coins.count=n;coins.instanceMatrix.needsUpdate=true;balls.count=b;balls.instanceMatrix.needsUpdate=true
   // HUD wheel controllers retain their exact original outcomes and timing.
   miniWheels.forEach((w,i)=>{const sp=c.wheels?.[i]
    if(sp&&sp.at!==w.spinAt){
     // A queued spin can replace its predecessor in the same rules step. Still show that earned result.
     if(w.seg>=0){const previous=WHEELS[i][w.seg];w.angle=w.end;pop(prizeText(previous),WHEEL_X[i],WHEEL_Y+.5,BZ,'prize'+i);w.flash=.7;fx('ding',soundRef.current);w.seg=-1}
     w.spinAt=sp.at;w.from=w.angle;fx('charge',soundRef.current);setDials(d=>d.map((x,k)=>k===i?{spin:true,prize:'',kind:'',at:f}:x))}
    // The rules may finish a spin between two drawn frames, so a spin also ends when the wheel's gone idle.
    let t=1
    if(sp){t=Math.min(1,(f-sp.at)/WHEEL_FRAMES);const target=sp.seg*Math.PI/4,base=w.from-(w.from%(Math.PI*2));w.end=base+Math.PI*2*4+target;w.seg=sp.seg
     w.angle=w.from+(w.end-w.from)*(1-(1-t)**3)
     // A click as each segment passes the pointer, slowing down with the wheel.
     const under=Math.round(w.angle/(Math.PI/4));if(under!==wheelSeg[i]&&t<1){wheelSeg[i]=under;fx('tick',soundRef.current)}}
    if(w.seg>=0&&t>=1){if(!sp)w.angle=w.end;w.flash=1;emit(WHEEL_X[i],WHEEL_Y,BZ+0.3,40,POCKET_SPARK[i],2.6);const seg=WHEELS[i][w.seg];w.seg=-1;fx(seg.kind==='lamp'||seg.kind==='ball'?'star':'ding',soundRef.current)
     pop(seg.kind==='medals'?'+'+seg.n+' 🪙':seg.kind==='layers'?'+'+seg.n+' 🗼 '+(seg.n===1?'LAYER':'LAYERS'):seg.kind==='ball'?'🔮 BALL!':seg.kind==='lamp'?'💡 LAMP!':'🎰 SPIN!',WHEEL_X[i],WHEEL_Y+0.5,BZ,'prize'+i)
     setDials(d=>d.map((x,k)=>k===i?{spin:false,prize:prizeText(seg),kind:seg.kind,at:f}:x))}
    dialEls.current[i]?.setAttribute('transform','rotate('+(-w.angle*180/Math.PI).toFixed(2)+')');w.flash=Math.max(0,w.flash-0.02)
    if(!sp&&w.flash<0.02)w.flash=0})
   // Every ring represents up to five banked medals. Fifteen visible rings
   // maximum; overflow is stated beside the exact total, never discarded.
   const {slots}=reserveDisplay(c.bank??BANK_START),drawn=slots.length
   for(let i=0;i<drawn;i++){const slot=slots[i]
    m4.compose(v3.set(slot.x,RESERVE_DISPLAY.baseY+slot.y,RESERVE_DISPLAY.baseZ+slot.z),q.setFromEuler(new THREE.Euler(0,i*.4,0)),s3)
    giant.setMatrixAt(i,m4);giant.setColorAt(i,LAYER_TINT[i%LAYER_TINT.length])}
   giant.count=drawn;giant.instanceMatrix.needsUpdate=true;if(giant.instanceColor)giant.instanceColor.needsUpdate=true
   const towerState=towerMachine.status()
   eventScreen.update(lookRef.current?0:steps/60)
   cinemaFrame.current?.(lookRef.current?0:steps/60,c)
   towerCeremony.update(towerState,cove.current.boardClearBusy?0:steps/60,tideMachine.status())
   towerState.supports.forEach((at,i)=>cradleLeaves[i].position.set(at.x,at.y,at.z))
   const head=towerState.head
   buildHead.visible=headMouth.visible=!!head
   if(head){buildHead.position.set(head.x,head.y+.16+towerCeremony.toolLift,head.z);headMouth.position.set(head.x,head.y+.065,head.z)}
   // The gadgets as they are now: balls on the run and KONO's bucket.
   runBalls.forEach((m,k)=>{const br=ballRuns[k];m.visible=!!br&&br.t>=0;if(!m.visible)return
    const sd=0.035*br.t*(1+br.t/90),u=Math.min(0.999,sd/RUN_LEN);m.position.copy(runCurve.getPointAt(u)).add(new THREE.Vector3(0,BALL+0.04,0));m.rotation.z=-sd/BALL})
   {const tt=pail2.toss,tip=tt<0?0:tt<20?0:tt<34?(tt-20)/14:pail2.n>0?1:Math.max(0,1-(tt-76)/20)
    bucket.position.set(kono.position.x-0.75,kono.position.y+0.3+(tt>=0&&tt<34?Math.sin(tt/34*Math.PI)*0.5:0),kono.position.z+0.15);bucket.rotation.set(tip*1.6,0,tip*0.4)
    for(let k=0;k<pail2.n;k++){m4.compose(v3.set(0,-0.14+k*0.05,0),q.setFromEuler(new THREE.Euler(0,k*0.8,0)),s3);bucketCoins.setMatrixAt(k,m4)}
    bucketCoins.count=pail2.n;bucketCoins.instanceMatrix.needsUpdate=true}
   // The slides' mouths glow as they let medals out.
   mouths.forEach((m,i)=>{rampGlow[i]=Math.max(0,rampGlow[i]-.06);m.emissiveIntensity=.4+rampGlow[i]*1.2;gates[i].position.y=RAMPS[i].top.y+.15+rampGlow[i]*.3})
   ballGate.position.y=RUN[0][1]+Math.max(0,1-(physicsFrame-ballLast)/18)*.5
   // The show.
   const party=show.party>0;show.party=Math.max(0,show.party-1)
   const feverOn=inFever(c)||!!c.chance||jpAt>=0
   // Steady warm trim instead of a permanently chasing/flashing background.
   bulbSpots.forEach((_,i)=>bulbs.setColorAt(i,(i%3===0||party)?BULB[0]:dim));if(bulbs.instanceColor)bulbs.instanceColor.needsUpdate=true
   // The earned BIG BONUS lamps remain readable with a steady glow.
   lampMats.forEach((m,i)=>{const lit=i<c.steps;m.emissiveIntensity=lit?1.7:party?.65:0;m.color.set(lit?'#fff2b0':'#5a4a3a')})
   const anim=party||pail2.toss>=0?konoAnim.cheer:now-lastDrop.current<900?konoAnim.wave:konoAnim.breathe;anim.offset.x=Math.floor(f/(party?6:10))%4*0.25;kono.material.map=anim
   kono.position.set(5.15,5.4+(party?Math.abs(Math.sin(f/6))*.35:0),BZ-0.3)
   for(let i=0;i<SPARKS;i++){if(sLife[i]<=0){sPos[i*3+1]=-99;continue}sLife[i]-=1/60;sVel[i*3+1]-=0.06;sPos[i*3]+=sVel[i*3]/60;sPos[i*3+1]+=sVel[i*3+1]/60;sPos[i*3+2]+=sVel[i*3+2]/60;const k=Math.max(0,sLife[i]);sCol[i*3]*=0.985;sCol[i*3+1]*=0.985;sCol[i*3+2]*=0.985;if(k===0)sPos[i*3+1]=-99}
   ;(sGeo.attributes.position as THREE.BufferAttribute).needsUpdate=true;(sGeo.attributes.color as THREE.BufferAttribute).needsUpdate=true
   placeCamera()
   const anchors=[[-6.25,6.7,RAMP_Z],[0,RESERVE_DISPLAY.baseY+Math.min(.68,slots.length*GSTEP),RESERVE_DISPLAY.baseZ],[6.6,3.1,RAMP_Z]]
   hotspots.current.forEach((button,i)=>{if(!button)return;const p=new THREE.Vector3(...anchors[i]).project(camera);button.style.left=((p.x+1)/2*100)+'%';button.style.top=((1-p.y)/2*100)+'%';button.style.visibility=!lookRef.current&&Math.abs(p.x)<.82&&p.y<.65&&p.y>-.7?'visible':'hidden'})
   const tideState=tideMachine.status()
   tideLights.forEach(({lane,mesh,material})=>{
    mesh.visible=lane===tideState.lane&&['loading','draining'].includes(tideState.stage)
    material.opacity=tideState.blocked?.12:.32
   })
   // Compact dashboard accounting follows actual tower handoff, not a +0 prize overlay.
   if(bbAt>=0){if(bbCount.current)bbCount.current.textContent=String(Math.min(bbAmount,towerRelease));if(towerState.pending===0&&towerState.stage==='idle'){bbAt=-1;bbAmount=0;towerRelease=0;setBigWin(null)}}
   if(winAcc&&now-winAt>450){const n=winAcc;winAcc=0;setWin({n,id:now})}
   // The jackpot award is committed immediately. This number is NOT a fabricated delivery count; the live delivery ledger below tracks actual handoff.
   if(jpAt>=0){const jt=f-jpAt
    if(jpCount.current)jpCount.current.textContent=String(jpAmount)
    if(jt<330&&jt%14===0){const col=[CONFETTI[(jt/14)%CONFETTI.length|0]];emit((Math.random()-.5)*8,4+Math.random()*3,-3+Math.random()*3,70,jt%28===0?CONFETTI:col,3.6);if(jt%42===0)fx('zap',soundRef.current)}
    if(jt>=100){jpAt=-1;setJpWin(null)}}
   drawFrame.current?.(c)
   composer.render()
   if(now-lastHud>120||c.spinning){lastHud=now
    const reels=c.spinning?[0,1,2].map(i=>f-c.spinning!.at<40+i*25?REEL_FACES[Math.floor((f+i*3)/3)%6]:c.spinning!.reels[i]):c.lastReels??hudReels.current
    if(c.spinning)hudReels.current=reels
    const ledger=deliveryLedger(c.fieldAwards??0,rewardDelivered,rewardCollected,rewardLost),bp=ballProgress(c)
    assertDeliveryConserved(ledger,pendingMedals(c,{hoppers:dispensers[0].queued+dispensers[1].queued,tower:towerState.pending,bucket:pail2.n,tide:tideState.pending}),[...pieces.values()].filter(p=>p.reward&&!p.ball&&!p.towerHeld&&!p.tideHeld&&!p.counted).length)
    setInputStatus({queued:inputQueue.length,capacity:FEED_CAPACITY,headAim:null,reason:inputQueue.length?(room()<=0?'Body capacity':!clearAt(flipper.x,BTOP+.3,BZ,.63)?'Flipper clearing':inputPulse>=.2?'Launch spacing':'Ready to launch'):''})
    syncClear();setDraw(bonusPresentation(c));setTide(tideState);setTideCollected(tideState.requestId===null?0:tideCollections.get(tideState.requestId)??0)
    if(tideState.lastCompleted){const done=tideState.lastCompleted;setTideSummary({total:done.total,lane:done.lane!,practice:done.practice,collected:tideCollections.get(done.id)??0})}
    const stages={idle:towerState.stockHeld?`${towerState.stockHeld} starting-stock medals · right bay ready`:'Reserve ready',deploying:'Preparing side workshop',parking:'Parking at the side workshop',building:'Building '+Math.max(0,towerState.batchBuilt-towerState.stockHeld)+'/'+(towerState.batchSize-towerState.stockHeld)+' award medals'+(towerState.stockHeld?' + '+towerState.stockHeld+' starting stock':'')+' in the right bay',transferring:'Sliding supported tower to the right field',homing:'Raising open shutters · closing in the bay',lowering:'Docking on the field',ready:'Supported · ready to release',releasing:'Opening cradle · physical release',returning:'Returning open empty carriage to the bay'}
    const towerReason=towerState.waitReason==='shared-route'?'Tide owns route':towerState.waitReason==='capacity'?'Body capacity':towerState.waitReason?'Physical obstruction':''
    const tideReason=tideState.waitReason==='shared-route'?'Tower owns route':tideState.waitReason==='capacity'?'Body capacity':tideState.waitReason?'Physical obstruction':''
    const routes:DeliveryRoute[]=[]
    if(towerState.pending)routes.push({source:'Tower',pending:towerState.pending,stage:stages[towerState.stage],reason:towerReason})
    if(tideState.pending)routes.push({source:'Tide',pending:tideState.pending,stage:tideState.stage==='choosing'?'Choose a lane':tideState.stage,reason:tideReason})
    dispensers.forEach((d,i)=>{if(!d.queued)return;const r=RAMPS[i],x=r.s*(RAMP_OUT-.28),y=r.at(x)+.16;routes.push({source:(i?'Right':'Left')+' hopper',pending:d.queued,stage:'Feeding field',reason:room()<1?'Body capacity':!clearAt(x,y,RAMP_Z)?'Mouth obstructed':physicsFrame-d.lastFrame<d.gapFrames?'Release spacing':''})})
    if(pail2.n)routes.push({source:'Bucket',pending:pail2.n,stage:pail2.toss<0?'Filling bucket':pail2.toss<34?'Lifting bucket':'Pouring field',reason:pail2.toss>=34?(room()<1?'Body capacity':!clearAt(bucket.position.x-.2,bucket.position.y+.12,bucket.position.z+.28,.64)?'Mouth obstructed':'Release spacing'):''})
    const railExitWaiting=ballRuns.some(br=>.035*br.t*(1+br.t/90)>=RUN_LEN)
    if(ballWaiting||ballRuns.length)routes.push({source:'Ball rail',pending:ballWaiting+ballRuns.length,stage:railExitWaiting?'Awaiting field handoff':ballRuns.length?'Traveling rail':'Magazine queued',reason:railExitWaiting?(ballRoom()<1?'Ball capacity':!clearAt(...RUN[RUN.length-1],BALL*2.1)?'Rail exit obstructed':''):ballWaiting?(ballRoom()<=ballRuns.length?'Ball capacity':ballRuns.length>=4?'Rail capacity':physicsFrame-ballLast<48?'Release spacing':''):''})
    setDelivery({...ledger,routes,tray:c.won,ballWaiting:bp.waiting,ballArriving:ballWaiting+ballRuns.length,ballField:[...pieces.values()].filter(p=>p.ball&&!p.counted).length,captured:bp.captured,phase:bp.phase,tower:(towerReason?towerReason+' · ':'')+(towerState.clearing?'Clearing existing bay medals · ':'')+stages[towerState.stage]+(towerState.pending?' · '+towerState.pending+' medals remaining':''),wheelQueue:[...(c.wheelQueue??[0,0,0])]})
    setHud(h=>h.bank===(c.bank??BANK_START)&&h.hand===c.hand&&h.jp===c.jackpot&&h.steps===c.steps&&h.pockets===c.winPockets&&h.queue===c.queue&&h.reels.join()===reels.join()&&h.spinning===!!c.spinning&&h.chance===!!c.chance?h:{...h,chance:!!c.chance,bank:c.bank??BANK_START,hand:c.hand,jp:c.jackpot,steps:c.steps,pockets:c.winPockets,queue:c.queue,reels,spinning:!!c.spinning})}
   const fl=feverOn&&c.fever?Math.ceil((c.fever.until-f)/60):0;if(fl!==feverRef.current){feverRef.current=fl;setFever(fl)}
   // Terminal-flight detection matters only when the hand is empty. Avoid hundreds
   // of WASM velocity reads during ordinary play; physical updates still run fully.
   const inFlight=c.hand<=0&&!practiceState.current.enabled&&[...pieces.values()].some(p=>{if(p.counted)return false;const t=p.body.translation(),v=p.body.linvel(),w=p.body.angvel();return p.board||!!p.ramp||t.y<-.3||(p.ball&&Math.hypot(v.x,v.y,v.z)>.04)||(t.y>1&&v.y<-.25)||(t.z>FRONT-1.2&&(Math.hypot(v.x,v.y,v.z)>.12||Math.hypot(w.x,w.y,w.z)>.3))})
   // Allow a full pusher cycle after delivery/front-edge activity settles. Contact-driven pile motion is normal idle machinery, not an outstanding payout.
   const work={input:inputQueue.length,medals:pendingMedals(c,{hoppers:dispensers[0].queued+dispensers[1].queued,tower:towerState.pending,bucket:pail2.n,tide:tideState.pending}),balls:ballWaiting+ballRuns.length,towerBusy:towerState.stage!=='idle',bucketBusy:pail2.toss>=0,trayBusy:false,inFlight}
   if(!practiceState.current.enabled&&c.hand<=0&&!hasPendingWork(c,work)){quiet.current+=steps;if(quiet.current>460&&!ended.current){ended.current=true;stopFeed();onEndRef.current(c.hand,c.jpWins,practiceState.current.used)}}else quiet.current=0
   raf=requestAnimationFrame(tick)
  }
  const contextLost=(e:Event)=>{e.preventDefault();ready.current=false;stopFeed();cancelAnimationFrame(raf);setFail('crash')}
  const tick=(now:number)=>{try{loop(now)}catch(error){console.error('Medal Cove stopped:',error);ready.current=false;stopFeed();setFail('crash')}}
  renderer.domElement.addEventListener('webglcontextlost',contextLost)
  raf=requestAnimationFrame(tick)
  return ()=>{acceptedFeedback.current=null;contactBegins.clear();machineFeedback.dispose();eventScreen.dispose();towerCeremony.dispose();localReveals.dispose();ready.current=false;musicRef.current?.setActive(false);stopFeed();command.current=null;tideChoice.current=null;clearRequest.current=null;gestureStop.current=null;cameraSnapshot.current=null;cancelAnimationFrame(raf);ro.disconnect();window.removeEventListener('keydown',key);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden)
   renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('pointercancel',cancel);renderer.domElement.removeEventListener('lostpointercapture',up);renderer.domElement.removeEventListener('wheel',zoomWheel);world.free()
   scene.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose?.();const mat=m.material as THREE.Material|THREE.Material[]|undefined;(Array.isArray(mat)?mat:mat?[mat]:[]).forEach(x=>{(x as THREE.MeshStandardMaterial).map?.dispose();x.dispose()})})
   composer.dispose();envRT.dispose();renderer.dispose();renderer.domElement.remove()}
 }
 useEffect(()=>{
  const el=host.current;if(!el)return
  // If the 3D machine can't start (no WebGL, the physics didn't load, or it's taking far too long), say why
  // and offer Try again or Leave, instead of "Filling the machine…" forever.
  let disposed=false,gaveUp=false,cleanup=()=>{}
  ready.current=false;setHud(h=>({...h,ready:false}))
  if(!webglWorks()){setFail('webgl');return}
  const timer=window.setTimeout(()=>{if(!ready.current&&!disposed){gaveUp=true;setFail('slow')}},15000)
  RAPIER.init().then(()=>{
   if(disposed||gaveUp)return
   if(!webglWorks()){setFail('webgl');return}
   try{cleanup=build(el)}catch(error){console.error('Medal Cove initialization:',error);ready.current=false;el.querySelectorAll('canvas').forEach(c=>c.remove());setFail('webgl')}
  },()=>{if(!disposed&&!gaveUp)setFail('physics')})
  return ()=>{disposed=true;window.clearTimeout(timer);cleanup()}
 },[tries])

 useEffect(()=>{if(!win)return;const t=window.setTimeout(()=>setWin(null),1400);return()=>window.clearTimeout(t)},[win])
 useEffect(()=>{if(!hud.event)return;const t=window.setTimeout(()=>setHud(h=>({...h,event:''})),2200);return()=>window.clearTimeout(t)},[hud.event])
 return <div className="break-game medal-cove">
  <section className="cove-dashboard" aria-label="Wheels and rewards">
  <div className="cove-dials" aria-label="Bonus wheels">
   {WHEELS.map((segs,i)=><WheelDial key={i} i={i} segs={segs} state={dials[i]} queued={delivery.wheelQueue[i]} turn={el=>{dialEls.current[i]=el}}/>)}
  </div>
   <BonusConsole cinema={<KonoCinema reveals={reveals} frameRef={cinemaFrame}/>} hud={hud} delivery={delivery} best={best} practice={practiceUsed} bigWin={bigWin} deliveredRef={bbCount}
    event={!draw&&(!tide||tide.stage==='idle')?hud.event:undefined} mode={reveals.mode} reduced={reveals.reduced} paused={detailsPaused||blocked||looking||clearView.active||!!fail||!hud.ready} onDetailsOpenChange={pauseDetails}/>
   <div className={'cove-event-slot cinema-controls'+((clearView.tokens>0||clearView.active||clearView.phase==='complete'||draw||(tide&&tide.stage!=='idle')||tideSummary)?' is-active':'')}>
   {(clearView.active||(!draw&&(!tide||tide.stage==='idle')&&(clearView.tokens>0||clearView.phase==='complete')))&&<section className={'cove-clear-strip'+(clearView.active?' is-active':'')} aria-label="Board Clear bonus">
    <div><b>🧲 {clearView.practice?'PRACTICE · ':''}BOARD CLEAR</b><span role="status">{clearView.active?(looking?'Paused · lock view to continue':clearView.collected+' / '+clearView.total+' collected in the tray'):clearView.phase==='complete'?'Board reset · '+clearView.collected+' collected':'JP bonus unlocked · one sweep per win'}</span></div>
    {clearView.active?<progress aria-label="Board Clear actual tray collection" value={clearView.collected} max={Math.max(1,clearView.total)}/>:clearView.tokens>0?<button type="button" disabled={!hud.ready||!!fail||looking||blocked} onClick={requestBoardClear}>Clear board{clearView.tokens>1?' ×'+clearView.tokens:''}</button>:<small>Fresh stock ready</small>}
    {clearView.active&&<small>On-field medals: magnetic lift → real tray → fresh board. Balls and undelivered rewards pause, then resume.</small>}
   </section>}
   {draw&&!clearView.active&&<BonusDraw controlsOnly onLaunch={requestBonusLaunch} onFrameRef={drawFrame} draw={draw} mode={reveals.mode} reduced={reveals.reduced} paused={detailsPaused||blocked||looking||!!fail} onDetailsOpenChange={pauseDetails}/>}
   {!clearView.active&&tide&&tide.stage!=='idle'&&<TideDeliveryPanel tide={tide} collected={tideCollected} onChoose={selectTideLane} mode={reveals.mode} reduced={reveals.reduced} paused={detailsPaused||blocked||looking||!!fail||!hud.ready} disabled={!hud.ready||!!fail||looking||blocked||detailsPaused} looking={looking}/>}
   {!clearView.active&&!draw&&(!tide||tide.stage==='idle')&&tideSummary&&<p className="cove-tide-summary" role="status">{tideSummary.practice?'Practice Tide':'Tide'} · {tideSummary.total} awarded / {tideSummary.total} delivered via {tideSummary.lane} · {tideSummary.collected} collected. Keep pushing to the front.</p>}
   </div>
  </section>
  <dialog ref={practiceDialog} className="sanctuary-details cove-practice-dialog" onCancel={closePractice} onClose={closePractice}><header><h2>Practice sandbox</h2><button type="button" aria-label="Close practice" onClick={closePractice}>×</button></header>
   {(practice||practiceUsed)&&<section className="cove-practice-panel" aria-label="Practice sandbox">
    <div className="cove-practice-heading"><b>PRACTICE{practiceUsed?' ROUND':' SANDBOX'}</b><span>{practice?'Sample additions · no earned score':'Sample round · restart to play clean'}</span></div>
    {practice&&<><div className="cove-practice-actions">{PRACTICE_ACTIONS.map(action=><button type="button" key={action.kind} title={action.description} disabled={!hud.ready||!!fail||looking||blocked||clearView.active||(action.kind==='clear'&&!!practiceState.current.clearUsed)} onClick={()=>command.current?.(action.kind)}>{action.label}</button>)}</div><p role="status">{practiceMessage}</p></>}
   </section>}
  </dialog>
  <div ref={host} className="cove-stage" aria-label={'KONO Medal Cove: '+hud.hand+' medals, jackpot '+hud.jp}>
   {revealOverlay}
   {!hud.ready&&!fail&&<p className="cove-loading" role="status">Filling the machine with medals…</p>}
   {fail&&<CoveFail kind={fail} onRetry={retryMachine} onLeave={onFail}/>}
   {win&&<b key={win.id} className={'cove-win'+(win.n>=10?' is-big':'')} aria-hidden="true">+{win.n} 🪙</b>}
   {fever>0&&<span className="cove-fever" role="status" aria-label={'Fever time: '+fever+' seconds'}>🌈 FEVER {fever}s</span>}
   {pops.map(p=><b key={p.id} className={'cove-pop is-'+p.kind.replace(/\d/,'')+(p.kind.match(/\d/)?' is-c'+p.kind.match(/\d/)![0]:'')} style={{left:p.x+'%',top:p.y+'%'}} aria-hidden="true">{p.text}</b>)}
   <div className="cove-play-tools" aria-label="View and practice">
    <div className="cove-view-toolbar">
     {!clearView.active&&clearView.tokens>0&&(draw||tide&&tide.stage!=='idle')&&<button type="button" aria-label={'Clear board · '+clearView.tokens+' available'} disabled={!hud.ready||!!fail||looking||blocked} onClick={requestBoardClear}>🧲 Clear ×{clearView.tokens}</button>}
     {!routePreview&&<><div className="cove-view-switch" role="group" aria-label="Camera framing"><button type="button" disabled={!hud.ready||!!fail} aria-pressed={view===4&&!cameraPose&&!looking} onClick={()=>selectView(4)}>Tiered</button></div>
     <button type="button" className="cove-camera-toggle" ref={cameraToggle} disabled={!hud.ready||!!fail} aria-expanded={looking} aria-controls="cove-camera-editor" onClick={looking?lockCamera:editCamera}>{looking?'Lock view':cameraPose?'Unlock view':'Camera'}</button>
     {looking&&<button type="button" className="cove-camera-reset" disabled={!hud.ready||!!fail} aria-label="Reset view to Tiered" onClick={()=>selectView(4)}>Reset</button>}</>}
     {!looking&&<button type="button" className="cove-route-preview" disabled={!hud.ready||!!fail} aria-pressed={routePreview} aria-label={routePreview?'Return previous camera view':'Reference view of whole route'} title="See both levels and the right build bay; your saved camera is never changed" onClick={previewWholeRoute}>{routePreview?(cameraPose?'Return saved view':'Return previous view'):'Route'}</button>}
     {!looking&&<button type="button" className="cove-practice-toggle" aria-pressed={practice} aria-expanded={practice} disabled={!hud.ready||!!fail} onClick={togglePractice}>{practice?'Close practice':'Practice'}</button>}
    </div>
    {!looking&&cameraNotice.includes('browser')&&<p className="cove-camera-storage-notice" role="status">{cameraNotice}</p>}
    {looking&&cameraPose&&<section id="cove-camera-editor" className="cove-camera-editor" aria-label="Adjust camera">
     <p>Frame your view, then <b>Lock view</b> to play (Esc).</p>
     <div className="cove-camera-zoom" role="group" aria-label="Camera zoom controls"><span>Zoom</span> <output>{cameraPose.zoom.toFixed(2)}×</output><button type="button" aria-label="Zoom out" onClick={()=>adjustCamera({zoom:cameraPoseRef.current!.zoom-.1})}>−</button><input aria-label="Camera zoom" type="range" min=".7" max="3" step=".01" value={cameraPose.zoom} onChange={e=>adjustCamera({zoom:Number(e.target.value)})}/><button type="button" aria-label="Zoom in" onClick={()=>adjustCamera({zoom:cameraPoseRef.current!.zoom+.1})}>+</button></div>
     <div className="cove-camera-drag" role="group" aria-label="Camera drag mode"><span>Drag to</span><button type="button" aria-pressed={cameraDrag==='pan'} onClick={()=>{gestureStop.current?.();cameraDragRef.current='pan';setCameraDrag('pan')}}>Move</button><button type="button" aria-pressed={cameraDrag==='orbit'} onClick={()=>{gestureStop.current?.();cameraDragRef.current='orbit';setCameraDrag('orbit')}}>Angle</button></div>
     <div className="cove-camera-position" role="group" aria-label="Move camera view"><span>Position</span>{[['←',-1,0,'left'],['↑',0,1,'up'],['↓',0,-1,'down'],['→',1,0,'right']].map(([label,x,y,name])=><button key={name} type="button" aria-label={'Move camera '+name} onClick={()=>moveCamera(Number(x)*.65,Number(y)*.65)}>{label}</button>)}</div>
     <label className="cove-camera-angle">Turn<input aria-label="Camera horizontal angle" type="range" min="-1.15" max="1.15" step=".01" value={cameraPose.yaw} onChange={e=>adjustCamera({yaw:Number(e.target.value)})}/></label>
     <label className="cove-camera-angle">Tilt<input aria-label="Camera vertical angle" type="range" min="-.08" max="1.1" step=".01" value={cameraPose.pitch} onChange={e=>adjustCamera({pitch:Number(e.target.value)})}/></label>
     {savedCamera&&<button type="button" onClick={restoreSavedView}>Restore saved view</button>}
     <small>Drag the scene · pinch to zoom · two fingers move. Zoom can crop the machine. Tiered restores the full-machine camera; your saved view is retained.</small>
    </section>}
   </div>
   {hud.ready&&!fail&&<>
    {practice&&([['ball','🔮 Ball run'],['tower','🗼 Release'],['coins','🪙 Feed 12']] as const).map(([kind,label],i)=><button key={kind} type="button" ref={el=>{hotspots.current[i]=el}} className={'cove-machine-hotspot is-'+kind} style={{visibility:'hidden'}} onClick={()=>command.current?.(kind)} title={'Practice sample: '+label}>{label}<small>PRACTICE</small></button>)}
    <p className="cove-play-hint" role="status">{looking?'Camera editing · Lock view to play':inputStatus.queued?`${inputStatus.queued}/${inputStatus.capacity} accepted · ${inputStatus.reason}${inputStatus.queued>=FEED_CAPACITY?' · no extra charge':''}`:feeding?'Feeding through the moving flipper…':cameraNotice||'Watch the flipper · tap DROP or hold to feed.'}</p>
   </>}
  </div>
  <div className="cove-controls" aria-label="Game controls">
   <span className="cove-balance" aria-label={hud.hand+(practiceUsed?' practice medals in hand, including samples':' medals in hand')}>🪙 {hud.hand}<small>{practiceUsed?'practice hand':'in hand'}</small></span>
   <span className="cove-flipper-help">↔ AUTO FLIPPER<small>Time your DROP · hold for more</small></span>
   <button type="button" className={'cove-drop'+(feeding?' is-feeding':'')} disabled={!hud.ready||!!fail||looking||clearView.active||hud.hand<=0} onPointerDown={e=>{if(e.button!==0)return;spaceButton.current=false;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);beginFeed('pointer:'+e.pointerId)}} onPointerUp={e=>stopFeed('pointer:'+e.pointerId)} onPointerCancel={e=>stopFeed('pointer:'+e.pointerId)} onLostPointerCapture={e=>stopFeed('pointer:'+e.pointerId)} onKeyDown={e=>{if(e.code==='Space'){e.preventDefault();spaceButton.current=true;if(!e.repeat)beginFeed('keyboard')}else spaceButton.current=false}} onKeyUp={e=>{if(e.code==='Space'){e.preventDefault();stopFeed('keyboard');window.setTimeout(()=>{spaceButton.current=false},0)}}} onBlur={()=>stopFeed()} onClick={e=>{if(spaceButton.current){spaceButton.current=false;return}if(e.detail===0)tapDrop()}}>{clearView.active?'CLEARING…':inputStatus.queued>=FEED_CAPACITY?'WAITING…':feeding?'FEEDING…':'DROP'} <small>{clearView.active?'collecting · then refilling':looking?'lock view to play':inputStatus.queued>=FEED_CAPACITY?'feeder full · no charge':feeding?'release to stop':'tap 1 · hold for more'}</small></button>
  </div>
  {toolsTarget&&createPortal(<section className="cove-game-tools" aria-label="Machine tools">
   <h2>Camera & play</h2>
   {revealControl}
   <p><b>Camera:</b> Whole route temporarily fits both feeders, the delivery gate and catcher below the toolbar. Return saved view restores your exact camera; preview never overwrites it. Rotate the device to compare framing. Camera / Unlock view lets you zoom, move and angle the view. Lock view saves only that camera on this device. Tiered restores the full-machine camera; your saved view is retained.</p>
   <p>The top flipper sweeps left and right automatically. Tap DROP for one medal or hold for a steady feed; Space also feeds. Each accepted medal leaves the current flipper position once its mouth is clear. Camera editing pauses the flipper and disables spending.</p>
   <p className="cove-delivery-status">{practiceUsed?'Sample-inclusive supply':'Awarded to field'} <b>{delivery.awarded}</b> · Delivering <b>{delivery.pending}</b> · Handed to field <b>{delivery.delivered}</b></p>
   <p>Of that supply: <b>{delivery.live}</b> on field · <b>{delivery.collected}</b> collected · <b>{delivery.lost}</b> lost. Tray total <b>{delivery.tray}</b> also includes starting-field and player-input medals. Tower reserve is separate until released.</p>
   <p><b>Ball status:</b> {delivery.ballArriving} arriving · {delivery.ballField} on field · {delivery.captured} captured · {delivery.ballWaiting} challenges queued.</p>
   <p><b>Ball route:</b> magazine → rail → physical field → catcher/side return → one queued challenge → shown result → field delivery. One captured ball earns one challenge; the existing side-return rule is retained. Dish and JP outcomes are software-selected, not a physical roulette or a stop-button skill test.</p>
   <p><b>Board Clear:</b> each earned JP unlocks one optional magnetic sweep. It collects the existing playfield medals through the real tray, then refills unawarded starting stock. No credit is added before tray contact. Balls, the tower reserve and all queued outcomes/deliveries pause and resume unchanged. Practice → Board Clear is a once-per-round sample. Camera editing pauses an active sweep.</p>
   <p><b>Sanctuary Tide:</b> your fixed jackpot waits for a left, center or right lane choice. Side gates release left/right; the center cassette moves out from its forward-right parking bay for a center-forward drop, then parks clear of the tower route. Real gates release batches of at most 12 medals; a crowded pile can pause them. Keep dropping to move the pile — every still-owed medal stays queued. In a Practice round, reopen Practice and use 12 medals for more sample hopper supply.</p>
   <p>Options and hidden tabs pause the machine. This browser-local round is not saved across reloads. Every earned wheel spin waits; Fever adds two spins per later pocket hit.</p>
   <p><b>Practice is on the playfield.</b> Try JP stages a fixed 100-medal sample, not an earned win or an odds test. Try the ball rail, lottery, tower and prize hopper without waiting for a win. Every sample round stays labeled Practice, including its totals. Only actual tray contacts add medals to your hand.</p>
   <div className="cove-side-views" role="group" aria-label="Other camera views">{[['Front',0],['Overview',1],['Left',2],['Right',3]].map(([label,index])=><button type="button" key={label} disabled={!hud.ready||!!fail||routePreview} onClick={()=>selectView(Number(index))}>{label} view</button>)}</div>
  </section>,toolsTarget)}
  <p className="blast-help cove-help">Watch the moving flipper; Drop releases a medal. Use Camera to frame your view, then Lock view to play. Wheel rewards go to the playfield. Only medals arriving in the tray return to your hand.</p>
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
/** Quiet Sanctuary sky behind the pins. The two trees live in the scene only. */
function boardTexture(){const [c,g]=canvas(1024,384,TEX)
 const grad=g.createLinearGradient(0,0,0,384);grad.addColorStop(0,'#c8ebff');grad.addColorStop(1,'#fff0f4');g.fillStyle=grad;g.fillRect(0,0,1024,384)
 g.fillStyle='#a9657d';g.font='800 36px system-ui';g.textAlign='center';g.fillText('MEDAL COVE',512,370)
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
const GARDEN_ASPECT:Record<string,number>={'lantern-post':293/480,'paper-lanterns':480/379,'light-arch':640/590,'tree-blossom':564/570,'tree-leafy':492/554,'flowers-1':99/49,'flowers-2':112/61,'flowers-3':100/58,'flowers-4':110/64,'cloud-a':209/67,'cloud-b':247/79,butterfly:60/33,bird:63/42}
function lighthouseStripes(){const [c,g]=canvas(64,256,TEX);for(let i=0;i<8;i++){g.fillStyle=i%2?'#f6f1e7':'#d8443a';g.fillRect(0,i*32,64,32)}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function sanctuaryBackdrop(){const [c,g]=canvas(16,256),grad=g.createLinearGradient(0,0,0,256);grad.addColorStop(0,'#a9dcff');grad.addColorStop(.55,'#d9efff');grad.addColorStop(1,'#ffe9f2');g.fillStyle=grad;g.fillRect(0,0,16,256);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function emojiTexture(e:string){const [c,g]=canvas(128,128,TEX);g.font='96px system-ui,"Apple Color Emoji","Noto Color Emoji"';g.textAlign='center';g.textBaseline='middle';g.fillText(e,64,70)
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
const segIcon=(kind:string)=>kind==='lamp'?'💡':kind==='ball'?'🔮':kind==='spin'?'🎰':kind==='layers'?'🗼':'🪙'
function segColor(kind:string,w:number,k:number){const pal=[['#ff6b5e','#ffb3a8'],['#ffd34d','#fff0b8'],['#4fb3ff','#b9e2ff']][w]
 return kind==='lamp'?'#fff3a0':kind==='ball'?'#c8a8ff':kind==='layers'?'#9fe0ff':pal[k%2]}
function prizeText(seg:{kind:string;n?:number}){return seg.kind==='medals'?'+'+seg.n+' 🪙':seg.kind==='layers'?'+'+seg.n+' 🗼':seg.kind==='ball'?'🔮 Ball!':seg.kind==='lamp'?'💡 Lamp!':'🎰 Spin!'}

/** One bonus wheel, zoomed in: glossy segments (icon and amount on each), a gold rim of bulbs that chase
 * (fast while it spins), the pointer at the top, and its pocket and last prize under it. The rotating
 * group (`turn`) is turned by the game's loop to match the wheel in the machine. */
const POCKET_NAME=['Left ship','Middle ship','Right ship']
function WheelDial({i,segs,state,turn,queued}:{queued:number;i:number;segs:{label:string;kind:string;n:number}[];state:{spin:boolean;prize:string;kind:string};turn:(el:SVGGElement|null)=>void}){
 const R=50,seg=(k:number)=>{const a0=(k-0.5)*Math.PI/4-Math.PI/2,a1=a0+Math.PI/4;return {a0,a1,am:(a0+a1)/2}}
 const at=(r:number,a:number)=>(r*Math.cos(a)).toFixed(2)+' '+(r*Math.sin(a)).toFixed(2)
 const spoke=(r:number,a:number,deg:number)=>({x:(r*Math.cos(a)).toFixed(2),y:(r*Math.sin(a)).toFixed(2),transform:'rotate('+deg.toFixed(1)+' '+at(r,a)+')'})
 return <figure className={'cove-dial is-c'+i+(state.spin?' is-spinning':'')+(state.prize&&!state.spin?' is-won':'')} aria-label={POCKET_NAME[i]+' '+POCKET_FACE[i]+' wheel'+(state.spin?', spinning':state.prize?', won '+state.prize:'')}>
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
  <small className="cove-wheel-waiting" aria-label={queued+' earned spins waiting'}>{queued>0?queued+' queued':'Ready'}{state.spin?' · drawing':''}</small>
 </figure>
}
/** The gold medal look, for the little stacks in the seesaw and KONO's bucket. */
function coinsMaterial(){return new THREE.MeshStandardMaterial({color:'#ffd24a',metalness:1,roughness:.32,map:coinFace(),envMapIntensity:1.3})}
