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
 assert.equal(coins.gameCoins('meow',6),30,'a 6 × 6 Meowdoku');assert.equal(coins.gameCoins('gems',3600),30);assert.equal(coins.gameCoins('candy',1800),30)
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
test('match-3: fresh boards have no lines and a move; Candy crush makes striped (4), wrapped (L/T) and color bombs (5); Gem blitz makes flame (4), star (L/T), hypercube (5) and supernova (6) gems; combinations and the finale',()=>{
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
 assert.ok(f[0].made.some(x=>x.special==='col'),'four across in Candy crush: a candy striped down (it clears its column)')
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
 assert.ok(f[0].made.some(x=>x.special==='area'),'an L in Candy crush: a wrapped candy')
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
})
test('Flappy KONO: KONO falls and a flap lifts it, pipes come in with a gap, flying through a gap scores, touching a pipe or the ground ends the run; medals at 10/20/30/40',()=>{
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
test('KONO.io: a loop out of your land claims the trail and what it closes in; touching a trail cuts it; your own trail or the edge ends you; bots play on their own',()=>{
 const P=load('src/store/paper.ts'),seeded=load('src/store/meowdoku.ts').seeded,N=P.N
 const a=P.newArena(seeded(3),0),me=a.players[0],mine=()=>a.own.filter(x=>x===1).length
 assert.equal(mine(),21,'a round patch to start')
 // Walk a loop: 5 right of home, then 6 down, 5 back left, up home.
 a.own.fill(0);for(let y=10;y<=12;y++)for(let x=10;x<=12;x++)a.own[y*N+x]=1
 Object.assign(me,{x:12,y:11,dir:1,want:1,trail:[]})
 const go=(d,n)=>{for(let k=0;k<n;k++){P.steer(me,d);P.tick(a)}}
 go(1,5);assert.equal(me.trail.length,5,'outside, KONO leaves a trail')
 go(2,6);go(3,5)
 const before=mine();go(0,5)
 assert.ok(me.alive,'home safe');assert.equal(me.trail.length,0);assert.ok(mine()>before+20,'the loop and what it closes in are claimed ('+before+' → '+mine()+')')
 assert.equal(a.own[14*N+15],1,'a square inside the loop is claimed')
 // Back on yourself: no 180° turns, so steering straight back is ignored.
 P.steer(me,(me.dir+2)%4);assert.notEqual(me.want,(me.dir+2)%4)
 // Off the edge.
 Object.assign(me,{x:0,y:0,dir:3,want:3});P.tick(a);assert.ok(!me.alive,'off the map ends you')
 // A cut: a bot walks across your trail.
 const b=P.newArena(seeded(5),1),you=b.players[0],bot=b.players[1]
 b.own.fill(0);b.trail.fill(0)
 for(let y=20;y<=22;y++)for(let x=20;x<=22;x++)b.own[y*N+x]=1
 for(let y=40;y<=42;y++)for(let x=40;x<=42;x++)b.own[y*N+x]=2
 Object.assign(you,{x:25,y:30,dir:1,want:1,trail:[30*N+23,30*N+24,30*N+25]});for(const i of you.trail)b.trail[i]=1
 Object.assign(bot,{x:24,y:29,dir:2,want:2,trail:[]});bot.bot.plan=[2,2,2]
 P.tick(b)
 assert.ok(!you.alive,'your trail was cut');assert.equal(bot.kills,1);assert.equal(b.trail.filter(x=>x===1).length,0,'the cut trail is gone')
 // A crowd of bots plays for a while without breaking the map.
 const c=P.newArena(seeded(9),6)
 for(let k=0;k<600;k++){c.players[0].alive=true;P.tick(c)}
 const share=P.shares(c);assert.ok([...share.values()].reduce((x,y)=>x+y,0)<=100.0001)
 assert.ok(c.players.slice(1).some(p=>share.get(p.id)>0.6),'bots grow their land')
})
console.log(passed+'/'+passed+' coin checks passed.')
