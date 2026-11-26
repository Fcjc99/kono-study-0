// Settings › Sound's stored prefs (src/sound/prefs.ts) and what a drop zone takes (src/components/dropAccept.ts).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
const mem=new Map(),storage={getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)}
function load(relative){
 const file=path.resolve(root,relative),module={exports:{}}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require,Math,JSON,Number,Object,localStorage:storage})
 return module.exports
}
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
const S=load('src/sound/prefs.ts'),D=load('src/components/dropAccept.ts')
const norm=v=>v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,norm(v[k])])):v
const same=(a,b)=>assert.equal(JSON.stringify(norm(a)),JSON.stringify(norm(b)))

test('nothing stored, or junk stored, gives the defaults (sound on for the big moments, tabs quiet)',()=>{
 same(S.readSoundPrefs(),S.defaultSoundPrefs())
 mem.set(S.SOUND_PREFS_KEY,'{not json');same(S.readSoundPrefs(),S.defaultSoundPrefs())
 mem.set(S.SOUND_PREFS_KEY,JSON.stringify({volume:'loud',pack:'kazoo',events:{done:'yes'},custom:{done:{name:5}},scape:{rain:9,lava:1}}))
 const p=S.readSoundPrefs()
 assert.equal(p.volume,.7);assert.equal(p.pack,'kono');assert.equal(p.events.done,true);same(p.custom,{});same(p.scape,{rain:1})
 const d=S.defaultSoundPrefs();assert.equal(d.events.tap,false);assert.equal(d.events.done,true);assert.equal(d.events.timer,true)
 mem.clear()
})
test('saved prefs come back the same, and listeners hear about the change',()=>{
 let heard=0;const off=S.onSoundPrefs(()=>heard++)
 const p={...S.defaultSoundPrefs(),volume:.25,pack:'bells',custom:{timer:{name:'gong.mp3',size:12000}},scape:{rain:.5,cafe:.3},scapeWithFocus:false}
 p.events={...p.events,tap:true,remove:false}
 S.saveSoundPrefs(p);same(S.readSoundPrefs(),p);assert.equal(heard,1)
 off();S.saveSoundPrefs(p);assert.equal(heard,1)
 mem.clear()
})
test('a layer turned all the way down leaves the mix; volume stays between 0 and 1',()=>{
 const p=S.cleanSoundPrefs({volume:4,scape:{rain:0,waves:.4,birds:-1}})
 assert.equal(p.volume,1);same(p.scape,{waves:.4})
 assert.equal(S.cleanSoundPrefs({volume:-2}).volume,0)
})
test('every pack, moment and soundscape has a name',()=>{
 for(const list of [S.SOUND_PACKS,S.SOUND_EVENTS,S.SCAPES])for(const x of list)assert.ok(x.id&&x.name)
 same(Object.keys(S.defaultSoundPrefs().events).sort(),S.SOUND_EVENTS.map(e=>e.id).sort())
})
test('with sound off (settings.sound) nothing plays, whatever the prefs say',()=>{
 S.setSoundOn(false);assert.equal(S.soundOn(),false);S.sound('done')
 S.setSoundOn(true);assert.equal(S.soundOn(),true)
})
test('a drop zone takes what its accept list says, by type or by extension, and anything with no list',()=>{
 const pdf={name:'Syllabus.PDF',type:'application/pdf'},png={name:'board.png',type:'image/png'},ics={name:'cal.ics',type:''},mp3={name:'ding.mp3',type:'audio/mpeg'}
 assert.ok(D.accepts('application/pdf,.pdf',pdf));assert.ok(!D.accepts('application/pdf,.pdf',png))
 assert.ok(D.accepts('image/*',png));assert.ok(!D.accepts('image/*',pdf))
 assert.ok(D.accepts('.ics,text/calendar',ics));assert.ok(!D.accepts('.ics,text/calendar',mp3))
 assert.ok(D.accepts('audio/*',mp3));assert.ok(D.accepts(undefined,mp3));assert.ok(D.accepts('',pdf))
 assert.ok(D.accepts('.pdf,.jpg,.jpeg,.png,.webp',{name:'IMG_1.JPEG',type:'image/jpeg'}))
})
console.log(passed+'/'+passed+' sound and drop groups passed.')
