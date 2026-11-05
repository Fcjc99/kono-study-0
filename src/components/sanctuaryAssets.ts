import {CABINET} from '../store/motion'
import * as THREE from 'three'

/** Sanctuary joinery. These shells deliberately do NOT replace contact planes:
 * trays, floors, ramp rails and moving gates keep their exact collider geometry.
 * Pocket ornaments sit outside the edge-on medal slab |z| <= .055; their
 * vertically open throat is genuine geometry, never a black painted rectangle. */
const gold=()=>new THREE.MeshStandardMaterial({color:'#ffe08a',metalness:.75,roughness:.3})
function mesh(shape:THREE.Shape,depth:number,material:THREE.Material,name:string){
 const m=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:16}),material)
 m.name=name;m.castShadow=m.receiveShadow=true;return m
}
function tube(points:number[][],r:number,material:THREE.Material,name:string){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal')
 const m=new THREE.Mesh(new THREE.TubeGeometry(curve,32,r,8,false),material);m.name=name;m.castShadow=true;return m
}
/** Deep, open U profiles: bell lantern, five-point star crown, sweeping shrine eave.
 * The coin's passage is between front/rear cheeks, not through the ornament. */
export function createPocketMouth(width:number,index:number,material:THREE.Material,icon:THREE.Texture){
 const g=new THREE.Group();g.name=['lantern-through-mouth','star-through-mouth','shrine-through-mouth'][index]
 const h=width/2,s=new THREE.Shape()
 if(index===0){
  s.moveTo(-h-.1,.18);s.bezierCurveTo(-h-.22,-.02,-h-.13,-.28,-h*.6,-.36)
  s.quadraticCurveTo(0,-.5,h*.6,-.36);s.bezierCurveTo(h+.13,-.28,h+.22,-.02,h+.1,.18)
  s.lineTo(h-.025,.13);s.bezierCurveTo(h+.035,-.07,h-.08,-.15,h*.52,-.18)
  s.quadraticCurveTo(0,-.26,-h*.52,-.18);s.bezierCurveTo(-h+.08,-.15,-h-.035,-.07,-h+.025,.13)
 }else if(index===1){
  s.moveTo(-h-.2,.15);s.lineTo(-h*.62,.04);s.lineTo(-h*.75,-.23);s.lineTo(-.21,-.24);s.lineTo(0,-.47);s.lineTo(.21,-.24);s.lineTo(h*.75,-.23);s.lineTo(h*.62,.04);s.lineTo(h+.2,.15)
  s.lineTo(h+.04,-.07);s.lineTo(h*.85,-.35);s.lineTo(.27,-.39);s.lineTo(0,-.61);s.lineTo(-.27,-.39);s.lineTo(-h*.85,-.35);s.lineTo(-h-.04,-.07)
 }else{
  s.moveTo(-h-.23,.16);s.quadraticCurveTo(-h-.16,-.14,-h*.7,-.2);s.lineTo(-h*.6,-.34)
  s.quadraticCurveTo(0,-.44,h*.6,-.34);s.lineTo(h*.7,-.2);s.quadraticCurveTo(h+.16,-.14,h+.23,.16)
  s.quadraticCurveTo(h*.8,-.015,h*.55,-.045);s.quadraticCurveTo(0,-.15,-h*.55,-.045);s.quadraticCurveTo(-h*.8,-.015,-h-.23,.16)
 }
 s.closePath()
 for(const z of [-.24,.16]){const cheek=mesh(s,.08,material,g.name+'-carved-cheek');cheek.position.z=z;g.add(cheek)}
 const rim=gold()
 // Fine gold seams follow the actual authored outline, rather than an unrelated box.
 for(const z of [-.245,.245]){
  const outline=s.getPoints(48).map(p=>[p.x,p.y,z]);g.add(tube(outline,.015,rim,g.name+'-gold-inlay'))
 }
 // The icon sits on the front apron, below the clear route.
 const label=new THREE.Mesh(new THREE.PlaneGeometry(.23,.23),new THREE.MeshBasicMaterial({map:icon,transparent:true,depthWrite:false}))
 label.position.set(0,index===1?-.39:-.29,.251);label.name='secondary-pocket-emblem';g.add(label)
 g.userData.clearance={axis:'y',halfDepth:.14,contact:false};return g
}

export function createInputChute(material:THREE.Material){
 const chute=new THREE.Group();chute.name='open-lantern-input'
 // Fluted lyre cheeks, no opaque slot back. The board-medal slab remains open.
 const s=new THREE.Shape();s.moveTo(.37,-.27);s.bezierCurveTo(.57,-.09,.55,.46,.28,.55);s.lineTo(.24,.46);s.bezierCurveTo(.4,.32,.42,-.08,.31,-.24);s.closePath()
 const trim=gold()
 for(const sign of [-1,1]){
  const m=mesh(s,.14,material,'input-carved-cheek');m.scale.x=sign;m.position.z=.13;chute.add(m)
  // Fine rolled rim follows the shell rather than framing it with a box.
  chute.add(tube([[sign*.34,-.23,.28],[sign*.43,.06,.28],[sign*.43,.32,.28],[sign*.28,.49,.28]],.014,trim,'input-shell-rolled-rim'))
 }
 const inputGate=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.69,16),material);inputGate.rotation.z=Math.PI/2;inputGate.position.set(0,-.16,.20);inputGate.name='input-pulse-spindle';chute.add(inputGate)
 return {chute,inputGate}
}

