import * as THREE from 'three'
import {type BonusReveals,type RevealEvent,type RevealMode} from '../store/bonusReveals'

export const EVENT_SCREEN={x:0,y:3.75,z:-6.24,width:6.6,height:2.1} as const

/** Read-only cinema. Every event is an actual machine event, never an award source. */
export function createScreenTimeline(){
 let current:RevealEvent|null=null,age=0
 const queue:RevealEvent[]=[]
 return {
  get current(){return current},get age(){return age},get pending(){return queue.length},
  reset(){current=null;age=0;queue.length=0},
  emit(event:RevealEvent){
   // Ordinary release pulses already animate the physical machine. The screen
   // reserves attention for awards, captures and the completed clear.
   if(event.phase==='release')return
   const copy={...event,at:event.at?{...event.at}:undefined}
   if(!current){current=copy;age=0}else if(queue.length<3)queue.push(copy)
  },
  update(dt:number){
   if(!current||!Number.isFinite(dt)||dt<=0)return false
   age+=Math.min(.05,dt)
   if(age>=3.6){current=queue.shift()??null;age=0}
   return true
  }
 }
}
export function screenMotion(age:number,mode:RevealMode,reduced:boolean){return mode==='off'||reduced?0:age*(mode==='subtle'?.25:1)}
export function screenCaption(event:RevealEvent|null){
 if(!event)return {title:'SANCTUARY',detail:'A little timing. A little luck.'}
 if(event.kind==='tower')return {title:'TOWER AWARDED',detail:`${event.magnitude??0} medals queued`}
 if(event.kind==='tide')return {title:'JACKPOT TIDE',detail:`${event.magnitude??0} medals queued`}
 if(event.kind==='ball')return {title:'BALL CAPTURED',detail:'A new challenge is queued'}
 return {title:'BOARD CLEARED',detail:'A fresh shore. A new beginning.'}
}

/** Pure choreography on the 1024 × 320 stage. All motion uses active game time. */
export function screenCharacterPose(kind:RevealEvent['kind']|null,age:number,mode:RevealMode,reduced:boolean){
 const t=screenMotion(age,mode,reduced),moving=mode!=='off'&&!reduced
 const frame=moving?Math.floor(t*6)%4:0
 if(kind==='tower')return {x:378+Math.min(t/1.5,1)*22,y:285-Math.abs(Math.sin(t*4))*14,frame,sprite:t>1.5?'cheer':'wave',tilt:Math.sin(t*3)*.035}
 if(kind==='tide')return {x:508+Math.sin(t*1.1)*68,y:241+Math.sin(t*2)*7,frame,sprite:'wave',tilt:Math.sin(t*2)*.07}
 if(kind==='ball')return {x:365+Math.min(t/1.4,1)*65,y:283-Math.abs(Math.sin(t*5))*14,frame,sprite:t>1.4?'cheer':'breathe',tilt:Math.sin(t*3)*.04}
 if(kind==='clear')return {x:510+Math.sin(t*1.3)*95,y:240+Math.sin(t*3)*8,frame,sprite:'cheer',tilt:Math.sin(t*2)*.12}
 // A complete little loop: explore the shore, chase a butterfly, hop and wave.
 const stroll=(1-Math.cos(t*Math.PI/5))/2,hop=Math.max(0,Math.sin((t%10-5.7)*Math.PI/1.1))
 return {x:398+178*stroll,y:285-(moving?Math.abs(Math.sin(t*4))*7+hop*24:0),frame,sprite:t%10>6?'wave':'breathe',tilt:Math.sin(t*2)*.045}
}

export const CINEMA_ASSETS={breathe:'/garden/kono/anim/breathe.webp',wave:'/garden/kono/anim/wave.webp',cheer:'/garden/kono/anim/cheer.webp',backdrop:'/games/cove/cinema-sanctuary.webp',butterfly:'/games/cove/butterfly.webp'} as const

/** Canvas-backed display stays inside its real cabinet bezel. No screen-space
 * overlay, independent animation clock, random outcomes or body/camera access. */
