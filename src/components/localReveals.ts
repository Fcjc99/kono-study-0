import * as THREE from 'three'
import {REVEAL_COLORS,type BonusReveals} from '../store/bonusReveals'
/** Short, depth-tested light accents at real mechanism coordinates, never proxy reward coins. */
export function createLocalReveals(scene:THREE.Scene,reveals:BonusReveals){
 const active:{group:THREE.Group;ring:THREE.Mesh;material:THREE.MeshBasicMaterial;age:number;quiet:boolean}[]=[]
 const geometry=new THREE.RingGeometry(.22,.245,32)
 const remove=(i:number)=>{const item=active[i];scene.remove(item.group);item.material.dispose();active.splice(i,1)}
 const unsubscribeMode=reveals.subscribe(()=>{if(reveals.mode==='off')while(active.length)remove(0)})
 const unsubscribe=reveals.subscribeLocal(event=>{
  if(!event.at||active.length>=3)return
  // One subdued ring per local event, never a particle shower or fake physical medal.
  const material=new THREE.MeshBasicMaterial({color:REVEAL_COLORS[event.kind],transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide,toneMapped:false})
  const ring=new THREE.Mesh(geometry,material),group=new THREE.Group()
  ring.rotation.x=-Math.PI/2;group.position.set(event.at.x,event.at.y+.035,event.at.z);group.add(ring);group.name='bonus-local-'+event.kind;scene.add(group)
  active.push({group,ring,material,age:0,quiet:reveals.reduced||reveals.mode==='subtle'})
 })
 return {
  update(dt:number){
   reveals.update(dt)
   if(reveals.mode==='off'){while(active.length)remove(0);return}
   for(let i=active.length-1;i>=0;i--){const item=active[i];item.age+=Number.isFinite(dt)?Math.max(0,Math.min(.05,dt)):0
    if(item.age>=.75){remove(i);continue}
    const t=item.age/.75;item.material.opacity=.5*(1-t)
    // Preference changes stop travelling accents immediately; rings simply fade in place.
    if(!item.quiet&&!reveals.reduced)item.ring.scale.setScalar(1+t*1.4)
   }
  },
  dispose(){unsubscribe();unsubscribeMode();while(active.length)remove(0);geometry.dispose();reveals.reset()}
 }
}