/** Side hoppers: two sculpted open cheeks outside the existing contact rails.
 * No lid over the dropping medals and no fake black mouth. */
export function createRampMouth(material:THREE.Material,trim:THREE.Material,side:number){
 const g=new THREE.Group();g.name='open-petal-side-hopper'
 const s=new THREE.Shape();s.moveTo(-.52,-.25);s.bezierCurveTo(-.58,.03,-.38,.39,.05,.42);s.quadraticCurveTo(.35,.4,.38,.13);s.lineTo(.3,-.25);s.lineTo(.18,-.25);s.quadraticCurveTo(.31,.21,.04,.27);s.bezierCurveTo(-.25,.29,-.4,.02,-.38,-.25);s.closePath()
 for(const z of [-.64,.56]){const cheek=mesh(s,.08,material,'hopper-petal-cheek');cheek.scale.x=side;cheek.position.z=z;g.add(cheek)
  const inlay=tube(s.getPoints(32).map(p=>[side*p.x,p.y,z+.085]),.014,trim,'hopper-petal-inlay');g.add(inlay)}
 g.userData.clearance={axis:'x',halfDepth:.52,contact:false};return g
}
export function createSanctuaryPost(height:number,material:THREE.Material){
 const profile=[[.15,0],[.16,.08],[.105,.16],[.075,height*.34],[.08,height*.74],[.13,height-.15],[.16,height-.07],[.15,height]].map(p=>new THREE.Vector2(...p))
 const post=new THREE.Mesh(new THREE.LatheGeometry(profile,16),material);post.name='turned-dock-baluster';post.castShadow=true;return post
}
export function addSanctuaryCabinetTrim(scene:THREE.Group|THREE.Scene,opts:{halfWidth:number;frameMat:THREE.Material;woodMat:THREE.Material;goldMat:THREE.Material}){
 const {halfWidth:h,woodMat,goldMat}=opts
 const frameMat=new THREE.MeshStandardMaterial({color:'#c0d3d9',metalness:.85,roughness:.3})
 // A scalloped dock fascia sits BELOW the unchanged flat contact deck.
 const s=new THREE.Shape();s.moveTo(-h,0);s.lineTo(h,0);s.lineTo(h,-.16)
 for(let x=h;x>-h+.01;x-=.6){const end=Math.max(-h,x-.6);s.quadraticCurveTo((x+end)/2,-.39,end,-.16)}s.closePath()
 const fascia=mesh(s,.09,woodMat,'scalloped-dock-fascia');fascia.position.set(0,-.4,CABINET.front+.01);scene.add(fascia)
 // Tray walls are present in Rapier already. These exact-size faces make them
 // honest visible contact surfaces; all scalloped embellishment is outward.
 for(const x of [-h,h]){const wall=new THREE.Mesh(new THREE.BoxGeometry(.2,1.2,2.6),frameMat);wall.position.set(x,-1.6,CABINET.front+1.4);wall.name='tray-physical-side-wall';scene.add(wall)}
 const front=new THREE.Mesh(new THREE.BoxGeometry(h*2,1.2,.2),frameMat);front.position.set(0,-1.6,CABINET.front+2.7);front.name='tray-physical-front-wall';scene.add(front)
 const apron=mesh(s,.08,woodMat,'tray-scalloped-apron');apron.position.set(0,-2.2,CABINET.front+2.81);scene.add(apron)
 // Rolled external lip and turned finials stay outside the catcher volume.
 scene.add(tube([[-h-.14,-1.02,CABINET.front+.1],[-h-.16,-.94,CABINET.front+2.75],[0,-.94,CABINET.front+2.86],[h+.16,-.94,CABINET.front+2.75],[h+.14,-1.02,CABINET.front+.1]],.035,goldMat,'tray-exterior-rolled-lip'))
}

