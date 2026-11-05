import * as THREE from 'three'
import type {BonusReveals} from '../store/bonusReveals'
export type FeedbackPoint={x:number;y:number;z:number}
export type MachineCue='accepted'|'launch'|'pin'|'pocket'|'collect'
/** Fixed-size, event-only light pool. Never creates medals or controls mechanisms.
 * All coordinates are measured by the caller after the real action committed. */
export function createMachineFeedback(scene:THREE.Scene,reveals:BonusReveals){
 const root=new THREE.Group();root.name='machine-action-feedback';scene.add(root)
 const ringGeometry=new THREE.RingGeometry(.10,.12,24)
 const trailGeometry=new THREE.BufferGeometry(),positions=new Float32Array(24*8*2*3),colors=new Float32Array(positions.length)
 trailGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));trailGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
 const trailMaterial=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.85,depthWrite:false,toneMapped:false})
 const trails=new THREE.LineSegments(trailGeometry,trailMaterial);trails.name='action-travelling-light';trails.frustumCulled=false;root.add(trails)
 const pool=Array.from({length:24},()=>{
  const material=new THREE.MeshBasicMaterial({color:'#ffe39b',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false})
  const ring=new THREE.Mesh(ringGeometry,material);ring.visible=false;root.add(ring)
  return {ring,material,age:99,duration:.65,kind:'pin' as MachineCue,key:'' as string|number,start:new THREE.Vector3(),end:new THREE.Vector3(),travel:false,color:new THREE.Color()}
 })
 let cursor=0,disposed=false
 const clear=()=>{for(const s of pool){s.age=99;s.ring.visible=false}suspendTrails()}
 const suspendTrails=()=>{trails.visible=false;positions.fill(0);trailGeometry.attributes.position.needsUpdate=true}
 const unsubscribe=reveals.subscribe(()=>{if(reveals.mode==='off')clear();else if(reveals.reduced||reveals.mode==='subtle'){suspendTrails();for(const s of pool)s.travel=false}})
 const point=new THREE.Vector3()
 const sample=(s:typeof pool[number],t:number)=>{
  // Smooth, tapered light flight; endpoints remain the actual target and anchor.
  const u=Math.max(0,Math.min(1,t)),e=u*u*(3-2*u)
  point.lerpVectors(s.start,s.end,e);point.y+=Math.sin(Math.PI*u)*(s.kind==='pocket'?.5:.12)
  return point
 }
 return {
  cue(kind:MachineCue,at:FeedbackPoint,options:{color?:THREE.ColorRepresentation;target?:FeedbackPoint;key?:string|number}={}){
   if(disposed||reveals.mode==='off'||![at.x,at.y,at.z].every(Number.isFinite))return
   const key=options.key??kind
   // Coalesce repeated contacts at the same actual pin/tray region, no heap growth.
   if(pool.some(s=>s.kind===kind&&s.key===key&&s.age<.09))return
   const s=pool[cursor++%pool.length];s.age=0;s.duration=kind==='pocket'?.95:kind==='collect'?.7:.45;s.kind=kind;s.key=key
   s.start.set(at.x,at.y+.025,at.z);s.end.copy(s.start)
   const target=options.target&&[options.target.x,options.target.y,options.target.z].every(Number.isFinite)?options.target:undefined
   if(target)s.end.set(target.x,target.y,target.z)
   else if(kind==='launch')s.end.y-=.45
   else if(kind==='collect')s.end.y+=.24
   s.travel=!reveals.reduced&&reveals.mode==='full'&&(!!target||kind==='launch'||kind==='collect')
   s.color.set(options.color??(kind==='collect'?'#ffe39b':kind==='pin'?'#fff2cf':'#8debdc'));s.material.color.copy(s.color)
   s.ring.position.copy(s.start);s.ring.rotation.set(kind==='collect'?-Math.PI/2:0,0,0);s.ring.scale.setScalar(1);s.material.opacity=.7;s.ring.visible=true
  },
  update(dt:number){
   if(disposed)return
   if(reveals.mode==='off'){clear();return}
   const elapsed=Number.isFinite(dt)?Math.max(0,Math.min(.05,dt)):0;if(!elapsed)return
   let liveTrail=false
   for(let i=0;i<pool.length;i++){
    const s=pool[i];s.age+=elapsed;const t=s.age/s.duration,alive=t<1
    s.ring.visible=alive
    if(alive){
     const quiet=reveals.reduced,amount=reveals.mode==='subtle'?.45:1
     s.ring.scale.setScalar(quiet?1:1+(1-Math.pow(1-t,3))*(s.kind==='collect'?4:2)*amount)
     s.material.opacity=(quiet?.35:.7)*(1-t)
     // Local launch guide retracts upwards, never changes the real nozzle.
     if(!quiet&&s.kind==='accepted')s.ring.position.y=s.start.y+Math.sin(t*Math.PI)*.08*amount
    }
    for(let j=0;j<8;j++)for(let end=0;end<2;end++){
     const base=(i*16+j*2+end)*3,visible=alive&&s.travel&&t>.04
     if(visible){liveTrail=true;const u=Math.max(0,t-(7-j+(end?0:1))*.022);sample(s,u);positions[base]=point.x;positions[base+1]=point.y;positions[base+2]=point.z}
     else {positions[base]=0;positions[base+1]=-99;positions[base+2]=0}
     const intensity=visible?(j+1)/8*Math.min(1,(1-t)*5):0
     colors[base]=s.color.r*intensity;colors[base+1]=s.color.g*intensity;colors[base+2]=s.color.b*intensity
    }
   }
   trails.visible=liveTrail;trailGeometry.attributes.position.needsUpdate=true;trailGeometry.attributes.color.needsUpdate=true
  },
  dispose(){if(disposed)return;disposed=true;unsubscribe();scene.remove(root);ringGeometry.dispose();trailGeometry.dispose();trailMaterial.dispose();for(const s of pool)s.material.dispose()}
 }
}

/** Read-only contact edge detector. Advance once per actual physics step, including
 * while effects are Off, so enabling visuals never turns a resting contact into a hit.
 * Pauses call none of these methods. Two reused sets retain only current contacts;
 * removed bodies and ended contacts are retired at endFrame. Saturation fails quiet
 * until all contacts clear rather than repeatedly flashing untracked resting pairs. */
export function createContactBegins(capacity=4096){
 const limit=Number.isFinite(capacity)?Math.max(1,Math.floor(capacity)):4096
 let previous=new Set<string>(),current=new Set<string>(),saturated=false,overflow=false
 return {
  get size(){return previous.size},
  beginFrame(){current.clear();overflow=false},
  contact(bodyHandle:number,pinHandle:number){
   const key=bodyHandle+':'+pinHandle
   if(current.has(key))return false
   if(current.size>=limit){overflow=true;saturated=true;return false}
   current.add(key)
   return !saturated&&!previous.has(key)
  },
  endFrame(){const spare=previous;previous=current;current=spare;current.clear();if(!overflow&&previous.size===0)saturated=false},
  clear(){previous.clear();current.clear();saturated=false;overflow=false}
 }
}