export function createMachineEventScreen(scene:THREE.Scene,reveals:BonusReveals){
 const timeline=createScreenTimeline(),canvas=document.createElement('canvas');canvas.width=1024;canvas.height=320
 const ctx=canvas.getContext('2d')!
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter
 const group=new THREE.Group();group.name='sanctuary-event-screen';group.position.set(EVENT_SCREEN.x,EVENT_SCREEN.y,EVENT_SCREEN.z)
 const frameGeometry=new THREE.BoxGeometry(EVENT_SCREEN.width+.16,EVENT_SCREEN.height+.16,.035),frameMaterial=new THREE.MeshStandardMaterial({color:'#b59b65',roughness:.4,metalness:.55})
 const bezel=new THREE.Mesh(frameGeometry,frameMaterial);bezel.position.z=-.025;group.add(bezel)
 const geometry=new THREE.PlaneGeometry(EVENT_SCREEN.width,EVENT_SCREEN.height),material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false})
 const screen=new THREE.Mesh(geometry,material);screen.name='sanctuary-event-display';screen.position.z=.012;group.add(screen);scene.add(group)
 let disposed=false,dirty=true,lastPaint=-1,idleAge=0,idlePaint=0,mode=reveals.mode,reduced=reveals.reduced
 const sprites=new Map<string,HTMLImageElement>()
 for(const [name,url] of Object.entries(CINEMA_ASSETS)){
  const img=document.createElement('img');img.onload=()=>{if(!disposed)dirty=true};img.src=url;sprites.set(name,img)
 }
 const unsubEvent=reveals.subscribeEvent(event=>{timeline.emit(event);dirty=true})
 const unsubMode=reveals.subscribe(()=>{if(mode!==reveals.mode||reduced!==reveals.reduced){mode=reveals.mode;reduced=reveals.reduced;timeline.reset();dirty=true}})
 const draw=()=>{
  paintSanctuaryScene(ctx,timeline.current,timeline.current?timeline.age:idleAge,reveals.mode,reveals.reduced,sprites)
  texture.needsUpdate=true;dirty=false;lastPaint=timeline.age;idlePaint=idleAge
 }
 draw()
 return {
  group,timeline,
  update(dt:number){if(disposed)return;const changed=timeline.update(dt);if(!timeline.current&&Number.isFinite(dt)&&dt>0)idleAge+=Math.min(.05,dt)
   const idleMotion=!timeline.current&&!reveals.reduced&&reveals.mode!=='off'&&idleAge-idlePaint>=1/12
   if(dirty||idleMotion||changed&&(timeline.age===0||!reveals.reduced&&reveals.mode!=='off'&&timeline.age-lastPaint>=1/30))draw()},
  dispose(){if(disposed)return;disposed=true;for(const img of sprites.values())img.onload=null;sprites.clear();unsubEvent();unsubMode();scene.remove(group);geometry.dispose();material.dispose();frameGeometry.dispose();frameMaterial.dispose();texture.dispose()}
 }
}

