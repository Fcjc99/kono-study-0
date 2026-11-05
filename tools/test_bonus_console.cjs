// Read-only React HUD fixtures. Browser layout is checked separately; no GPU claim.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react')
const root=path.resolve(__dirname,'..'),cache=new Map();let hooks=[],index=0,effects=[]
const fakeReact={...React,useRef(value){return hooks[index++]??(hooks[index-1]={current:value})},useState(value){const i=index++;if(!(i in hooks))hooks[i]=value;return [hooks[i],v=>hooks[i]=typeof v==='function'?v(hooks[i]):v]},useEffect(fn){effects.push(fn)}}
function load(file){file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const req=name=>name==='react'?fakeReact:name.endsWith('.css')?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:req,document:{hidden:false,addEventListener(){},removeEventListener(){}}});return module.exports}
const {default:Console,ConsoleEmblem}=load('src/components/BonusConsole.tsx')
const nodes=(n,a=[])=>{if(!n||typeof n!=='object')return a;if(Array.isArray(n)){n.forEach(x=>nodes(x,a));return a}a.push(n);nodes(n.props?.children,a);return a},text=n=>n==null||typeof n==='boolean'?'':typeof n!=='object'?String(n):Array.isArray(n)?n.map(text).join(''):text(n.props?.children)
const find=(n,c)=>nodes(n).find(x=>x.props?.className===c)
const props={hud:{jp:124,steps:2,bank:30,pockets:1,queue:0,reels:['🐚','🐚','🐚'],spinning:false},delivery:{awarded:31,delivered:28,pending:3,live:24,collected:4,lost:0,tray:12,ballWaiting:2,ballArriving:1,ballField:5,captured:1,phase:'Push a ball to the catcher',tower:'128 starting-stock medals · right bay ready'},best:400,practice:false,bigWin:null,mode:'full',reduced:false,paused:false}
function render(p=props){index=0;effects=[];return Console(p)}
let count=0;function test(name,fn){fn();console.log('PASS '+name);count++}
test('cinema replaces counters and explanations outside the details drawer',()=>{
 const cinema=React.createElement('canvas',{'data-test':'cinema'}),t=render({...props,cinema}),d=find(t,'sanctuary-details');
 assert.ok(nodes(t).includes(cinema));assert.equal(find(t,'sanctuary-idle-status'),undefined);assert.equal(find(t,'sanctuary-rail'),undefined);
 const content=text(d);for(const label of ['124 medals','30 medals','Awarded31','Delivered to field28','Still delivering3','Rewards collected4','Starting stock is not an award','JP pockets: 1/12','12 tray collected'])assert.ok(content.includes(label),label);
 assert.equal(nodes(t).filter(n=>n.type==='button').length,2);
});
test('details remain accessible with focus restore and pause callback',()=>{const t=render(),d=find(t,'sanctuary-details');assert.equal(d.type,'dialog');assert.equal(d.props.open,undefined);assert.equal(typeof d.props.onClose,'function');assert.equal(nodes(t).filter(n=>n.props?.['aria-haspopup']==='dialog').length,1)});
test('all symbols and actual lantern progress remain available in details',()=>{const t=render();assert.equal(nodes(find(t,'sanctuary-lantern-path')).filter(n=>n.type===ConsoleEmblem&&n.props.className==='is-lit').length,2);assert.match(find(t,'sanctuary-reel-windows').props['aria-label'],/shell, shell, shell/)});
test('practice provenance and imperative delivery ref are retained',()=>{const ref={current:null},t=render({...props,practice:true,bigWin:20,deliveredRef:ref});assert.match(text(t),/Practice tower: 20 awarded/);assert.match(text(t),/Sample supply31/);assert.ok(nodes(t).some(n=>n.type==='strong'&&n.props.ref===ref))});
test('route reasons remain in details, not on animation',()=>{const t=render({...props,delivery:{...props.delivery,routes:[{source:'Tower',pending:30,stage:'Waiting',reason:'Obstructed'}]}});assert.match(text(find(t,'sanctuary-details')),/Tower: 30 still owed.*Waiting.*Obstructed/)});
console.log(`${count} cinema/details checks passed`)
