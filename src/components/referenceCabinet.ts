import * as THREE from 'three'

/** Open, carved boat cheeks. The real target aperture remains vertically open;
 * these cheeks sit outside the medal slab, never masquerading as a solid bin. */
export function createBoatTarget(width:number,index:number,material:THREE.Material,icon:THREE.Texture){
 const group=new THREE.Group();group.name='sanctuary-boat-target-'+index
 const h=width/2,s=new THREE.Shape()
 s.moveTo(-h-.18,.12);s.bezierCurveTo(-h-.05,-.34,-.34,-.41,0,-.41)
 s.bezierCurveTo(.34,-.41,h+.05,-.34,h+.18,.12)
 s.lineTo(h+.035,.04);s.bezierCurveTo(h-.08,-.19,.28,-.25,0,-.25)
 s.bezierCurveTo(-.28,-.25,-h+.08,-.19,-h-.035,.04);s.closePath()
 for(const z of [-.24,.16]){
  const cheek=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:.06,bevelEnabled:true,bevelThickness:.01,bevelSize:.012,bevelSegments:2,curveSegments:20}),material)
  // The front hull is formed, not a flat extrusion: a shallow convex belly
  // tapers toward the raised bow/stern, like hand-shaped timber.
  const positions=cheek.geometry.attributes.position
  for(let n=0;n<positions.count;n++){
   const x=positions.getX(n),y=positions.getY(n)
   const belly=Math.max(0,1-(x/(h+.18))**2)*Math.max(0,-y)*.13
   positions.setZ(n,positions.getZ(n)+(z>0?belly:-belly))
  }
  cheek.geometry.computeVertexNormals()
  cheek.position.z=z;cheek.name='boat-carved-cheek';cheek.castShadow=true;group.add(cheek)
 }
 // Hand-laid hull bands and rolled gunwales make this read as a boat,
 // not an extruded icon. They remain in front of the real open medal throat.
 const brass=new THREE.MeshStandardMaterial({color:'#e9c77b',metalness:.55,roughness:.42})
 const railPath=new THREE.CatmullRomCurve3([
  new THREE.Vector3(-h-.13,.075,.257),new THREE.Vector3(-h*.7,-.205,.257),
  new THREE.Vector3(0,-.265,.29),new THREE.Vector3(h*.7,-.205,.257),new THREE.Vector3(h+.13,.075,.257)])
 const rail=new THREE.Mesh(new THREE.TubeGeometry(railPath,28,.018,6,false),brass)
 rail.name='boat-rolled-gunwale';group.add(rail)
 const seamMaterial=new THREE.MeshStandardMaterial({color:'#966a63',roughness:.85})
 for(const offset of [0,.055]){
  const path=new THREE.CatmullRomCurve3([
   new THREE.Vector3(-h*.85,-.25-offset,.264),new THREE.Vector3(-h*.45,-.32-offset,.264),
   new THREE.Vector3(0,-.335-offset,.264),new THREE.Vector3(h*.45,-.32-offset,.264),new THREE.Vector3(h*.85,-.25-offset,.264)])
  const seams=new THREE.Mesh(new THREE.TubeGeometry(path,24,.005,4,false),seamMaterial)
  seams.name='boat-hand-laid-plank-seams';group.add(seams)
 }
 const badge=new THREE.Mesh(new THREE.PlaneGeometry(.24,.24),new THREE.MeshBasicMaterial({map:icon,transparent:true,depthWrite:false}))
 badge.position.set(0,-.32,.31);badge.name='boat-target-emblem';group.add(badge)
 group.userData.clearance={axis:'y',halfDepth:.14,contact:false};return group
}

/** Clear outer shaft, not a box over the field. The transfer-facing side,
 * back and front remain open. Shaft meshes receive exact triangle colliders; the enclosed wedge receives its exact convex hull. */
export function createReferenceBuildBay(x:number,z:number,_halfDepth:number){
 const group=new THREE.Group();group.name='reference-open-build-bay'
 const glass=new THREE.MeshPhysicalMaterial({color:'#e1fbff',transparent:true,opacity:.075,roughness:.08,metalness:.05,depthWrite:false,side:THREE.DoubleSide})
 // Outer RIGHT guard only: fore/aft shutters require the rear/front open.
 // Panel is outside the closed carriage edge. The transfer-facing side stays open.
 const back=new THREE.Mesh(new THREE.BoxGeometry(.035,4.3,2.54),glass)
 back.position.set(x+1.25,3.45,z);back.name='reference-bay-contact-right';group.add(back)
 const seam=new THREE.MeshStandardMaterial({color:'#c2e3e7',metalness:.72,roughness:.3})
 // A physically attached side porch supports the workshop visually and below
 // the carriage. All these meshes receive matching colliders in the caller.
 const porch=new THREE.Mesh(new THREE.BoxGeometry(2.7,.2,2.9),new THREE.MeshStandardMaterial({color:'#f6dcb4',roughness:.65}))
 porch.position.set(x-.1,1.0,z);porch.name='reference-bay-contact-side-porch';group.add(porch)
 for(const dz of [-1.27,1.27]){
  const foot=new THREE.Mesh(new THREE.BoxGeometry(.13,3.5,.13),seam)
  foot.position.set(x+1.17,-.85,z+dz);foot.name='reference-bay-contact-porch-leg';group.add(foot)
 }

 for(const dz of [-1.27,1.27]){
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,4.3,12),seam)
  post.position.set(x+1.29,3.45,z+dz);post.name='reference-bay-contact-shaft-seam';group.add(post)
 }
 // An enclosed transparent wedge, not an impossible low crawl-space.
 // The convex hull uses these SAME vertices: every top, side, end and base
 // is visible geometry. Stock is excluded from the footprint at creation.
 const coverX=2.65 // Existing right Tide delivery cover stays on the main field.
 const xs=[coverX-1.15,coverX-.58,coverX+.58,coverX+1.25],ridge=[0,.09,.09,0]
 const vertices:number[]=[],indices:number[]=[]
 for(const z0 of [-1.45,1.45])for(let i=0;i<4;i++)vertices.push(xs[i],(z0<0?.95:.35)+ridge[i],z0)
 for(const z0 of [-1.45,1.45])for(let i=0;i<4;i++)vertices.push(xs[i],0,z0)
 const quad=(a:number,b:number,c:number,d:number)=>indices.push(a,b,c,a,c,d)
 for(let i=0;i<3;i++){
  quad(i,i+4,i+5,i+1) // sloping top, outward +y
  quad(i+8,i+9,i+13,i+12) // closed base, outward -y
  quad(i,i+1,i+9,i+8) // rear end
  quad(i+4,i+12,i+13,i+5) // front end
 }
 quad(0,8,12,4);quad(3,7,15,11) // external sides
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals()
 const cover=new THREE.Mesh(geo,glass);cover.name='reference-bay-contact-solid-wedge'
 cover.userData.friction=.08;cover.userData.collider='convexHull';group.add(cover)

 return group
}
