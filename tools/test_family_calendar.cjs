// Actual application functions with isolated fixtures; no browser or user-data writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..'),cache=new Map(),{randomUUID}=require('node:crypto')
function load(relative){
 const file=path.resolve(root,relative)
 if(cache.has(file))return cache.get(file).exports
 const module={exports:{}};cache.set(file,module)
 const requireLocal=name=>name.endsWith('.css')?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name+(path.extname(name)?'':fs.existsSync(path.resolve(path.dirname(file),name+'.ts'))?'.ts':'.tsx'))):require(name)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:requireLocal,Date,Intl,Set,Map,Math,crypto:{randomUUID},console})
 return module.exports
}
const model=load('src/store/model.ts'),fam=load('src/store/familyCalendar.ts')

const tests=[]
function test(name,fn){tests.push({name,fn})}

test('a valid hex Profile.color round-trips through normalization',()=>{
 const base=model.createFreshData()
 base.profiles[0].color='#7ca982'
 const normalized=model.normalizeData(base)
 assert.equal(normalized.profiles[0].color,'#7ca982')
})

test('a malformed Profile.color is rejected rather than silently accepted',()=>{
 const base=model.createFreshData()
 base.profiles[0].color='not-a-color'
 assert.throws(()=>model.normalizeData(base))
})

test('a profile with no color at all normalizes to undefined, not a forced default',()=>{
 const base=model.createFreshData()
 delete base.profiles[0].color
 const normalized=model.normalizeData(base)
 assert.equal(normalized.profiles[0].color,undefined)
})

test('a profile with no explicit color still counts as occupying the first palette color, so the first kid added gets a genuinely different one',()=>{
 const defaultProfileOnly=[{color:undefined}]
 assert.notEqual(fam.nextFamilyColor(defaultProfileOnly),fam.FAMILY_COLORS[0])
})

test('nextFamilyColor picks a color no existing kid already has',()=>{
 const used=[{color:fam.FAMILY_COLORS[0]},{color:fam.FAMILY_COLORS[1]}]
 assert.equal(fam.nextFamilyColor(used),fam.FAMILY_COLORS[2])
})

test('nextFamilyColor cycles the palette once every color is already taken',()=>{
 const used=fam.FAMILY_COLORS.map(c=>({color:c}))
 assert.ok(fam.FAMILY_COLORS.includes(fam.nextFamilyColor(used)))
})

test('addKidProfile adds a profile, a blank study season and sanctuary progress, without switching the active profile',()=>{
 const data=model.normalizeData(model.createFreshData())
 const originalActive=data.activeProfileId
 const next=model.normalizeData(fam.addKidProfile(data,'Emma'))
 assert.equal(next.profiles.length,data.profiles.length+1)
 const kid=next.profiles.find(p=>p.name==='Emma')
 assert.ok(kid,'expected a new profile named Emma')
 assert.ok(kid.color,'expected the new kid to get an assigned color')
 assert.ok(next.studySeasons.some(s=>s.profileId===kid.id),'expected a blank study season for the new kid')
 assert.ok(next.sanctuaryProgress[kid.id],'expected a sanctuary progress entry for the new kid')
 assert.equal(next.activeProfileId,originalActive,'adding a kid from the Family page should not switch who is active')
})

test('addKidProfile rejects a blank name',()=>{
 const data=model.normalizeData(model.createFreshData())
 assert.throws(()=>fam.addKidProfile(data,'   '))
})

test('two kids added in a row get two different colors',()=>{
 const data=model.normalizeData(model.createFreshData())
 const withEmma=model.normalizeData(fam.addKidProfile(data,'Emma'))
 const withBoth=model.normalizeData(fam.addKidProfile(withEmma,'Jack'))
 const [emma,jack]=[withBoth.profiles.find(p=>p.name==='Emma'),withBoth.profiles.find(p=>p.name==='Jack')]
 assert.notEqual(emma.color,jack.color)
})

test('familyItemsForDate tags each kid\'s tasks, exams and events with their own name and color, on the right date only',()=>{
 const fresh=model.createFreshData()
 fresh.profiles[0].color='#7f9fc9'
 let data=model.normalizeData(fam.addKidProfile(model.normalizeData(fresh),'Jack'))
 const [emma,jack]=data.profiles
 data={...data,tasks:[...data.tasks,{id:'t1',profileId:emma.id,subjectId:'',title:'Emma math',due:'2026-09-21',done:false,notes:''}],exams:[...data.exams,{id:'e1',profileId:jack.id,subjectId:'',title:'Jack science test',due:'2026-09-21',done:false,notes:''}],calendarEvents:[...data.calendarEvents,{id:'c1',profileId:emma.id,date:'2026-09-22',title:'Emma tomorrow event',kind:'personal',notes:''}]}
 const items=fam.familyItemsForDate(data,data.profiles,'2026-09-21')
 assert.equal(items.length,2)
 const task=items.find(i=>i.id==='t1'),exam=items.find(i=>i.id==='e1')
 assert.equal(task.profileName,emma.name)
 assert.equal(task.color,emma.color)
 assert.equal(exam.profileName,jack.name)
 assert.equal(exam.color,jack.color)
 assert.ok(!items.some(i=>i.id==='c1'),'expected the event dated the next day to be excluded from this date')
})

test('familyItemsForDate only includes profiles actually passed in, so unchecked kids are excluded',()=>{
 let data=model.normalizeData(fam.addKidProfile(model.normalizeData(model.createFreshData()),'Jack'))
 const [emma,jack]=data.profiles
 data={...data,tasks:[...data.tasks,{id:'t1',profileId:emma.id,subjectId:'',title:'Emma math',due:'2026-09-21',done:false,notes:''},{id:'t2',profileId:jack.id,subjectId:'',title:'Jack reading',due:'2026-09-21',done:false,notes:''}]}
 const onlyJack=fam.familyItemsForDate(data,[jack],'2026-09-21')
 assert.equal(onlyJack.length,1)
 assert.equal(onlyJack[0].profileName,'Jack')
})

test('familyItemsForDate includes a kid\'s recurring class occurrences on that date',()=>{
 let data=model.normalizeData(model.createFreshData())
 const kid=data.profiles[0]
 const season=data.studySeasons.find(s=>s.profileId===kid.id)
 data={...data,studySeasons:data.studySeasons.map(s=>s.id===season.id?{...s,start:'2026-09-01',end:'2026-12-31',week:{...s.week,Monday:[{id:'math',label:'Math',start:'09:00',end:'10:00',kind:'study',occurrenceNotes:{}}]}}:s)}
 data=model.normalizeData(data)
 // 2026-09-21 is a Monday.
 const items=fam.familyItemsForDate(data,data.profiles,'2026-09-21')
 assert.ok(items.some(i=>i.kind==='class'&&i.title==='Math'),'expected the recurring Math class to show up as a family item')
})

let passed=0
for(const t of tests){try{t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
console.log(`${passed}/${tests.length} family-calendar regression groups passed.`)
