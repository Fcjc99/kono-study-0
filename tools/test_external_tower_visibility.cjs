// Production camera and CPU projection, not GPU appearance evidence.
const assert=require('node:assert/strict'),THREE=require('three'),{start}=require('./production_runtime.cjs');
const hull=points=>{const p=points.map(v=>({x:v.x,y:v.y})).sort((a,b)=>a.x-b.x||a.y-b.y),cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);const half=a=>{const r=[];for(const v of a){while(r.length>1&&cross(r.at(-2),r.at(-1),v)<=0)r.pop();r.push(v)}return r};return [...half(p).slice(0,-1),...half([...p].reverse()).slice(0,-1)]};
const overlaps=(a,b)=>{for(const p of [a,b])for(let i=0;i<p.length;i++){const v=p[i],w=p[(i+1)%p.length],axis={x:-(w.y-v.y),y:w.x-v.x},aa=a.map(q=>q.x*axis.x+q.y*axis.y),bb=b.map(q=>q.x*axis.x+q.y*axis.y);if(Math.max(...aa)<Math.min(...bb)||Math.max(...bb)<Math.min(...aa))return false}return true};
(async()=>{for(const [width,height] of [[305,373.016],[390,427.8],[524,295],[560,747],[1080,790]]){
 const h=await start(width,height);h.advance(2);h.rt.placeCamera();h.rt.scene.updateMatrixWorld(true);
 const {TOWER:T,towerCoinSlot}=h.load('src/store/tower.ts'),{CABINET:K}=h.load('src/store/motion.ts'),F=h.load('src/components/framing.ts');
 assert.ok(T.x-T.ringRadius-T.radius>K.halfWidth+.05,'all construction coins must be beyond the board right edge');
 const project=p=>new THREE.Vector3(...p).project(h.rt.camera),coins=[];
 for(let i=0;i<T.batchMax;i++){const p=towerCoinSlot(i,T.batchMax);for(const dx of [-T.radius,T.radius])for(const dy of [-T.halfHeight,T.halfHeight])for(const dz of [-T.radius,T.radius])coins.push(project([p.x+dx,T.buildTop+p.y+dy,p.z+dz]));}
 assert.ok(coins.every(p=>p.x<.93&&p.x>-.93&&p.y<1-100/height&&p.y>-1+68/height),'full building tower stays inside usable stage');
 const bayLeft=Math.min(...coins.map(p=>p.x)),deckRight=Math.max(...[K.front,-6.45].flatMap(z=>[0,.6].map(y=>project([K.halfWidth,y,z]).x)));
 const towerHull=hull(coins),deckHulls=[[-6.45,K.front,0],[-6.45,-2.15,.6]].map(([back,front,y])=>hull([-K.halfWidth,K.halfWidth].flatMap(x=>[back,front].map(z=>project([x,y,z])))));
 assert.ok(deckHulls.every(deck=>!overlaps(towerHull,deck)),'construction silhouette must not overlap either projected coin-deck surface');
 for(const point of F.REFERENCE_BUILD_BOUNDS){const p=project(point);assert.ok(Math.abs(p.x)<.93&&p.y<1-100/height+.001&&p.y>-1+68/height-.001,'bay framing clipped');}
 const left=project([-K.halfWidth,0,0]),right=project([K.halfWidth,0,0]);
 console.log('PASS external construction visibility',JSON.stringify({viewport:[width,height],bayX:T.x,horizontalExtentOverlapPx:Math.max(0,(deckRight-bayLeft)*width/2),deckSurfaceOverlap:false,bedWidthPx:(right.x-left.x)*width/2}));h.cleanup();
}})().catch(e=>{console.error(e);process.exit(1)});
