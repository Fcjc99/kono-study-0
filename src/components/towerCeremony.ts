import * as THREE from 'three'
import {TOWER,towerCoinSlot,type TowerStatus} from '../store/tower'
import type {TideStatus} from '../store/tide'
import {REVEAL_COLORS,type BonusReveals} from '../store/bonusReveals'

/** Visual-only accents. Reads measured mechanism poses and committed release events;
 * owns no physics bodies, reward timers, sound, camera or medal proxies. All GPU
 * objects are allocated once and bounded, including the 24 release star pool. */
export function createTowerCeremony(scene:THREE.Scene,reveals:BonusReveals){
 const root=new THREE.Group();root.name='workshop-ceremony';scene.add(root)
 const gold=new THREE.Color('#ffe39b'),dim=new THREE.Color('#88652f'),waiting=new THREE.Color('#ffb35c'),teal=new THREE.Color('#78f4d7')
 const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85,depthWrite:false,toneMapped:false})
 const rungGeometry=new THREE.BoxGeometry(1,.038,.025)
 const rungs=new THREE.InstancedMesh(rungGeometry,material,TOWER.batchMax);rungs.name='actual-built-layer-lights';rungs.count=0;rungs.frustumCulled=false;root.add(rungs)
 const beadGeometry=new THREE.SphereGeometry(.06,6,4)
 const beads=new THREE.InstancedMesh(beadGeometry,material,16);beads.name='moving-support-edge-lights';beads.count=0;beads.frustumCulled=false;root.add(beads)
 const crownMaterial=material.clone();crownMaterial.color.copy(gold)
 const crownGeometry=new THREE.TorusGeometry(.515,.026,6,32)
 const crown=new THREE.Mesh(crownGeometry,crownMaterial);crown.name='construction-head-light-crown';crown.rotation.x=Math.PI/2;crown.visible=false;root.add(crown)
 const layerMaterial=material.clone();layerMaterial.color.copy(gold)
 const layerGeometry=new THREE.TorusGeometry(.66,.018,5,36),layerRing=new THREE.Mesh(layerGeometry,layerMaterial)
 layerRing.name='completed-layer-rising-ring';layerRing.rotation.x=Math.PI/2;layerRing.visible=false;root.add(layerRing)
 const carriagePositions=new Float32Array(12*3),carriageGeometry=new THREE.BufferGeometry()
 carriageGeometry.setAttribute('position',new THREE.BufferAttribute(carriagePositions,3))
 const carriageMaterial=new THREE.LineBasicMaterial({color:gold,transparent:true,opacity:.5,depthWrite:false,toneMapped:false})
 const carriageTrail=new THREE.Line(carriageGeometry,carriageMaterial);carriageTrail.name='measured-carriage-travel-trail';carriageTrail.frustumCulled=false;carriageTrail.visible=false;root.add(carriageTrail)
 let carriageCount=0,carriageAge=99,layerBase=0
 const tideMaterial=material.clone();tideMaterial.color.copy(teal)
 const tideGeometry=new THREE.BoxGeometry(.8,.035,.035),gateLight=new THREE.Mesh(tideGeometry,tideMaterial);gateLight.name='actual-opening-tide-gate-light';gateLight.visible=false;root.add(gateLight)
 const positions=new Float32Array(24*6*3),colors=new Float32Array(24*6*3)
 const sparkGeometry=new THREE.BufferGeometry();sparkGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));sparkGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
 const sparkMaterial=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.9,depthWrite:false,toneMapped:false})
 const sparks=new THREE.LineSegments(sparkGeometry,sparkMaterial);sparks.name='committed-release-stars';sparks.frustumCulled=false;root.add(sparks)
 const pool=Array.from({length:24},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,color:new THREE.Color()}))
 const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3(),c=new THREE.Color()
 let previousBuilt=0,previousRequest:number|null=null,previousStage='idle',toolAge=99,readyAge=99,clock=0,slide=0,toolLift=0,disposed=false
 let lastX=NaN,lastY=NaN,lastGateZ=NaN,gatePulse=0,releaseCursor=0
 const quiet=()=>reveals.reduced||reveals.mode!=='full'
 const hide=()=>{root.visible=false;pool.forEach(s=>s.life=0);sparks.visible=false;toolLift=0;crown.visible=false;gateLight.visible=false;toolAge=readyAge=99;gatePulse=0;layerRing.visible=false;carriageTrail.visible=false;carriageCount=0}
 const unsubscribeMode=reveals.subscribe(()=>{if(reveals.mode==='off')hide();if(quiet()){pool.forEach(s=>s.life=0);sparks.visible=false;toolLift=0;layerRing.visible=false;carriageTrail.visible=false;carriageCount=0}})
 const unsubscribe=reveals.subscribeLocal(event=>{
  if(event.phase!=='release'||!event.at||quiet()||disposed)return
  // Callback is emitted after real rigid-body handoff, never award/ready timing.
  const count=event.kind==='tower'?((event.magnitude??0)>30?16:8):8
  for(let i=0;i<count;i++){
   const s=pool[releaseCursor++%pool.length],a=i/count*Math.PI*2
   s.life=.72;s.x=event.at.x;s.y=event.at.y+.1;s.z=event.at.z
   s.vx=Math.cos(a)*(.35+(i%3)*.12);s.vy=.65+(i%4)*.13;s.vz=Math.sin(a)*.4;s.color.set(REVEAL_COLORS[event.kind])
  }
 })
 return {
  get toolLift(){return toolLift},
  update(state:TowerStatus,dt:number,tide?:TideStatus){
   if(disposed)return
   const elapsed=Number.isFinite(dt)?Math.max(0,Math.min(.05,dt)):0
   if(elapsed===0){if(reveals.mode==='off')hide();return}
   const changed=state.requestId!==previousRequest||state.batchBuilt<previousBuilt
   if(changed){previousBuilt=0;toolAge=99;readyAge=99}
   const deposited=state.batchBuilt>previousBuilt
   if(deposited&&state.stage==='building')toolAge=0
   if(state.stage==='ready'&&previousStage!=='ready')readyAge=0
   previousBuilt=state.batchBuilt;previousRequest=state.requestId;previousStage=state.stage
   if(reveals.mode==='off'){hide();return}
   root.visible=true
   clock+=elapsed;toolAge+=elapsed;readyAge+=elapsed
   const soft=quiet(),building=state.stage==='building',supported=['idle','deploying','building','transferring','lowering','ready'].includes(state.stage)
   const a=state.supports[0],b=state.supports[1],x=a&&b?(a.x+b.x)/2:TOWER.x,top=a?a.y+TOWER.leafHalfHeight:TOWER.buildTop
   const moved=Number.isFinite(lastX)&&(Math.abs((a?.x??x)-lastX)+Math.abs(top-lastY)>1e-6)
   lastX=a?.x??x;lastY=top
   if(moved&&!state.blocked)slide+=elapsed*8
   carriageAge+=elapsed
   if(!soft&&moved&&!state.blocked&&['transferring','lowering'].includes(state.stage)){
    // Sample the measured support pose. Nothing leads or commands the carriage.
    for(let i=Math.min(11,carriageCount);i>0;i--)for(let k=0;k<3;k++)carriagePositions[i*3+k]=carriagePositions[(i-1)*3+k]
    carriagePositions[0]=x;carriagePositions[1]=top+.035;carriagePositions[2]=TOWER.z+TOWER.leafHalfDepth+.06
    carriageCount=Math.min(12,carriageCount+1);carriageAge=0;carriageGeometry.setDrawRange(0,carriageCount);carriageGeometry.attributes.position.needsUpdate=true
   }
   carriageTrail.visible=!soft&&carriageCount>1&&carriageAge<.35
   carriageMaterial.opacity=.5*Math.max(0,1-carriageAge/.35)
   if(carriageAge>=.35)carriageCount=0
   if(deposited&&building)layerBase=top+towerCoinSlot(Math.max(0,state.batchBuilt-1),state.batchSize).y
   layerRing.visible=!soft&&building&&!state.blocked&&toolAge<.48
   if(layerRing.visible){const t=toolAge/.48;layerRing.position.set(x,layerBase+.06+t*.26,TOWER.z);layerRing.scale.setScalar(1+t*.28);layerMaterial.opacity=.65*(1-t)}
   toolLift=!soft&&building&&!state.blocked&&toolAge<.22?.10*Math.sin(Math.PI*Math.min(1,toolAge/.22)):0
   crown.visible=building&&!!state.head
   if(state.head){crown.position.set(state.head.x,state.head.y+.34+toolLift,state.head.z);crownMaterial.opacity=soft?.45:.55+.4*Math.max(0,1-toolAge/.22)}
   // A narrow front-edge light on each genuine built layer, not a ring/coin proxy.
   // Derive row heights/widths from the same slot function as the actual medals.
   // Initial bay stock is real held cargo too. Show only physically completed
   // medals, never incoming deposits, queued rights or the intended final height.
   const visibleBuilt=Math.max(state.batchBuilt,state.stockHeld??0)
   let rows=0
   if(supported&&visibleBuilt){
    let first=0
    while(first<visibleBuilt){
     const slot=towerCoinSlot(first,state.batchSize);let end=first+1,minX=slot.x,maxX=slot.x,maxZ=slot.z
     while(end<visibleBuilt){const next=towerCoinSlot(end,state.batchSize);if(Math.abs(next.y-slot.y)>1e-7)break;minX=Math.min(minX,next.x);maxX=Math.max(maxX,next.x);maxZ=Math.max(maxZ,next.z);end++}
     p.set((minX+maxX)/2+x-TOWER.x,top+slot.y,maxZ+TOWER.radius+.025);scale.set(maxX-minX+TOWER.radius*1.4,1,1);m.compose(p,q,scale);rungs.setMatrixAt(rows,m)
     const readySweep=!soft&&readyAge<TOWER.holdFrames/60*.9?Math.max(0,1-Math.abs(slot.y/(Math.max(.01,towerCoinSlot(visibleBuilt-1,state.batchSize).y))-readyAge/(TOWER.holdFrames/60*.9))*4):0
     const newest=end===visibleBuilt,shine=soft?.55:Math.min(1,(rows%4===3?.52:.34)+(newest?.6*Math.max(0,1-toolAge/.5):0)+readySweep*.7)
     rungs.setColorAt(rows,c.copy(dim).lerp(state.blocked?waiting:gold,shine));rows++;first=end
    }
   }
   rungs.count=rows;rungs.instanceMatrix.needsUpdate=true;if(rungs.instanceColor)rungs.instanceColor.needsUpdate=true
   const active=(state.stage==='idle'&&visibleBuilt>0)||(state.stage!=='idle'&&state.stage!=='homing'&&state.stage!=='parking')
   beads.count=active?16:0
   if(active)for(let i=0;i<16;i++){
    const support=state.supports[Math.floor(i/8)],j=i%8;if(!support)continue
    p.set(support.x+(j/7-.5)*TOWER.leafHalfWidth*1.8,support.y+.018,support.z+TOWER.leafHalfDepth+.018)
    m.compose(p,q,scale.setScalar(1));beads.setMatrixAt(i,m)
    const chase=!soft&&moved&&!state.blocked&&(j+Math.floor(slide))%8<2
    beads.setColorAt(i,c.copy(dim).lerp(state.blocked?waiting:gold,soft?.55:chase?1:.5))
   }
   beads.instanceMatrix.needsUpdate=true;if(beads.instanceColor)beads.instanceColor.needsUpdate=true
   gatePulse=Math.max(0,gatePulse-elapsed)
   if(tide){const gate=tide.gates.find(g=>g.lane===tide.lane)
    if(gate){if(tide.stage==='opening'&&!tide.blocked&&Number.isFinite(lastGateZ)&&Math.abs(gate.position.z-lastGateZ)>1e-6)gatePulse=.25
     lastGateZ=gate.position.z;gateLight.position.set(gate.position.x,gate.position.y+gate.halfSize.y+.025,gate.position.z+gate.halfSize.z)
    }else lastGateZ=NaN
    gateLight.visible=!!gate&&gatePulse>0;tideMaterial.opacity=soft?.45:.55+.4*Math.sin(gatePulse/.25*Math.PI)
   }
   let live=false
   for(let i=0;i<pool.length;i++){
    const s=pool[i];s.life=Math.max(0,s.life-elapsed)
    if(soft)s.life=0
    if(s.life>0){live=true;s.x+=s.vx*elapsed;s.y+=s.vy*elapsed;s.z+=s.vz*elapsed;s.vy-=elapsed*.8}
    const radius=.045*s.life/.72
    for(let vertex=0;vertex<6;vertex++){
     const base=(i*6+vertex)*3,axis=Math.floor(vertex/2),sign=vertex%2?1:-1
     positions[base]=s.life?s.x+(axis===0?sign*radius:0):0;positions[base+1]=s.life?s.y+(axis===1?sign*radius:0):-99;positions[base+2]=s.z+(axis===2?sign*radius:0)
     colors[base]=s.color.r*s.life/.72;colors[base+1]=s.color.g*s.life/.72;colors[base+2]=s.color.b*s.life/.72
    }
   }
   sparks.visible=live;sparkGeometry.attributes.position.needsUpdate=true;sparkGeometry.attributes.color.needsUpdate=true
  },
  dispose(){if(disposed)return;disposed=true;unsubscribe();unsubscribeMode();scene.remove(root);for(const g of [rungGeometry,beadGeometry,crownGeometry,tideGeometry,sparkGeometry,layerGeometry,carriageGeometry])g.dispose();for(const mat of [material,crownMaterial,tideMaterial,sparkMaterial,layerMaterial,carriageMaterial])mat.dispose()}
 }
}
