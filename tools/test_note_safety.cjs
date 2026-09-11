const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const file=path.resolve(__dirname,'../src/components/SafeNoteBody.tsx'),moduleResult={exports:{}};
const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{module:moduleResult,exports:moduleResult.exports,require});
const render=text=>renderToStaticMarkup(React.createElement(moduleResult.exports.default,{text}));
for(const input of ['<img src=x onerror=alert(1)>','<script>alert(1)</script>','<svg onload=alert(1)>','<a href="javascript:alert(1)">go</a>','<mark style="background:url(javascript:alert(1))">bad</mark>']){const html=render(input);assert(!/<(?:img|script|svg|a)\b/i.test(html));assert(html.includes('&lt;'));assert(!/<mark[^>]+url\(/i.test(html))}
assert.equal(render('<b>Bold</b> and <i>italic</i>'),'<b>Bold</b> and <i>italic</i>');
assert(render('<mark style="background:#fff39d">Safe</mark>').includes('background:#fff39d'));
assert(render('<b>'.repeat(1000)+'Text'+'</b>'.repeat(1000)).includes('Text'));
console.log('PASS note/exam formatting renders as escaped text or allowed React elements; executable markup is never inserted.');
