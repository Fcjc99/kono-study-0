// Regression for the user's wide screenshot: height-constrained SVG was sliced.
const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(file){file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const src=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(src,{module,exports:module.exports,require:n=>n.endsWith('.css')?{}:n.startsWith('.')?load(path.resolve(path.dirname(file),n)+(fs.existsSync(path.resolve(path.dirname(file),n)+'.ts')?'.ts':'.tsx')):require(n),Math,Number,Array,Set});return module.exports}
const {DrawScene,konoScenePose}=load('src/components/BonusDraw.tsx');
let frames=0;
for(const mode of ['full','subtle','off'])for(const resolved of [false,true])for(let f=0;f<=100;f++){
 const draw={kind:'dish',resolved,labels:['+10'],selected:0,active:0,label:'+10',waiting:0,progress:f/100,resultAge:f};
 const p=konoScenePose(draw,mode);
 for(const [width,height] of [[156,79],[320,79],[390,79],[844,79],[1499,136]]){
  const scale=Math.min(width/440,height/104),ox=(width-440*scale)/2,oy=(height-104*scale)/2;
  // Full sprite rectangle and shadow fit throughout entry and celebration.
  for(const [x,y] of [[p.x-42,12+p.y-p.celebrate],[p.x+42,96+p.y-p.celebrate],[302,26],[343,91]]){
   assert.ok(ox+x*scale>=0&&ox+x*scale<=width);assert.ok(oy+y*scale>=0&&oy+y*scale<=height);
  }
 }
 const html=renderToStaticMarkup(React.createElement(DrawScene,{draw,motion:mode,svgRef:{current:null}}));
 assert.match(html,/preserveAspectRatio="xMidYMid meet"/);assert.doesNotMatch(html,/slice/);
 assert.match(html,/data-kono-ball="" opacity="[01]" transform="translate/);frames++;
}
console.log(`PASS character/chest fit ${frames} poses × 5 aspect ratios; first-paint ball pose initialized (geometry/markup, not browser pixels).`);
