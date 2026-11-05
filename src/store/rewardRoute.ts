/** Exclusive physical route ownership changes only at an empty, parked boundary.
 * Award FIFOs remain in their own machines; this only alternates safe batches. */
export type RouteOwner='tower'|'tide'|null
export function createRewardRoute(){
 let owner:RouteOwner=null,last:RouteOwner=null
 return {
  get owner(){return owner},
  update(tower:{safe:boolean;pending:boolean},tide:{safe:boolean;pending:boolean}){
   if(owner==='tower'&&!tower.safe||owner==='tide'&&!tide.safe)return owner
   if(owner){last=owner;owner=null}
   if(!tower.safe||!tide.safe)return owner
   owner=tower.pending&&tide.pending?(last==='tower'?'tide':'tower'):tower.pending?'tower':tide.pending?'tide':null
   return owner
  },
 }
}
