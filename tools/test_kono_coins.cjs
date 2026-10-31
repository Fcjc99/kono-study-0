// KONO’s coins (src/store/konoCoins.ts): earned from work and play, spent in the shops, folded by month without counting twice.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+(path.extname(name)?'':fs.existsSync(path.resolve(path.dirname(file),name+'.ts'))?'.ts':'.tsx'))):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,JSON,structuredClone,crypto:{randomUUID},console,window:{addEventListener(){},removeEventListener(){},dispatchEvent(){}},Event:class{}})
 return module.exports
}
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const {bondPoints,bondLevel,giftsAt,bondLine,GIFTS,MAX_HEARTS}=load('src/store/konoBond.ts')
const coins=load('src/store/konoCoins.ts'),care=load('src/store/konoCare.ts'),{foundCounts}=load('src/store/konoFinds.ts')
const {coinBalance,PER_FINISHED,PER_WISH,PER_FIND}=coins,shops=load('src/store/konoShops.ts')
const at=(day,h=12)=>day+'T'+String(h).padStart(2,'0')+':00:00.000Z'

test('balance: 10 per thing finished, 15 per wish, 5 per find, plus coins won, minus things bought',()=>{
 const log=[{id:'wish-2026-10-01',kind:'wish',at:at('2026-10-01')},{id:'f1',kind:'find',at:at('2026-10-01'),item:'acorn'},{id:'spin-2026-10-02',kind:'coin',at:at('2026-10-02'),item:'spin',n:50},{id:'b1',kind:'buy',at:at('2026-10-02'),item:'food:cookie',n:12}]
 assert.equal(coinBalance(3,log),3*PER_FINISHED+PER_WISH+PER_FIND+50-12)
 assert.equal(coinBalance(0,[]),0)
})
test('the prize wheel, a surprise and a quest are each once a day (a fixed ID; a second device’s entry is the same one)',()=>{
 const now=new Date('2026-10-22T15:00:00Z')
 let state=care.addCareEvent(undefined,'p',coins.spinEvent('2026-10-22',1,now),now)
 state=care.addCareEvent(state,'p',coins.spinEvent('2026-10-22',5,now),now)
 assert.equal(state.log.length,1);assert.equal(state.log[0].n,coins.WHEEL[1])
 assert.ok(coins.spunToday(state.log,'2026-10-22'));assert.ok(!coins.spunToday(state.log,'2026-10-23'))
 const q=coins.questToday('p','2026-10-22')
 state=care.addCareEvent(state,'p',coins.questEvent('2026-10-22',q,now),now)
 state=care.addCareEvent(state,'p',coins.questEvent('2026-10-22',q,now),now)
 assert.equal(state.log.filter(e=>e.item==='quest').length,1)
})
test('arcade: three coin rounds a day, coins by score (capped), then just for fun',()=>{
 const now=new Date('2026-10-22T15:00:00Z');let log=[]
 assert.equal(coins.roundsLeft(log,'2026-10-22'),3)
 for(let i=0;i<3;i++){const e=coins.gameEvent(log,'2026-10-22','catch',12,now);assert.ok(e);assert.equal(e.n,24);log=care.addCareEvent({profileId:'p',log},'p',e,now).log}
 assert.equal(coins.roundsLeft(log,'2026-10-22'),0)
 assert.equal(coins.gameEvent(log,'2026-10-22','catch',12,now),null)
 assert.equal(coins.roundsLeft(log,'2026-10-23'),3,'a new day, new rounds')
 assert.equal(coins.gameCoins('catch',999),50);assert.equal(coins.gameCoins('memory',6),48);assert.equal(coins.gameCoins('memory',40),5);assert.equal(coins.gameCoins('peekaboo',0),0)
 assert.equal(coins.gameCoins('chase',7),21);assert.equal(coins.gameCoins('tumble',240),30);assert.equal(coins.gameCoins('tumble',12),5);assert.equal(coins.gameCoins('sled',9),18)
})
test('shops: the same stock all day on every device; food includes this week’s favorite; owned outfits and found treasures aren’t sold',()=>{
 const a=shops.foodStock('2026-10-22'),b=shops.foodStock('2026-10-22')
 assert.deepEqual(a,b);assert.equal(a.length,5);assert.equal(a[0].id,care.favoriteSnack('2026-10-22').id)
 const outfits=shops.outfitStock(new Set(['bow','beanie']),'2026-07-01')
 assert.ok(!outfits.some(o=>o.id==='bow'||o.id==='beanie'));assert.ok(!outfits.some(o=>o.id==='witch'),'Halloween outfits only sell in their season')
 assert.equal(outfits.filter(o=>o.sale).length,1)
 const t=shops.treasureStock(new Map([['acorn',1]]),'2026-07-01')
 assert.equal(t.length,3);assert.ok(!t.some(x=>x.id==='acorn'))
})
test('things bought: snacks wait with KONO’s snacks, outfits are owned, treasures count as found',()=>{
 const now=new Date('2026-10-22T15:00:00Z')
 const food=shops.foodStock('2026-10-22')[0],outfit=shops.outfitStock(new Set(),'2026-10-22').find(o=>o.id==='crown'),find=shops.treasureStock(new Map(),'2026-10-22')[0]
 let state={profileId:'p',log:[]}
 for(const [i,item] of [food,outfit,find].entries())state=care.addCareEvent(state,'p',coins.buyEvent('buy-'+i,item,now),now)
 const p=care.pantry([],state.log,now)
 assert.equal(p.length,1);assert.equal(p[0].treat.id,food.id);assert.equal(p[0].taskId,'buy-0')
 assert.ok(coins.boughtOutfits(state.log).has('crown'))
 assert.equal(foundCounts(state.log).get(find.id),1)
 assert.equal(coinBalance(0,state.log),-(food.price+outfit.price+find.price))
})
test('old months fold into one entry each, the balance doesn’t change, and an old device’s copy of a folded month never counts twice',()=>{
 const old=[{id:'game-2026-06-01-1',kind:'coin',at:at('2026-06-01'),item:'game:catch',n:30},{id:'spin-2026-06-02',kind:'coin',at:at('2026-06-02'),item:'spin',n:50},{id:'b-food',kind:'buy',at:at('2026-06-03'),item:'food:cookie',n:12},{id:'b-hat',kind:'buy',at:at('2026-06-03'),item:'outfit:crown',n:600}]
 const before=coinBalance(0,old),now=new Date('2026-10-22T15:00:00Z')
 const state=care.addCareEvent({profileId:'p',log:old},'p',{id:'spin-2026-10-22',kind:'coin',at:now.toISOString(),item:'spin',n:10},now)
 assert.equal(coinBalance(0,state.log),before+10)
 assert.ok(state.log.some(e=>e.id==='bank-2026-06'&&e.n===68))
 assert.ok(state.log.some(e=>e.id==='b-hat'),'an outfit bought is kept as it is')
 assert.ok(!state.log.some(e=>e.id==='b-food'||e.id==='spin-2026-06-02'))
 // A device that hadn't folded yet merges its loose June entries back in: still the same balance.
 assert.equal(coinBalance(0,[...state.log,...old.filter(e=>!state.log.some(x=>x.id===e.id))]),before+10)
})
test('reading a saved log keeps coin entries with whole numbers and drops broken ones',()=>{
 const read=care.readCareState({log:[{id:'c1',kind:'coin',at:at('2026-10-01'),item:'spin',n:25},{id:'c2',kind:'coin',at:at('2026-10-01'),n:'lots'},{id:'c3',kind:'buy',at:at('2026-10-01'),item:'food:cake',n:2.5},{id:'bank-2026-01',kind:'bank',at:at('2026-01-15'),n:-40}]},'p')
 assert.deepEqual(read.log.map(e=>e.id),['c1','bank-2026-01'])
 assert.equal(read.log[0].n,25)
})
test('surprises come about every other day and the quest asks for a real snack worth three times its price',()=>{
 let days=0;for(let d=1;d<=60;d++){const day='2026-'+(d<=31?'08-'+String(d).padStart(2,'0'):'09-'+String(d-31).padStart(2,'0'));if(coins.surpriseToday('plan-1',day))days++}
 assert.ok(days>15&&days<45,'surprise days: '+days)
 const q=coins.questToday('plan-1','2026-10-22');assert.ok(care.ALL_TREATS.some(t=>t.id===q.treat.id));assert.equal(q.reward,coins.foodPrice(q.treat)*3)
})
const looks={...load('src/store/konoLooks.ts'),...load('src/store/konoFurniture.ts')}
test('colors: KONO’s pictures in a color, only for frames that come in colors; the latest pick is worn if it’s owned',()=>{
 assert.equal(looks.paintPose('/garden/kono/happy.webp','starry'),'/garden/kono/colors/starry/happy.webp')
 assert.equal(looks.paintPose('/garden/kono/walk-up-02.webp','ghost'),'/garden/kono/colors/ghost/walk-up-02.webp')
 assert.equal(looks.paintPose('/garden/kono/shadow.webp','starry'),'/garden/kono/shadow.webp')
 assert.equal(looks.paintPose('/garden/kono/happy.webp',null),'/garden/kono/happy.webp')
 const log=[{id:'b',kind:'buy',at:at('2026-10-01'),item:'paint:starry',n:400},{id:'p1',kind:'paint',at:at('2026-10-01',13),item:'rainbow'},{id:'p2',kind:'paint',at:at('2026-10-01',14),item:'starry'}]
 const owned=looks.ownedPaints(log)
 assert.equal(JSON.stringify([...owned]),JSON.stringify(['starry']))
 assert.equal(looks.wornPaint(log,owned),'starry')
 assert.equal(looks.wornPaint([...log,{id:'p3',kind:'paint',at:at('2026-10-01',15),item:''}],owned),null,'back to classic')
 assert.equal(looks.wornPaint(log.slice(1,2),owned),null,'a color not owned isn’t worn')
})
test('furniture: each one bought is one more to place; what’s in the room isn’t in storage; pieces stay on the floor (wall pieces can go up the walls)',()=>{
 const log=[{id:'a',kind:'buy',at:at('2026-10-01'),item:'furn:bed',n:120},{id:'b',kind:'buy',at:at('2026-10-01'),item:'furn:bed',n:120},{id:'c',kind:'buy',at:at('2026-10-01'),item:'furn:round-rug',n:0}]
 const owned=looks.ownedFurniture(log)
 assert.equal(owned.get('bed'),2)
 const storage=looks.inStorage(owned,[{id:'h1',item:'bed',x:0.5,y:0.7}])
 assert.equal(JSON.stringify(storage.map(s=>[s.furniture.id,s.count])),JSON.stringify([['round-rug',1],['bed',1]]))
 const bed=looks.FURNITURE.find(f=>f.id==='bed'),clock=looks.FURNITURE.find(f=>f.id==='wall-clock')
 assert.ok(looks.clampSpot(bed,0.5,0.1).y>=0.3);assert.ok(looks.clampSpot(clock,0.5,0.15).y<0.2);assert.ok(looks.clampSpot(bed,-1,2).x>0&&looks.clampSpot(bed,-1,2).y<=0.96)
})
test('KONO’s house is read back safely (odd pieces dropped, numbers kept in range), and adding to the care log keeps the house',()=>{
 const read=care.readCareState({log:[],house:[{id:'h1',item:'bed',x:0.3,y:5,size:9,flip:true},{id:'',item:'bed'},{id:'h2',item:'x'.repeat(50)},'nope']},'p')
 assert.equal(JSON.stringify(read.house),JSON.stringify([{id:'h1',item:'bed',x:0.3,y:1,size:2,flip:true}]))
 assert.equal(care.readCareState({log:[]},'p').house,undefined)
 const now=new Date('2026-10-22T15:00:00Z')
 const next=care.addCareEvent(read,'p',{id:'pet1',kind:'pet',at:now.toISOString()},now)
 assert.equal(JSON.stringify(next.house),JSON.stringify(read.house))
})
test('room styles: classic is always owned, a style bought is owned, and the room picked is read back safely',()=>{
 assert.equal(JSON.stringify([...looks.ownedRooms([{id:'b',kind:'buy',at:at('2026-10-01'),item:'room:mint',n:200}])]),JSON.stringify(['classic','mint']))
 assert.equal(looks.roomSrc('mint'),'/garden/house/room-mint.webp');assert.equal(looks.roomSrc('classic'),'/garden/house/room.webp');assert.equal(looks.roomSrc('nope'),'/garden/house/room.webp')
 assert.equal(care.readCareState({log:[],room:'mint'},'p').room,'mint')
 assert.equal(care.readCareState({log:[],room:'../x'},'p').room,undefined)
 const now=new Date('2026-10-22T15:00:00Z')
 assert.equal(care.addCareEvent({profileId:'p',log:[],room:'mint'},'p',{id:'pet1',kind:'pet',at:now.toISOString()},now).room,'mint','adding to the care log keeps the room')
})
test('world: each land’s market sells its own 4 pieces, KONO Town’s furniture shop sells none of them, and a look around finds something from that land',()=>{
 const world=load('src/store/konoWorld.ts')
 for(const land of ['beach','forest','snow'])assert.equal(shops.furnitureStock(land).length,4,land)
 assert.ok(!shops.furnitureStock().some(i=>['hammock','hearth','leaf-armchair'].includes(i.id)))
 const beach=world.LANDS.find(l=>l.id==='beach')
 const f=world.landFind(beach,new Map([['shell',1]]),0)
 assert.ok(beach.finds.includes(f.id)&&f.id!=='shell','prefers something not found yet')
 const now=new Date('2026-10-15T15:00:00Z')
 let state=care.addCareEvent(undefined,'p',world.lookEvent('beach','2026-10-15','shell',now),now)
 state=care.addCareEvent(state,'p',world.lookEvent('beach','2026-10-15','pebble',now),now)
 assert.equal(state.log.length,1,'one look around a day, even from two devices')
 assert.ok(world.lookedToday(state.log,'beach','2026-10-15'));assert.ok(!world.lookedToday(state.log,'forest','2026-10-15'))
})
test('land games: each land has its own game and booth; Acorn tumble clears touching groups of 2+, scores n × n, lets pieces fall and closes empty columns',()=>{
 const games=load('src/store/landGames.ts'),world=load('src/store/konoWorld.ts')
 assert.equal(world.LANDS.map(l=>games.LAND_GAMES[l.id].id).join(),'chase,tumble,sled')
 for(const l of world.LANDS){const b=games.LAND_GAMES[l.id].booth;assert.ok(b.x>0&&b.x<1&&b.y>0&&b.y<1);assert.ok(Math.hypot(b.x-l.stall.x,b.y-l.stall.y)>0.2,l.id+': the booth stands away from the market')}
 let id=0;const col=kinds=>kinds.map(kind=>({id:++id,kind}))
 // Columns bottom-up: two acorns (0) touching across columns 0 and 1, a lone leaf (3) on top of column 0.
 const cols=[col([0,3]),col([0]),col([1,2])]
 assert.equal(games.clearGroup(cols,0,1),null,'a lone piece doesn’t clear')
 assert.equal(games.clearGroup(cols,2,0),null)
 const after=games.clearGroup(cols,0,0)
 assert.equal(after.points,4)
 assert.equal(JSON.stringify(after.cols.map(c=>c.map(t=>t.kind))),'[[3],[1,2]]','the leaf falls, and the empty column closes up')
 assert.equal(games.hasMoves(after.cols),false)
 assert.equal(games.hasMoves([col([1,1])]),true)
 const big=games.clearGroup([col([2,2,2]),col([2,0,0])],0,0)
 assert.equal(big.points,16,'a group of 4 scores 16')
 const board=games.tumbleBoard()
 assert.equal(board.length,games.COLS);assert.ok(board.every(c=>c.length===games.ROWS));assert.equal(new Set(board.flat().map(t=>t.id)).size,games.COLS*games.ROWS)
})
test('KONO blast: a full row or column clears (both at once count as two lines), points reward big clears and streaks, and the game knows when nothing fits',()=>{
 const b=load('src/store/blockBlast.ts'),dot=b.SHAPES.find(s=>s.id==='dot'),three=b.SHAPES.find(s=>s.id==='three')
 assert.ok(b.SHAPES.length>=25);assert.ok(b.SHAPES.every(s=>s.cells.length>=1&&s.cells.some(([r])=>r===0)&&s.cells.some(([,c])=>c===0)),'every piece starts at its top-left corner')
 let g=b.emptyGrid()
 for(let c=0;c<7;c++)g[c]=1
 for(let r=1;r<8;r++)g[r*8+7]=2
 assert.equal(b.fits(g,dot,0,7),true);assert.equal(b.fits(g,dot,0,0),false,'a filled square');assert.equal(b.fits(b.emptyGrid(),three,0,6),false,'off the edge')
 const done=b.place(g,{shape:dot,color:3},0,7)
 assert.equal(done.lines,2,'row 1 and column 8 together');assert.equal(done.cleared.length,15)
 assert.ok(done.grid.every(v=>v===null),'the board is empty again')
 assert.equal(b.place(g,{shape:dot,color:3},0,0),null)
 assert.equal(b.movePoints(3,0,4),3,'no clear, no bonus');assert.equal(b.movePoints(1,2,0),41);assert.equal(b.movePoints(1,1,2),31,'a streak adds 10 per clearing move before')
 const full=Array(64).fill(0);assert.equal(b.anyFits(full,dot),false);full[9]=null;assert.equal(b.anyFits(full,dot),true);assert.equal(b.anyFits(full,three),false)
 let i=0;const rolls=[0,0.5,0.99,0.2,0.4,0.6];const hand=b.deal(()=>rolls[i++%rolls.length])
 assert.equal(hand.length,3);assert.equal(hand[0].shape.id,'dot');assert.ok(hand.every(p=>p.color>=0&&p.color<b.COLORS))
 assert.equal(coins.gameCoins('blast',300),25)
 assert.equal(coins.gameCoins('meow',6),30,'a 6 × 6 Meowdoku');assert.equal(coins.gameCoins('gems',36000),30);assert.equal(coins.gameCoins('candy',1800),30)
 // Coins as you play: lines × lines, times the combo, up to 75 a day.
 assert.equal(coins.blastCoins(1,0),1);assert.equal(coins.blastCoins(2,0),4);assert.equal(coins.blastCoins(2,2),12);assert.equal(coins.blastCoins(1,9),5,'the combo tops out at ×5')
 const now=new Date('2026-10-22T15:00:00Z');let log=[]
 for(let i=0;i<9;i++){const e=coins.blastEvent(log,'2026-10-22',3,0,new Date(now.getTime()+i));if(e)log=[...log,e]}
 assert.equal(coins.blastToday(log,'2026-10-22'),75,'nine big clears hit the daily limit exactly');assert.equal(new Set(log.map(e=>e.id)).size,log.length)
 assert.equal(coins.blastEvent(log,'2026-10-22',1,0,now),null);assert.ok(coins.blastEvent(log,'2026-10-23',1,0,now))
})
test('Meowdoku: every puzzle has exactly one answer; boards grow with the level; a cat touching another, or two in a row, column or patch, is wrong',()=>{
 const m=load('src/store/meowdoku.ts')
 assert.equal(m.sizeFor(1),5);assert.equal(m.sizeFor(4),6);assert.equal(m.sizeFor(12),7)
 for(const n of [5,6,7]){const p=m.makePuzzle(n,m.seeded(n*31));assert.equal(p.regions.length,n*n);assert.equal(new Set(p.regions).size,n);assert.equal(m.countSolutions(p,5),1,n+' × '+n+' has one answer')}
 const p={n:4,regions:[0,0,1,1, 0,0,1,1, 2,2,3,3, 2,2,3,3]}
 assert.equal(m.check(p,new Set([0,5])).wrong.size,2,'touching corner to corner')
 assert.equal(m.check(p,new Set([0,1])).wrong.size,2,'same row (and patch)')
 assert.equal(m.check(p,new Set([0,6])).wrong.size,0)
 // Any real answer passes: solve by brute force and check it.
 const q=m.makePuzzle(5,m.seeded(7));let answer=null
 const go=(r,cats)=>{if(answer)return;if(r===5){if(m.check(q,new Set(cats)).solved)answer=cats;return}for(let c=0;c<5;c++)go(r+1,[...cats,r*5+c])}
 go(0,[]);assert.ok(answer,'the puzzle has an answer that check() accepts')
 assert.equal(JSON.stringify(m.solve(q)),JSON.stringify(answer),'solve() finds the one answer (for hints)')
 // Auto-✕: a cat rules out its row, column, patch and neighbors; clashes light the shared row, column or patch.
 const out=m.ruledOut(p,new Set([0]));assert.ok([1,2,3,4,8,12,5].every(i=>out.has(i)));assert.ok(!out.has(6)&&!out.has(0))
 assert.equal([...m.clashes(p,new Set([0,2]))].sort((a,b)=>a-b).join(),'0,1,2,3','two cats in row 1')
 assert.equal(m.clashes(p,new Set([0,6])).size,0)
})
test('match-3: fresh boards have no lines and a move; Sweet swap makes striped (4), wrapped (L/T) and color bombs (5); Gem blitz makes flame (4), star (L/T), hypercube (5) and supernova (6) gems; combinations and the finale',()=>{
 const g=load('src/store/match3.ts'),seeded=load('src/store/meowdoku.ts').seeded
 for(const mode of ['candy','gems']){const mk=g.maker(mode,seeded(3)),b=g.freshBoard(mk);assert.equal(b.length,64);assert.equal(g.lines(b).length,0);assert.ok(g.hasMove(b));assert.ok(b.every(p=>p.kind<(mode==='gems'?7:6)))}
 let id=1000;const P=(k,special)=>({id:++id,kind:k,...(special?{special}:{})})
 // A filler that makes no lines of its own: kinds 1–5 in a shifting pattern.
 const fill=()=>Array.from({length:64},(_,i)=>P(1+((Math.floor(i/8)*2+i%8)%5)))
 const steady=mode=>g.maker(mode,seeded(42))
 // Row 0: A A b A … — swapping (0,2) with (1,2) (an A) makes four across.
 const four=()=>{const b=fill();b[0]=P(0);b[1]=P(0);b[3]=P(0);b[10]=P(0);return b}
 assert.equal(g.lines(fill()).length,0,'the filler has no lines')
 let f=g.play(four(),2,10,steady('candy'))
 assert.ok(f[0].made.some(x=>x.special==='col'),'four across in Sweet swap: a candy striped down (it clears its column)')
 assert.equal(f[0].cleared.length,3)
 f=g.play(four(),2,10,steady('gems'))
 assert.ok(f[0].made.some(x=>x.special==='area'),'four in Gem blitz: a flame gem')
 const five=()=>{const b=four();b[4]=P(0);return b}
 assert.ok(g.play(five(),2,10,steady('candy'))[0].made.some(x=>x.special==='color'),'five: a color bomb')
 const six=()=>{const b=five();b[5]=P(0);return b}
 assert.ok(g.play(six(),2,10,steady('gems'))[0].made.some(x=>x.special==='nova'),'six in Gem blitz: a supernova')
 // An L: A at (0,0),(0,1) and down column 2 at (1,2),(2,2); swapping (0,2) in from (0,3) makes the corner.
 const ell=()=>{const b=fill();b[0]=P(0);b[1]=P(0);b[3]=P(0);b[10]=P(0);b[18]=P(0);return b}
 f=g.play(ell(),2,3,steady('candy'))
 assert.ok(f[0].made.some(x=>x.special==='area'),'an L in Sweet swap: a wrapped candy')
 assert.ok(g.play(ell(),2,3,steady('gems'))[0].made.some(x=>x.special==='cross'),'an L in Gem blitz: a star gem')
 // A striped candy going off takes its whole row; a wrapped one explodes twice.
 const striped=()=>{const b=fill();b[0]=P(0,'row');b[1]=P(0);b[3]=P(0);b[10]=P(0);return b}
 f=g.play(striped(),2,10,steady('candy'))
 assert.ok(f[0].effects.some(e=>e.type==='row'&&e.cells.length===8),'the striped candy clears its row')
 const wrapped=()=>{const b=fill();b[0]=P(0,'area');b[1]=P(0);b[3]=P(0);b[10]=P(0);return b}
 f=g.play(wrapped(),2,10,steady('candy'))
 assert.equal(f.filter(x=>x.effects.some(e=>e.type==='area')).length,2,'a wrapped candy explodes, then explodes again after the fall')
 // Combinations: two striped make a cross; a color bomb and a candy clear all of that color; two bombs clear the board.
 const pair=(x,y)=>{const b=fill();b[27]=x;b[28]=y;return b}
 f=g.play(pair(P(2,'row'),P(3,'col')),27,28,steady('candy'))
 assert.ok(f[0].effects.some(e=>e.type==='cross'),'two striped: a cross')
 f=g.play(pair(P(2,'area'),P(3,'area')),27,28,steady('candy'))
 assert.ok(f[0].effects.some(e=>e.type==='area'&&e.cells.length===25),'two wrapped: a 5 × 5 blast')
 const bomb=pair(P(0,'color'),P(1)),ones=bomb.filter(p=>p.kind===1).length
 f=g.play(bomb,27,28,steady('candy'))
 assert.ok(f[0].cleared.length>=ones,'a color bomb and a candy: every candy of that color')
 f=g.play(pair(P(0,'color'),P(0,'color')),27,28,steady('candy'))
 assert.equal(f[0].cleared.length,64,'two color bombs clear the board')
 f=g.play(pair(P(0,'color'),P(4,'row')),27,28,steady('candy'))
 assert.ok(f[0].effects.filter(e=>e.type==='row'||e.type==='col').length>=3,'a color bomb and a striped candy: that whole color goes off striped')
 // Every move leaves a full board with a move to make.
 for(const mode of ['candy','gems']){const mk=g.maker(mode,seeded(11));let b=g.freshBoard(mk);for(let k=0;k<25;k++){const mv=g.findMove(b);assert.ok(mv);const fr=g.play(b,mv[0],mv[1],mk);b=fr.at(-1).board;assert.equal(b.filter(Boolean).length,64);assert.ok(g.hasMove(b))}}
 // The finale: moves left turn into striped candies that all go off.
 const fin=g.finale(g.freshBoard(g.maker('candy',seeded(5))),g.maker('candy',seeded(6)),5)
 assert.ok(fin.some(x=>x.effects.length>=5));assert.equal(fin.at(-1).board.filter(Boolean).length,64)
 assert.equal(g.candyStars(1000,1000),1);assert.equal(g.candyStars(2000,1000),3);assert.equal(g.candyLevel(2).jelly>0,true);assert.equal(g.candyLevel(1).jelly,0)
 assert.equal(g.jellyFor(4,seeded(2)).size,g.candyLevel(4).jelly)
 // Gem blitz: three is 250 points; Blazing speed makes a match burst like a flame gem; 12 gems in a move bring a ×2.
 const three=()=>{const b=fill();b[0]=P(0);b[1]=P(0);b[10]=P(0);return b}
 const plain=steady('gems');assert.equal(g.play(three(),2,10,plain)[0].points,250)
 const hot=steady('gems');hot.blazing=true;const hf=g.play(three(),2,10,hot)[0];assert.ok(hf.effects.some(e=>e.type==='area')&&hf.cleared.length>3,'Blazing speed bursts')
 const big=steady('gems'),bf=g.play(g.freshBoard(big).map((p,i)=>i===0?{...p,special:'color'}:p),0,1,big)
 if(bf.reduce((k,f)=>k+f.cleared.length,0)>=12)assert.ok(bf.at(-1).board.some(p=>p&&p.bonus==='mult'&&p.mult===2),'a big move drops in a ×2')
})
test('match-3 in real time: the opening rain settles; a swap slides and clears; a swap that makes nothing slides back; a striped candy’s beam travels; Gem blitz takes a swap while the board is still falling; the board always refills',()=>{
 const g=load('src/store/match3.ts'),L=load('src/store/match3live.ts'),seeded=load('src/store/meowdoku.ts').seeded
 const run=(rt,ms)=>{for(let t=0;t<ms;t+=16)L.step(rt,16)}
 const calm=(rt,max=20000)=>{let t=0;while(!L.settled(rt)&&t<max){L.step(rt,16);t+=16}return t}
 let id=5000;const P=(k,special)=>({id:++id,kind:k,...(special?{special}:{})})
 const fill=()=>Array.from({length:64},(_,i)=>P(1+((Math.floor(i/8)*2+i%8)%5)))
 for(const mode of ['candy','gems']){
  const mk=g.maker(mode,seeded(7)),rt=L.live(mk,g.freshBoard(mk))
  assert.ok(L.view(rt).every(l=>l.y<0),'the pieces start above the board');assert.ok(!L.settled(rt))
  assert.ok(calm(rt)<3000,'the opening rain lands in under 3 seconds');assert.ok(L.view(rt).every(l=>l.y===Math.floor(l.at/8)))
  // Twenty moves: each settles to a full board with a move left.
  for(let k=0;k<20;k++){const mv=L.hintFor(rt);assert.ok(mv);assert.equal(L.trySwap(rt,mv[0],mv[1]),'swap');calm(rt);assert.equal(L.boardOf(rt).filter(Boolean).length,64);assert.ok(g.hasMove(L.boardOf(rt)))}
  assert.ok(rt.events.some(e=>e.t==='match'))
 }
 // A swap that makes nothing slides over and back, and the board is as it was.
 const mk=g.maker('candy',seeded(9)),b=fill();b[0]=P(0);b[1]=P(0);b[10]=P(0)
 let rt=L.live(mk,b,false)
 const before=L.boardOf(rt).map(p=>p.id).join()
 assert.equal(L.trySwap(rt,40,41),'nope');run(rt,100);assert.ok(L.view(rt).some(l=>l.at===40&&l.x>0),'mid-way it has slid over');calm(rt);assert.equal(L.boardOf(rt).map(p=>p.id).join(),before)
 // A match: the pieces clear (merging into nothing) and new ones fall in.
 rt.events.length=0;assert.equal(L.trySwap(rt,2,10),'swap');run(rt,200)
 assert.ok(rt.events.some(e=>e.t==='match'&&e.cells.length===3&&e.level===1));calm(rt);assert.equal(L.boardOf(rt).filter(Boolean).length,64)
 // A striped candy across row 0: its beam reaches the far end later than its neighbor.
 const s=fill();s[0]=P(0,'row');s[1]=P(0);s[3]=P(0);s[10]=P(0)
 rt=L.live(g.maker('candy',seeded(4)),s,false);L.trySwap(rt,2,10);run(rt,900)
 const f=rt.events.find(e=>e.t==='fire');assert.ok(f&&f.e.type==='row');assert.ok(f.delays[f.e.cells.indexOf(7)]>f.delays[f.e.cells.indexOf(1)],'the beam travels')
 // Sweet swap: moving a striped candy is always a move, and it goes off where it lands.
 {const lone=fill();lone[27]=P(2,'row');rt=L.live(g.maker('candy',seeded(4)),lone,false);assert.equal(L.trySwap(rt,27,35),'swap');run(rt,1100)
  assert.ok(rt.events.some(e=>e.t==='fire'&&e.e.type==='row'&&e.e.at===35),'the moved striped candy clears its new row');calm(rt);assert.equal(L.boardOf(rt).filter(Boolean).length,64)}
 // Boosters: the hammer smashes one candy (a special one goes off); the free swap swaps two that make no line.
 {rt=L.live(g.maker('candy',seeded(4)),fill(),false);assert.ok(L.smash(rt,20));run(rt,400);assert.ok(rt.events.some(e=>e.t==='clear'&&e.at===20));calm(rt);assert.equal(L.boardOf(rt).filter(Boolean).length,64)
  const ids=L.boardOf(rt).map(p=>p.id);assert.equal(L.trySwap(rt,40,41),'nope');calm(rt)
  assert.equal(L.trySwap(rt,40,41,true),'swap');calm(rt);const after=L.boardOf(rt).map(p=>p.id);assert.ok(after[40]===ids[41]&&after[41]===ids[40],'the free swap stays swapped')
  const st=fill();st[20]=P(2,'row');rt=L.live(g.maker('candy',seeded(4)),st,false);L.smash(rt,20);run(rt,1100);assert.ok(rt.events.some(e=>e.t==='fire'&&e.e.type==='row'),'a smashed striped candy goes off')}
 // Before it goes off, a special charges up (it swells and glows); two specials swapped together pull in first.
 rt=L.live(g.maker('candy',seeded(4)),s,false);L.trySwap(rt,2,10);run(rt,250)
 assert.ok(L.view(rt).some(l=>l.charge>0&&l.p.special==='row')&&!rt.events.some(e=>e.t==='fire'),'the striped candy charges up first')
 {const pb=fill();pb[27]=P(2,'row');pb[28]=P(3,'col');rt=L.live(g.maker('candy',seeded(3)),pb,false);L.trySwap(rt,27,28);run(rt,450)
  assert.equal(L.view(rt).filter(l=>l.charge>0).length,2,'the two striped candies pull together');assert.ok(!rt.events.some(e=>e.t==='fire'));run(rt,400);assert.ok(rt.events.some(e=>e.t==='fire'&&e.e.type==='cross'&&e.combo))}
 // Four in a line: the others slide into the spot and a special appears there.
 const four=fill();four[0]=P(0);four[1]=P(0);four[3]=P(0);four[10]=P(0)
 rt=L.live(g.maker('gems',seeded(4)),four,false);L.trySwap(rt,2,10);run(rt,200)
 assert.ok(L.view(rt).some(l=>l.clearing&&l.at===0),'clearing');run(rt,400);assert.ok(rt.events.some(e=>e.t==='made'&&e.special==='area'),'a flame gem')
 // Gem blitz in real time: right after a match, while new gems are still dropping in, another swap goes.
 const gm=g.maker('gems',seeded(12));rt=L.live(gm,g.freshBoard(gm),false)
 const m1=L.hintFor(rt);L.trySwap(rt,m1[0],m1[1]);run(rt,250);assert.ok(!L.settled(rt))
 const idle=L.view(rt).filter(l=>!l.clearing&&l.y===Math.floor(l.at/8)).map(l=>l.at),pair=idle.flatMap(a=>idle.includes(a+1)&&a%8<7?[[a,a+1]]:[])[0]
 assert.ok(pair);assert.ok(L.trySwap(rt,pair[0],pair[1])!==null,'pieces at rest can be swapped while the rest of the board moves')
 calm(rt);assert.equal(L.boardOf(rt).filter(Boolean).length,64)
 // Two color bombs together clear the whole board; a wrapped candy goes off twice; the finale sets off every special.
 const bb=fill();bb[27]=P(0,'color');bb[28]=P(2,'color');rt=L.live(g.maker('candy',seeded(3)),bb,false);L.trySwap(rt,27,28);calm(rt)
 assert.ok(rt.events.filter(e=>e.t==='clear').length>=62,'two color bombs clear the board')
 const w=fill();w[0]=P(0,'area');w[1]=P(0);w[3]=P(0);w[10]=P(0);rt=L.live(g.maker('candy',seeded(3)),w,false);L.trySwap(rt,2,10);calm(rt)
 assert.equal(rt.events.filter(e=>e.t==='fire'&&e.e.type==='area').length,2,'a wrapped candy explodes, falls, and explodes again')
 rt=L.live(g.maker('candy',seeded(5)),g.freshBoard(g.maker('candy',seeded(5))),false);assert.ok(L.blowAll(rt,4)>=4);calm(rt);assert.ok(rt.events.filter(e=>e.t==='fire').length>=4);assert.equal(L.boardOf(rt).filter(Boolean).length,64)
})
test('KONO Flow: shuffled sets of seven, moving and turning with wall kicks, hard drop and lock, clearing rows (100/300/500/800 × level), hold once per shape, T-spins, Flow stacks rows and clears them all at once, and game over',()=>{
 const f=load('src/store/flow.ts'),seeded=load('src/store/meowdoku.ts').seeded
 const g=f.newGame(seeded(7)),first=[g.piece.kind,...g.queue.slice(0,6)]
 assert.equal(new Set(first).size,7,'every shape once in the first set of seven')
 const x0=g.piece.x;assert.ok(f.move(g,-1));assert.equal(g.piece.x,x0-1)
 for(let k=0;k<10;k++)f.move(g,-1);assert.ok(f.cellsOf(g.piece).every(([x])=>x>=0),'the wall stops it')
 // Turning against the wall kicks it back in (or it just turns), and four turns come back round.
 const before=g.piece.rot;if(g.piece.kind!=='O'){f.rotate(g,1);f.rotate(g,1);f.rotate(g,1);f.rotate(g,1);assert.equal(g.piece.rot,before)}
 // Hard drop: it lands where its ghost is and locks; a new shape comes in.
 const ghost=f.ghostOf(g),kind=g.piece.kind;f.hardDrop(g)
 assert.ok(f.cellsOf(ghost).every(([x,y])=>g.board[y*f.COLS+x]===f.KINDS.indexOf(kind)+1),'locked where the ghost showed')
 assert.ok(g.piece&&g.score>0)
 // Gravity: it falls a row in about a second at level 1, and locks half a second after landing.
 const g2=f.newGame(seeded(3)),y0=g2.piece.y;f.tick(g2,1010);assert.equal(g2.piece.y,y0+1)
 for(let t=0;t<40000&&g2.board.every(c=>!c);t+=16)f.tick(g2,16);assert.ok(g2.board.some(c=>c),'it fell and locked on its own')
 // Clearing: fill the bottom row but a gap, drop an I in it upright: one row (100 at level 1).
 const fill=(g,rows,gap)=>{for(const y of rows)for(let x=0;x<f.COLS;x++)if(x!==gap)g.board[y*f.COLS+x]=2}
 const g3=f.newGame(()=>0);g3.piece={kind:'I',rot:1,x:-2+0,y:0};fill(g3,[f.H-1,f.H-2,f.H-3,f.H-4],0)
 g3.events.length=0;const s0=g3.score;f.hardDrop(g3)
 const clr=g3.events.find(e=>e.t==='clear');assert.ok(clr&&clr.count===4,'four rows at once');assert.ok(clr.perfect,'the well is empty: a perfect clear');assert.equal(clr.points,800+2000)
 assert.equal(g3.lines,4);assert.ok(g3.score>=s0+800)
 // Hold: once per shape.
 const g4=f.newGame(seeded(5)),k4=g4.piece.kind;assert.ok(f.holdPiece(g4));assert.equal(g4.hold,k4);assert.ok(!f.holdPiece(g4),'only once until it locks')
 f.hardDrop(g4);assert.ok(f.holdPiece(g4));assert.equal(g4.piece.kind,k4,'the held shape comes back')
 // A T-spin double: a T turned into a T-shaped slot two rows deep.
 const g5=f.newGame(()=>0),B=f.H-1
 for(const y of [B,B-1])for(let x=0;x<f.COLS;x++)g5.board[y*f.COLS+x]=3
 g5.board[B*f.COLS+4]=0;g5.board[(B-1)*f.COLS+3]=0;g5.board[(B-1)*f.COLS+4]=0;g5.board[(B-1)*f.COLS+5]=0;g5.board[(B-2)*f.COLS+3]=3
 g5.piece={kind:'T',rot:0,x:3,y:B-3};g5.lastRotate=false
 // Turn it into the slot: from pointing up over it, a turn to point down drops it in with a kick.
 g5.piece={kind:'T',rot:3,x:3,y:B-2};assert.ok(f.rotate(g5,-1)||f.rotate(g5,1));g5.events.length=0
 f.hardDrop(g5);const ts=g5.events.find(e=>e.t==='clear');assert.ok(ts&&ts.tspin,'a T-spin');assert.ok(ts.points>=400)
 // Flow: a quarter of the meter gives 5 seconds; rows filled stack at the bottom and clear together at the end.
 const g6=f.newGame(()=>0);g6.flow=0.5;assert.ok(f.startFlow(g6));assert.equal(g6.flowMs,10000)
 fill(g6,[f.H-1,f.H-2],0);g6.piece={kind:'I',rot:1,x:-2,y:0};f.hardDrop(g6)
 assert.equal(g6.flowLines,2);assert.ok(g6.board.slice((f.H-2)*f.COLS).every(c=>c===f.FLOW_CELL),'the rows wait at the bottom')
 const y6=g6.piece.y;f.tick(g6,3000);assert.equal(g6.piece.y,y6,'time stands still in Flow')
 g6.events.length=0;f.tick(g6,8000);const fe=g6.events.find(e=>e.t==='flowEnd');assert.ok(fe&&fe.lines===2&&fe.points>0)
 assert.ok(!g6.board.some(c=>c===f.FLOW_CELL),'they all cleared');assert.ok(!f.startFlow(g6),'the meter is spent')
 // Game over: the well filled to the top.
 const g7=f.newGame(seeded(1));for(let y=0;y<f.H;y++)for(let x=0;x<f.COLS;x++)if(x!==9||y<4)g7.board[y*f.COLS+x]=y<f.HIDDEN+1?0:5
 for(let k=0;k<6&&!g7.over;k++)f.hardDrop(g7);assert.ok(g7.over,'no room: game over')
 assert.ok(f.gravityMs(10)<f.gravityMs(1)/5,'faster each level')
 // Modes: Sprint is done at 40 lines; Ultra at three minutes; Zen never ends (a full well clears).
 const sp=f.newGame(()=>0,'sprint');sp.lines=36;for(const y of [f.H-1,f.H-2,f.H-3,f.H-4])for(let x=1;x<f.COLS;x++)sp.board[y*f.COLS+x]=2
 sp.piece={kind:'I',rot:1,x:-2,y:0};sp.events.length=0;f.hardDrop(sp);assert.ok(sp.over&&sp.events.some(e=>e.t==='done'),'40 lines: Sprint done')
 const ul=f.newGame(seeded(2),'ultra');f.tick(ul,f.ULTRA_MS-10);assert.ok(!ul.over);f.tick(ul,20);assert.ok(ul.over&&ul.events.some(e=>e.t==='done'),'three minutes: Ultra done')
 const zn=f.newGame(seeded(1),'zen');for(let y=0;y<f.H;y++)for(let x=0;x<f.COLS;x++)if(x!==9||y<4)zn.board[y*f.COLS+x]=y<f.HIDDEN+1?0:5
 for(let k=0;k<6;k++)f.hardDrop(zn);assert.ok(!zn.over&&zn.events.some(e=>e.t==='zen')&&zn.piece,'Zen: the well clears and play goes on')
 // The soundtrack: a new one every three levels, five in all.
 assert.deepEqual([1,3,4,6,7,9,10,12,13,30].map(f.musicPart),[1,1,2,2,3,3,4,4,5,5])
})
test('KONO Hop: KONO falls and a flap lifts it, pipes come in with a gap, flying through a gap scores, touching a pipe or the ground ends the run; medals at 10/20/30/40',()=>{
 const f=load('src/store/flappy.ts'),half=()=>0.5
 let fl=f.newFlight(),y0=fl.y
 fl=f.step(fl,10,half).flight;assert.ok(fl.y>y0,'gravity pulls KONO down')
 const up=f.step(f.flap(fl),1,half).flight;assert.ok(up.y<fl.y,'a flap lifts KONO')
 // Keep KONO in the middle of every gap (as a perfect player would): points, no crash.
 let run=f.newFlight(),points=0
 for(let k=0;k<3000&&!run.dead;k++){const next=run.pipes.find(p=>p.x+f.FLAP.pipeW>f.FLAP.x-f.FLAP.r);const r=f.step({...run,y:next?next.gapY:run.y,vy:0},1,Math.random);run=r.flight;if(r.scored)points++}
 assert.ok(!run.dead&&points>=15&&run.score===points,'flying through gaps scores ('+points+')')
 let fall=f.newFlight();for(let k=0;k<400&&!fall.dead;k++)fall=f.step(fall,1,half).flight
 assert.ok(fall.dead,'never flapping hits the ground')
 assert.ok(f.crash({x:f.FLAP.x-10,gapY:300,scored:false,color:0},100),'inside the top pipe');assert.ok(!f.crash({x:f.FLAP.x-10,gapY:300,scored:false,color:0},300))
 assert.equal(f.flapMedal(9),null);assert.equal(f.flapMedal(10).name,'Bronze');assert.equal(f.flapMedal(25).name,'Silver');assert.equal(f.flapMedal(41).name,'Diamond')
})
test('KONO.io: steering curves (no grid turns); a loop out of your land claims the trail and what it closes in; touching a trail cuts it; your own trail or the edge ends you; bots play on their own',()=>{
 const P=load('src/store/paper.ts'),seeded=load('src/store/meowdoku.ts').seeded,N=P.N
 const a=P.newArena(seeded(3),0),me=a.players[0],mine=()=>a.own.filter(x=>x===1).length
 assert.ok(mine()>=25&&mine()<=45,'a round patch to start ('+mine()+')')
 // Turning is gradual: one tick can't swing right round.
 Object.assign(me,{angle:0,want:0});P.steer(me,Math.PI);P.tick(a);assert.ok(Math.abs(me.angle)<=P.TURN+1e-9,'a steady turn')
 // Walk a loop: right out of home, down, left, then up back in.
 a.own.fill(0);a.trail.fill(0);for(let y=20;y<=26;y++)for(let x=20;x<=26;x++)a.own[y*N+x]=1
 Object.assign(me,{x:25.5,y:23.5,angle:0,want:0,trail:[],path:[]})
 const go=(ang,n)=>{for(let k=0;k<n;k++){P.steer(me,ang);P.tick(a)}}
 go(0,16);assert.ok(me.trail.length>3,'outside, KONO leaves a trail');assert.ok(me.path.length>0,'and the trail has a path to draw')
 go(Math.PI/2,20);go(Math.PI,22)
 const before=mine();go(-Math.PI/2,30)
 assert.ok(me.alive,'home safe');assert.equal(me.trail.length,0);assert.ok(mine()>before+30,'the loop and what it closes in are claimed ('+before+' → '+mine()+')')
 assert.equal(a.own[29*N+29],1,'a square inside the loop is claimed')
 // Off the edge.
 Object.assign(me,{x:0.4,y:50.5,angle:Math.PI,want:Math.PI});P.tick(a);assert.ok(!me.alive,'off the map ends you')
 // A cut: a bot heads down across your trail.
 const b=P.newArena(seeded(5),1),you=b.players[0],bot=b.players[1]
 b.own.fill(0);b.trail.fill(0)
 for(let y=20;y<=22;y++)for(let x=20;x<=22;x++)b.own[y*N+x]=1
 for(let y=60;y<=62;y++)for(let x=60;x<=62;x++)b.own[y*N+x]=2
 const tr=[30*N+23,30*N+24,30*N+25,30*N+26,30*N+27];Object.assign(you,{x:27.5,y:30.5,angle:0,want:0,trail:[...tr],path:[[23.5,30.5],[27.5,30.5]]});for(const i of tr)b.trail[i]=1
 Object.assign(bot,{x:25.5,y:29.3,angle:Math.PI/2,want:Math.PI/2,trail:[],path:[]});bot.bot.goals=[[25.5,45]]
 for(let k=0;k<4&&you.alive;k++)P.tick(b)
 assert.ok(!you.alive,'your trail was cut');assert.equal(bot.kills,1);assert.equal(b.trail.filter(x=>x===1).length,0,'the cut trail is gone')
 assert.ok(b.log.some(e=>e.who===1&&e.by===bot.id&&e.x>0),'the cut is logged with where it happened')
 // A crowd of bots plays for a while without breaking the map, and grows land.
 const c=P.newArena(seeded(9),6)
 const start=P.shares(c)
 for(let k=0;k<1500;k++){c.players[0].alive=false;P.tick(c)}
 const share=P.shares(c);assert.ok([...share.values()].reduce((x,y)=>x+y,0)<=100.0001)
 assert.ok(c.players.slice(1).some(p=>share.get(p.id)>start.get(p.id)*1.5),'bots grow their land')
})
test('KONO.io team battle: four a side, a team shares its land, teammates cross each other’s trails, the cut come back on their team’s land, and two minutes decide it',()=>{
 const P=load('src/store/paper.ts'),seeded=load('src/store/meowdoku.ts').seeded,N=P.N
 const a=P.newArena(seeded(4),6,'#3e6fe6','team')
 assert.equal(a.players.length,8);assert.equal(a.players.filter(p=>p.team===1).length,4);assert.equal(a.players.filter(p=>p.team===2).length,4)
 assert.ok([...a.own].every(x=>x===0||x===1||x===2),'land is held by a team')
 const you=a.players[0],mate=a.players[1]
 a.own.fill(0);a.trail.fill(0)
 for(let y=20;y<=24;y++)for(let x=20;x<=24;x++)a.own[y*N+x]=1
 for(let y=70;y<=74;y++)for(let x=70;x<=74;x++)a.own[y*N+x]=2
 for(const p of a.players.slice(2))Object.assign(p,{alive:false,back:1e9})
 // A teammate walks across your trail: you're fine.
 const tr=[35*N+30,35*N+31,35*N+32,35*N+33,35*N+34];Object.assign(you,{x:34.5,y:35.5,angle:0,want:0,trail:[...tr],path:[]});for(const i of tr)a.trail[i]=1
 Object.assign(mate,{x:32.5,y:34.3,angle:Math.PI/2,want:Math.PI/2,trail:[],path:[]});mate.bot.goals=[[32.5,50]]
 for(let k=0;k<4;k++){you.want=0;P.tick(a)}
 assert.ok(you.alive&&mate.alive,'teammates pass over each other’s trails');assert.equal(a.trail[35*N+32],1,'your trail stays yours')
 // Your loop claims land for Blue.
 for(let i=0;i<N*N;i++)if(a.trail[i])a.trail[i]=0
 Object.assign(mate,{alive:false,back:1e9});Object.assign(you,{x:23.5,y:22.5,angle:0,want:0,trail:[],path:[]})
 const blue=()=>a.own.filter(x=>x===1).length,before=blue()
 const go=(ang,n)=>{for(let k=0;k<n;k++){P.steer(you,ang);P.tick(a)}}
 go(0,14);go(Math.PI/2,16);go(Math.PI,18);go(-Math.PI/2,26)
 assert.ok(you.alive);assert.ok(blue()>before+10,'the loop is Blue’s now');assert.ok(P.teamShares(a).get(1)>P.teamShares(a).get(2))
 assert.equal(P.shares(a).get(1),P.teamShares(a).get(1),'your share is your team’s')
 // Crash: you come back three seconds later on Blue land (and Blue keeps its land meanwhile).
 Object.assign(you,{x:N-0.2,y:5.5,angle:0,want:0});P.tick(a);assert.ok(!you.alive)
 assert.ok(blue()>0,'the team keeps its land')
 for(let k=0;k<Math.round(3000/P.TICK_MS)+1;k++)P.tick(a)
 assert.ok(you.alive,'back in team battle');assert.equal(a.own[Math.floor(you.y)*N+Math.floor(you.x)],1,'on Blue’s land')
 assert.ok(!P.battleOver(a));a.ticks=P.TEAM_TICKS;assert.ok(P.battleOver(a))
 assert.ok(!P.battleOver(P.newArena(seeded(1))),'solo has no clock')
 // A full battle of bots keeps the map sane.
 const c=P.newArena(seeded(11),6,'#3e6fe6','team')
 for(let k=0;k<P.TEAM_TICKS;k++)P.tick(c)
 const t=P.teamShares(c);assert.ok(t.get(1)+t.get(2)<=100.0001&&t.get(1)+t.get(2)>3,'both teams hold land ('+t.get(1).toFixed(1)+' / '+t.get(2).toFixed(1)+')')
})
test('K-Quiz Play: 2 coins a right answer, more on a streak, up to 60 a day; a round mixes questions and flashcards',()=>{
 const today='2026-10-29',now=new Date('2026-10-29T15:00:00')
 assert.deepEqual([1,3,5].map(coins.quizCoins),[2,3,4])
 let log=[]
 for(let k=0;k<40;k++){const e=coins.quizEvent(log,today,5,now);if(!e)break;log=[...log,e]}
 assert.equal(coins.quizToday(log,today),coins.QUIZ_DAILY,'the daily limit');assert.equal(coins.quizEvent(log,today,5,now),null)
 assert.equal(coinBalance(0,log),60,'quiz coins count in the purse');assert.equal(new Set(log.map(e=>e.id)).size,log.length)
 const {roundFrom}=load('src/store/kquizRound.ts')
 const cards=['a','b','c','d','e'].map(x=>({id:x,question:'Q '+x,answer:'A '+x}))
 const round=roundFrom([{id:'q1',type:'mcq',prompt:'P',choices:['x','y'],correctIndex:1},{id:'q2',type:'written',prompt:'W',answer:'M'}],cards,42)
 assert.equal(round.length,7)
 for(const q of round.filter(q=>q.id.startsWith('card-'))){assert.equal(q.choices.length,4);assert.equal(q.choices[q.correct],'A '+q.id.slice(5));assert.equal(new Set(q.choices).size,4)}
 assert.equal(roundFrom([],cards.slice(0,3),1).length,0,'too few cards for wrong answers')
 assert.equal(roundFrom([],Array.from({length:30},(_,i)=>({id:'c'+i,question:'q'+i,answer:'a'+i})),1).length,10,'ten a round')
})
console.log(passed+'/'+passed+' coin checks passed.')