/** Shared painter: art is decorative and never writes outcomes, bodies or wallet totals. */
export function paintSanctuaryScene(ctx:CanvasRenderingContext2D,event:RevealEvent|null,age:number,mode:RevealMode,reduced:boolean,sprites:Map<string,HTMLImageElement>,captions=true,reward?:'coins'|'tower'|'portal',viewport={width:1024,height:320}){
 const {width,height}=viewport,t=screenMotion(age,mode,reduced),moving=mode!=='off'&&!reduced
 const ellipse=(x:number,y:number,rx:number,ry:number,color:string|CanvasGradient)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()}
 const art=(name:string)=>{const img=sprites.get(name);return img?.complete&&img.naturalWidth>0?img:null}
 ctx.clearRect(0,0,width,height)
 const backdrop=art('backdrop')
 if(backdrop){const zoom=Math.max(width/backdrop.naturalWidth,height/backdrop.naturalHeight),w=backdrop.naturalWidth*zoom,h=backdrop.naturalHeight*zoom;ctx.drawImage(backdrop,(width-w)/2,(height-h)/2,w,h)}
 else{const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#efbeac');sky.addColorStop(.54,'#a7d4cb');sky.addColorStop(.7,'#f8dca9');sky.addColorStop(1,'#e9c68d');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height)}
 // A fitting stage over a covering backdrop: never crop KONO on a wide tablet.
 const fit=Math.min(width/1024,height/320),stageLeft=-(width-1024*fit)/(2*fit),stageRight=1024-stageLeft,stageBottom=(height+320*fit)/(2*fit);ctx.save();ctx.translate((width-1024*fit)/2,(height-320*fit)/2);ctx.scale(fit,fit)
 // Soft moving reflections and drifting petals give the harbor depth without flashing.
 if(moving){
  ctx.save();ctx.globalAlpha=.23;ctx.strokeStyle='#fff9d8';ctx.lineWidth=2
  for(let i=0;i<7;i++){const x=130+i*125+Math.sin(t*.7+i)*9,y=163+i%3*12;ctx.beginPath();ctx.ellipse(x,y,23+Math.sin(t+i)*7,1.5,0,0,Math.PI);ctx.stroke()}ctx.restore()
 }
 const medal=(x:number,y:number,r:number,tilt=0)=>{ctx.save();ctx.translate(x,y);ctx.rotate(tilt);const gold=ctx.createLinearGradient(-r,0,r,0);gold.addColorStop(0,'#aa7130');gold.addColorStop(.22,'#f3c864');gold.addColorStop(.55,'#fff2b8');gold.addColorStop(1,'#b77a35');ellipse(0,3,r,r*.37,'#9a602d');ellipse(0,0,r,r*.37,gold);ctx.strokeStyle='#fff4c5';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,-.5,r*.8,r*.27,0,0,Math.PI*2);ctx.stroke();ctx.restore()}
 const pose=screenCharacterPose(reward==='coins'?'tower':event?.kind??null,age,mode,reduced)
 if(event?.kind==='tide'||event?.kind==='clear'){
  const water=ctx.createLinearGradient(0,220,0,320);water.addColorStop(0,'#8cddd022');water.addColorStop(.4,'#8cddd0bb');water.addColorStop(1,'#4aaabccc');ctx.fillStyle=water;ctx.beginPath();
  for(let x=stageLeft;x<=stageRight+8;x+=8){const y=239+Math.sin(x*.014-t*1.8)*10;x===stageLeft?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.lineTo(stageRight,stageBottom);ctx.lineTo(stageLeft,stageBottom);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#fff4dba6';ctx.lineWidth=3;ctx.beginPath();for(let x=stageLeft;x<=stageRight+8;x+=8){const y=241+Math.sin(x*.014-t*1.8)*10;x===stageLeft?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke()
 }
 // Contact shadow anchors the character to the painted sandy foreground.
 ctx.save();ctx.globalAlpha=.22;ellipse(pose.x,290,81,12,'#795341');ctx.restore()
 if(event?.kind==='tower'){
  ellipse(623,290,92,13,'#b48d5b66')
  const count=10,progress=moving?Math.min(count,t*5.6+1):count
  for(let i=0;i<count;i++){if(i>=progress)break;const settle=moving?Math.max(0,1-(progress-i))*32:0;medal(623,278-i*17-settle,69)}
 }else if(event?.kind==='tide'||event?.kind==='clear'){
  // KONO rides a little shell skiff. Round forms, raised rim and reflected wake.
  const x=pose.x,y=pose.y-3
  for(let i=0;i<3;i++){ctx.strokeStyle=['#fff9ddaa','#64c2c8aa','#edf9f4cc'][i];ctx.lineWidth=4-i;ctx.beginPath();ctx.ellipse(x,y+20+i*9,115+i*21,11+i*3,0,0,Math.PI);ctx.stroke()}
  const hull=ctx.createLinearGradient(x,y,x,y+42);hull.addColorStop(0,'#f5d59e');hull.addColorStop(1,'#b97753');ctx.fillStyle=hull;ctx.beginPath();ctx.moveTo(x-113,y);ctx.bezierCurveTo(x-80,y+54,x+80,y+54,x+113,y);ctx.quadraticCurveTo(x,y+17,x-113,y);ctx.fill();ellipse(x,y,113,13,'#f8dfb2');ellipse(x,y-1,96,7,'#c89366');
 }else if(event?.kind==='ball'&&reward!=='coins'){
  const q=Math.min(t/1.4,1),x=570+48*q,y=235-Math.abs(Math.sin(q*Math.PI))*76
  ellipse(x,289,32,7,'#8e706455');const glow=ctx.createRadialGradient(x-12,y-15,2,x,y,35);glow.addColorStop(0,'#fffbff');glow.addColorStop(.3,'#e6ccff');glow.addColorStop(.7,'#b29bdc');glow.addColorStop(1,'#7d65b1');ellipse(x,y,35,35,glow);ellipse(x-11,y-13,8,6,'#ffffffbb')
 }
 const sprite=art(pose.sprite)
 if(sprite){ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.tilt);const squash=moving?Math.sin(t*4)*.018:0;ctx.scale(1-squash,1+squash);ctx.imageSmoothingEnabled=true;ctx.drawImage(sprite,pose.frame*240,0,240,240,-108,-206,216,216);ctx.restore()}
 if(!event){
  const butterfly=art('butterfly'),bx=603+Math.sin(t*.9)*74,by=116+Math.cos(t*1.3)*32
  if(butterfly){ctx.save();ctx.translate(bx,by);ctx.rotate(Math.sin(t*2)*.2);const flutter=moving?.6+Math.abs(Math.sin(t*7))*.4:1;ctx.scale(flutter,1);ctx.drawImage(butterfly,-24,-22,48,44);ctx.restore()}
 }
 if(reward==='coins'){
  for(let i=0;i<11;i++){const q=moving?Math.min(1,Math.max(0,(t-i*.045)/1.5)):.55;medal(620+(i-5)*24*q,249-145*Math.sin(q*Math.PI)+(i%3)*11,16,Math.sin(t*3+i)*.18)}
 }
 if(reward==='portal'){
  const x=683,y=137,r=55+(moving?Math.sin(t*3)*3:0),g=ctx.createRadialGradient(x,y,8,x,y,85);g.addColorStop(0,'#fff7d488');g.addColorStop(.65,'#ffd58f44');g.addColorStop(1,'#ffd58f00');ellipse(x,y,88,93,g);ctx.strokeStyle='#fff2b1';ctx.lineWidth=7;ctx.beginPath();ctx.ellipse(x,y,r,r*1.13,0,0,Math.PI*2);ctx.stroke()
  ctx.fillStyle='#fff6cd';ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rad=i%2?14:30;const px=x+Math.cos(a)*rad,py=y+Math.sin(a)*rad;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.fill()
 }
 if(moving){
  const count=event?12:5
  for(let i=0;i<count;i++){const phase=(t*.12+i/count)%1,x=190+i*57+Math.sin(t*1.1+i)*25,y=20+phase*270;ctx.save();ctx.translate(x,y);ctx.rotate(t*.7+i);ctx.globalAlpha=(event?.75:.45)*Math.sin(phase*Math.PI);ellipse(0,0,4,7,i%2?'#ffe7b0':'#f8b7c6');ctx.restore()}
 }
 ctx.restore()
 if(captions&&event){const label=event.kind==='tower'?`TOWER · ${event.magnitude??0}`:event.kind==='tide'?`TIDE · ${event.magnitude??0}`:event.kind==='ball'?'BALL':'CLEAR';ctx.save();ctx.textAlign='right';ctx.font='600 20px sans-serif';ctx.fillStyle='#513d3a';ctx.fillText(label,width-26,31);ctx.restore()}
}
