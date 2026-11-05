// Read-only React HUD fixtures. Browser layout is checked separately; no GPU claim.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react')
const root=path.resolve(__dirname,'..'),cache=new Map();let hooks=[],index=0,effects=[]
const fakeReact={...React,useRef(value){return hooks[index++]??(hooks[index-1]={current:value})},useState(value){const i=index++;if(!(i in hooks))hooks[i]=value;return [hooks[i],v=>hooks[i]=typeof v==='function'?v(hooks[i]):v]},useEffect(fn){effects.push(fn)}}
const doc={hidden:false,addEventListener(){},removeEventListener(){}}
function load(file){file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const req=name=>name==='react'?fakeReact:name.endsWith('.css')?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:req,document:doc});return module.exports}
const {default:Console,ConsoleEmblem}=load('src/components/BonusConsole.tsx')
const nodes=(n,a=[])=>{if(!n||typeof n!=='object')return a;if(Array.isArray(n)){n.forEach(x=>nodes(x,a));return a}a.push(n);nodes(n.props?.children,a);return a},text=n=>n==null||typeof n==='boolean'?'':typeof n!=='object'?String(n):Array.isArray(n)?n.map(text).join(''):text(n.props?.children)
const find=(n,c)=>nodes(n).find(x=>x.props?.className===c)
const props={hud:{jp:124,steps:2,bank:30,pockets:1,queue:0,reels:['🐚','🐚','🐚'],spinning:false},delivery:{awarded:31,delivered:28,pending:3,live:24,collected:4,lost:0,tray:12,ballWaiting:2,ballArriving:1,ballField:5,captured:1,phase:'Push a ball to the catcher',tower:'128 starting-stock medals · right bay ready'},best:400,practice:false,bigWin:null,mode:'full',reduced:false,paused:false}
function render(p=props){index=0;effects=[];return Console(p)}

let count=0;function test(name,fn){fn();console.log('PASS '+name);count++}
function tick(p){render(p);effects.forEach(fn=>fn());return render(p)}
const icons=t=>nodes(t).filter(n=>n.type===ConsoleEmblem&&n.props.cue)
const changed={...props,hud:{...props.hud,steps:4,bank:40},delivery:{...props.delivery,tray:18,captured:2,awarded:41}}
test('numeric updates no longer produce cluttering emblem animations',()=>{hooks=[];assert.equal(icons(tick(props)).length,0);assert.equal(icons(tick(changed)).length,0)});
test('pause, Off, hidden and reduced mode retain accessible data',()=>{for(const gate of [{paused:true},{mode:'off'},{reduced:true}]){hooks=[];const t=tick({...changed,...gate});assert.equal(t.props['data-effects'],'off');assert.match(text(find(t,'sanctuary-details')),/41/);assert.equal(icons(t).length,0)}});
console.log(`${count} simplified console response checks passed`)