/** Curved handrail silhouette, restricted to the old rail's envelope. */
export function createDockRail(z0:number,z1:number,material:THREE.Material){
 const length=z1-z0
 return tube([[0,-.035,z0],[0,.025,z0+Math.min(.2,length*.2)],[0,.025,z1-Math.min(.2,length*.2)],[0,-.035,z1]],.065,material,'swept-dock-handrail')
}
export function createBallMagazine(material:THREE.Material,trim:THREE.Material){
 const g=createRampMouth(material,trim,-1);g.name='open-ball-lantern-magazine';g.scale.set(1.25,1.5,1);return g
}
/** Small scalloped underside and exterior rims for the contact-matched seesaw. */
export function dressSeesaw(group:THREE.Group,wood:THREE.Material,trim:THREE.Material){
 const s=new THREE.Shape();s.moveTo(-1.13,-.035);s.lineTo(.035,-.035);s.quadraticCurveTo(-.2,-.25,-.55,-.14);s.quadraticCurveTo(-.9,-.25,-1.13,-.035)
 for(const z of [-.55,.51]){const apron=mesh(s,.04,wood,'seesaw-carved-underskirt');apron.position.z=z;group.add(apron)}
 for(const z of [-.515,.515])group.add(tube([[-1.1,.09,z],[-.95,.27,z],[-.15,.27,z],[0,.09,z]],.018,trim,'seesaw-external-rim'))
}
/** Hollow bell tool: medals travel down its .40-radius bore. */
export function createTowerHead(material:THREE.Material){
 const points=[[.40,-.11],[.45,-.1],[.49,-.04],[.46,.02],[.42,.05],[.40,.17],[.365,.17],[.365,.03],[.40,-.11]].map(p=>new THREE.Vector2(...p))
 const m=new THREE.Mesh(new THREE.LatheGeometry(points,32),material);m.name='hollow-tower-construction-bell';return m
}
/** External two-post workshop: columns sit outside the live bed and sidewall,
 * avoiding both seeded stock and later field medals. All sculpted parts receive exact static mesh
 * colliders at integration. Rear eave only; nothing spans the coin shaft. */
export function createWorkshopPavilion(x:number,z:number,wood:THREE.Material,trim:THREE.Material){
 const g=new THREE.Group();g.name='sanctuary-open-workshop';g.position.set(x,0,z-1.08)
 for(const dz of [0,1.95]){
  const profile=[[.095,0],[.095,.13],[.073,.23],[.065,4.25],[.085,4.48],[.085,4.65]].map(p=>new THREE.Vector2(...p))
  const post=new THREE.Mesh(new THREE.LatheGeometry(profile,16),wood);post.position.set(-1.8,0,dz);post.name='workshop-contact-turned-post';post.castShadow=true;g.add(post)
 }
 const s=new THREE.Shape();s.moveTo(-2.02,4.38);s.quadraticCurveTo(-1.87,4.18,-.94,4.18);s.quadraticCurveTo(0,4.32,.94,4.18);s.quadraticCurveTo(1.27,4.18,1.42,4.38);s.lineTo(1.32,4.08);s.quadraticCurveTo(1.2,3.98,.9,4.02);s.quadraticCurveTo(0,4.16,-.9,4.02);s.quadraticCurveTo(-1.8,3.98,-1.92,4.08);s.closePath()
 const eave=mesh(s,.16,trim,'workshop-contact-swept-rear-eave');eave.position.set(0,.5,-.08);g.add(eave)
 g.add(tube([[-1.8,4.65,0],[-1.8,4.72,.4],[-1.8,4.72,1.55],[-1.8,4.65,1.95]],.065,trim,'workshop-contact-side-eave'))
 return g
}

/** Cosmetic carved face for the existing exact box collider. No top cover or
 * rail is added: medals retain the original unobstructed contact surface. */
export function createPusherFacade(width:number,height:number,depth:number){
 const g=new THREE.Group();g.name='sanctuary-carved-pusher-face'
 const w=width/2,top=height/2-.065,bottom=-height/2+.025
 const face=new THREE.Shape();face.moveTo(-w+.06,top);face.lineTo(w-.06,top)
 face.quadraticCurveTo(w,top,w,top-.07);face.lineTo(w,bottom+.08)
 face.quadraticCurveTo(w,bottom,w-.08,bottom)
 // A carved scallop rises into the cosmetic face; the true contact body is
 // retained behind it, so no new ledge is promised to the medal simulation.
 for(let x=w-.08;x>-w+.081;x-=.66){const end=Math.max(-w+.08,x-.66);face.quadraticCurveTo((x+end)/2,bottom+.075,end,bottom)}
 face.quadraticCurveTo(-w,bottom,-w,bottom+.08);face.lineTo(-w,top-.07);face.quadraticCurveTo(-w,top,-w+.06,top)
 const ceramic=new THREE.MeshStandardMaterial({color:'#76bca9',roughness:.68,metalness:.05})
 const panel=mesh(face,.012,ceramic,'pusher-glazed-ceramic-apron');panel.position.z=depth/2+.002;g.add(panel)
 // Shallow wave engraving, one pooled line geometry, not dozens of meshes.
 const vertices:number[]=[]
 for(let band=0;band<3;band++){
  const y=bottom+(top-bottom)*(.24+band*.24)
  for(let i=0;i<80;i++){
   const a=-w+.16+(width-.32)*i/80,b=-w+.16+(width-.32)*(i+1)/80
   const wave=(x:number)=>y+Math.sin(x*2.3+band*.8)*(top-bottom)*.075
   vertices.push(a,wave(a),depth/2+.02,b,wave(b),depth/2+.02)
  }
 }
 const engraving=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)),new THREE.LineBasicMaterial({color:'#dce8b7',transparent:true,opacity:.7}))
 engraving.name='pusher-hand-carved-wave-inlay';g.add(engraving)
 g.userData.cosmeticOnly=true;return g
}
