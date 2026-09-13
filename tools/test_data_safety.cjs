// Positive assertions over actual staged TS. VM network/cache hooks and in-memory SQLite only.
// Run: node production-22.8.8/research/positive-data-regressions.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..'),deps=path.join(root,'node_modules');
const ts=require(path.join(deps,'typescript')),clone=x=>structuredClone(x),same=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
let hooks={},fetchHook;const modules=new Map();
const cacheStub={readCache:(...a)=>hooks.readCache(...a),commitCache:(...a)=>hooks.commitCache(...a),deleteCache:(...a)=>hooks.deleteCache(...a),readLegacy:()=>hooks.readLegacy(),decodeData:raw=>model.normalizeData(JSON.parse(raw)),downloadData(){},exportData(){}};
function load(rel){
 if(modules.has(rel))return modules.get(rel);
 const file=path.join(root,rel),source=fs.readFileSync(file,'utf8');
 const code=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,mod={exports:{}};
 const requireIn=name=>name==='virtual:kono-shell'?'<html>Test shell</html>':name==='react'?{}:name==='./localRepository'?cacheStub:!name.startsWith('.')?require(path.join(deps,name)):load(path.normalize(path.join(path.dirname(rel),name+'.ts')));
 vm.runInNewContext(code,{module:mod,exports:mod.exports,require:requireIn,crypto:{randomUUID},console,Date,Math,Set,Map,Object,Promise,AbortSignal,Response,Request,Headers,URL,TextEncoder,TextDecoder,Uint8Array,navigator:{onLine:true},document:{visibilityState:'visible'},window:{addEventListener(){},removeEventListener(){},setInterval(){return 1},location:{assign(){}}},clearInterval(){},fetch:(...a)=>fetchHook(...a)});
 modules.set(rel,mod.exports);return mod.exports;
}
const model=load('src/store/model.ts'),{PlannerRepository}=load('src/store/repository.ts'),{mergeData}=load('src/store/merge.ts'),progress=load('src/game/progression/progressionEngine.ts'),{writePlan,readPlan,deletePlan}=load('server/database.ts'),server=load('server/index.ts').default;
const make=()=>{const d=model.createFreshData();d.onboardingComplete=true;return d};
function note(d,id){d=clone(d);d.notes.push({id,profileId:d.profiles[0].id,subjectId:'',title:id,body:'Test',created:'2026-09-09T12:00:00Z'});return model.normalizeData(d)}
const entry=(data,extra={})=>({version:1,revision:1,data,base:clone(data),serverRevision:1,pending:false,backups:[],...extra});
function setup(d){const r=new PlannerRepository();r.scope='account:A';r.state={...r.state,data:d,ready:true,user:{id:'A',email:'a@example.test',name:'A'},status:'Saved'};r.cache=entry(d);return r}
function defaults(){hooks={readLegacy:()=>({found:false,data:make(),recovery:[]}),readCache:async()=>null,commitCache:async(_scope,base,next)=>({...next,revision:(base?.revision??0)+1}),deleteCache:async()=>{}};fetchHook=async()=>new Response(JSON.stringify({user:null}),{headers:{'Content-Type':'application/json'}})}
async function drain(r){for(let i=0;i<6;i++){await r.queue;await Promise.resolve()}}
function sqlite(){
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE plans(owner TEXT PRIMARY KEY,revision INTEGER NOT NULL,data TEXT,operation TEXT NOT NULL,updated_at TEXT NOT NULL);CREATE TABLE plan_history(owner TEXT NOT NULL,revision INTEGER NOT NULL,data TEXT,created_at TEXT NOT NULL,PRIMARY KEY(owner,revision));');
 return{prepare(sql){return{bind(...args){return{sql,args,first:async()=>db.prepare(sql).get(...args)??null,all:async()=>({success:true,results:db.prepare(sql).all(...args)})}}}},async batch(statements){db.exec('BEGIN');try{const result=statements.map(s=>{const stmt=db.prepare(s.sql);return{success:true,results:stmt.columns().length?stmt.all(...s.args):(stmt.run(...s.args),[])}});db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}};
}
const tests=[];function test(name,fn){tests.push({name,fn})}
test('unchanged verified cloud revision clears connecting/offline status without a write',async()=>{
 const r=setup(make());let writes=0;hooks.commitCache=async()=>{writes++;throw Error('must not write')}
 r.state.status='Connecting';r.state.error='Previous network failure'
 await r.acceptRemote({revision:r.cache.serverRevision,data:r.cache.data},r.generation)
 assert.equal(r.state.status,'Saved');assert.equal(r.state.error,'');assert.equal(writes,0)
 r.cache.pending=true;await r.acceptRemote({revision:r.cache.serverRevision,data:r.cache.base},r.generation)
 assert.equal(r.state.status,'Saved locally — sync pending')
 r.unsaved=true;r.state.status='Unsaved';await r.acceptRemote({revision:r.cache.serverRevision,data:r.cache.base},r.generation)
 assert.equal(r.state.status,'Unsaved');assert.equal(writes,0)
});
test('sign-out invalidates queued edits and cloud selection',async()=>{
 const d=note(make(),'A-secret'),r=setup(d),gate=deferred(),writes=[];let requests=0;
 hooks.deleteCache=()=>gate.promise;hooks.commitCache=async(scope,base,next)=>{writes.push(scope);return{...next,revision:1}};r.api=async()=>{requests++;throw Error('must not fetch')};
 const leaving=r.signOut();r.update(clone(d));const selecting=r.useCloud();gate.resolve();await leaving;await selecting;await drain(r);
 assert.equal(r.state.user,null);assert.equal(r.state.data.notes.length,0);assert.equal(writes.length,0);assert.equal(requests,0);
});
test('account deletion invalidates queued old snapshots',async()=>{
 const d=note(make(),'deleted-note'),r=setup(d),puts=[];let cloud={revision:1,data:d};
 r.api=async(_p,init)=>{if(init?.method==='DELETE'){cloud={revision:2,data:null};return{ok:true,json:async()=>cloud}}if(init?.method==='PUT'){puts.push(init);return{ok:true,json:async()=>({revision:3})}}return{ok:true,json:async()=>cloud}};
 const deleting=r.deleteAccountData();r.update(clone(d));await deleting;await drain(r);assert.equal(puts.length,0);assert.equal(r.state.data.notes.length,0);assert.equal(r.cache.serverRevision,2);
});
test('repeated cache failure preserves unsaved draft until durable retry succeeds',async()=>{
 const base=make(),draft=note(base,'unsaved-only'),remote=note(base,'remote-only'),r=setup(base);let reads=0;
 hooks.commitCache=async()=>{throw Error('Quota unavailable')};r.api=async(_p,init)=>{if(init?.method==='PUT')return{ok:true,json:async()=>({revision:3})};reads++;return{ok:true,json:async()=>({revision:2,data:remote})}};
 r.update(draft);await drain(r);r.retry();await drain(r);assert.equal(r.unsaved,true);assert.equal(r.state.status,'Unsaved');assert.equal(r.state.data.notes[0].id,'unsaved-only');assert.equal(reads,0);
 hooks.commitCache=async(_scope,base,next)=>({...next,revision:(base?.revision??0)+1});r.retry();await drain(r);assert.equal(r.unsaved,false);assert.equal(r.state.data.notes.length,2);assert.ok(r.state.data.notes.some(n=>n.id==='unsaved-only'));
});
test('retrying an unchanged draft never claims durability while a cache failure is unresolved',async()=>{
 const r=setup(make());r.unsaved=true;assert.equal(await r.update(d=>d),false);r.unsaved=false;assert.equal(await r.update(d=>d),true)
});
test('session switch between accounts is rejected before GET or PUT touches B',async()=>{
 const db=sqlite(),a=note(make(),'A-private'),b=note(make(),'B-private');await writePlan(db,'B',0,JSON.stringify(b),randomUUID());const r=setup(a);r.cache.pending=true;
 fetchHook=(url,init)=>{assert.equal(init.headers['X-Kono-Account-ID'],'A');return server.fetch(new Request('https://example.test'+url,{...init,headers:{...init.headers,'oai-authenticated-user-id':'B',Origin:'https://example.test'}}),{DB:db})};
 await assert.rejects(()=>r.syncNow(r.generation),/session ended/);assert.equal(r.blocked,true);same(JSON.parse((await readPlan(db,'B')).data),b);assert.equal((await readPlan(db,'B')).revision,1);same(r.state.data,a);
});
test('late cloud response after dispose never writes or publishes',async()=>{
 const d=note(make(),'A-private'),r=setup(d),gate=deferred();let writes=0;r.api=()=>gate.promise;hooks.commitCache=async()=>{writes++;throw Error('must not write')};
 const selecting=r.useCloud();await Promise.resolve();await Promise.resolve();r.dispose();gate.resolve({ok:true,json:async()=>({revision:2,data:make()})});await selecting;assert.equal(writes,0);same(r.state.data,d);
});
test('migration offers newest device cache rather than legacy localStorage',async()=>{
 const old=note(make(),'legacy'),current=note(old,'device-new');hooks.readLegacy=()=>({data:old,found:true,recovery:[]});hooks.readCache=async scope=>scope==='device'?entry(current):null;
 const r=new PlannerRepository();await r.start();same(r.migration,current);same(r.state.data,current);r.dispose();
});
test('ordinary remote deletion clears clean cache and never reuploads',async()=>{
 const r=setup(note(make(),'private'));let puts=0;r.api=async(_p,init)=>{if(init?.method==='PUT')puts++;return{ok:true,json:async()=>({revision:2,data:null})}};
 await r.syncNow(r.generation);assert.equal(puts,0);assert.equal(r.state.data.notes.length,0);assert.equal(r.cache.serverRevision,2);
});
test('remote deletion conflicts with pending work instead of resurrecting it',async()=>{
 const r=setup(note(make(),'pending'));r.cache.pending=true;let puts=0;r.api=async(_p,init)=>{if(init?.method==='PUT')puts++;return{ok:true,json:async()=>({revision:2,data:null})}};
 await r.syncNow(r.generation);assert.equal(puts,0);assert.equal(r.state.conflicts.length,1);assert.equal(r.state.data.notes[0].id,'pending');
});
test('cache merge result is published and preserves other-tab note',async()=>{
 const base=make(),remote=note(base,'remote'),other=note(base,'other-tab'),r=setup(base);let first=true;
 hooks.commitCache=async(_scope,expected,next)=>{if(first){first=false;const merged=mergeData(expected.data,next.data,other);assert.equal(merged.conflicts.length,0);return{...next,data:merged.data,base:base,serverRevision:1,pending:true,revision:3}}return{...next,revision:4}};
 r.api=async(_p,init)=>init?.method==='PUT'?(assert.equal(JSON.parse(init.body).data.notes.length,2),{ok:true,json:async()=>({revision:3})}):{ok:true,json:async()=>({revision:2,data:remote})};
 await r.syncNow(r.generation);assert.equal(r.state.data.notes.length,2);
});
test('legacy schedule-only subject belongs to the schedule profile',()=>{
 const d=make(),b='profile-B';d.profiles.push({...d.profiles[0],id:b});d.subjects=[{id:'legacy-math',name:'Math',color:'#4169a8',resources:[]}];d.studySeasons.push({...d.studySeasons[0],id:'season-B',profileId:b,week:model.blankWeek()});
 d.studySeasons[1].week.Monday.push({id:'block-B',start:'10:00',end:'11:00',label:'Math',kind:'study',subjectId:'legacy-math'});const migrated=model.normalizeData(d);assert.equal(migrated.subjects[0].profileId,b);same(model.normalizeData(migrated),migrated);
});
test('legacy subject remap avoids existing IDs and survives reopening',()=>{
 const d=make(),a=d.profiles[0].id,b='profile-B';d.profiles.push({...d.profiles[0],id:b});d.subjects=[{id:'math',name:'Math',color:'#4169a8',resources:[]},{id:'math:migrated-1',profileId:b,name:'Other',color:'#4169a8',resources:[]}];d.tasks=[a,b].map((profileId,i)=>({id:'t'+i,profileId,subjectId:'math',title:'Math',due:'2026-09-09',done:false,notes:''}));
 const migrated=model.normalizeData(d);assert.equal(new Set(migrated.subjects.map(s=>s.id)).size,3);same(model.normalizeData(migrated),migrated);
});
test('normalization retains timestamps and does not synthesize wall-clock drift',()=>{
 const d=make(),pid=d.profiles[0].id;d.sanctuaryProgress[pid].updatedAt='2020-01-01T00:00:00.000Z';const normalized=model.normalizeData(d);assert.equal(normalized.sanctuaryProgress[pid].updatedAt,'2020-01-01T00:00:00.000Z');same(model.normalizeData(normalized),normalized);
});
test('profile guard blocks other-profile records, progress, navigation, and settings',()=>{
 let d=make();const a=d.profiles[0].id,b='profile-B';d.profiles.push({...d.profiles[0],id:b});d.sanctuaryProgress[b]=progress.createSanctuaryProgress(b);d.sanctuaryDecor[b]={profileId:b,placements:[]};d=model.normalizeData(d);
 for(const change of [x=>x.profiles[1].name='Changed',x=>x.sanctuaryProgress[b].totalCredits=999,x=>x.sanctuaryDecor[b].placements.push({id:'p1',assetId:'mailbox',x:0.5,y:0.5,rotation:0}),x=>x.settings.sound=false,x=>x.activeProfileId=b,x=>x.tasks.push({id:'B-task',profileId:b,subjectId:'',title:'B',due:'2026-09-09',done:false,notes:''})]){const after=clone(d);change(after);assert.throws(()=>model.assertProfileWrite(d,after,a))}
 assert.equal(model.assertProfileWrite(d,note(d,'own-note'),a).notes.length,1);
});
function resetFixture(){
 const d=make(),pid=d.profiles[0].id;d.tasks=['t1','t2'].map(id=>({id,profileId:pid,subjectId:'',title:id,due:'2026-09-09',done:true,notes:''}));let earned=progress.createSanctuaryProgress(pid);for(const task of d.tasks)earned=progress.applyTaskCompletionChange(earned,{task,completed:true,completedAt:'2026-09-09T12:00:00Z'});d.sanctuaryProgress[pid]=earned;
 const left=clone(d),right=clone(d);left.tasks[0].done=false;right.tasks[1].done=false;left.sanctuaryProgress[pid]=progress.applyTaskCompletionChange(earned,{task:left.tasks[0],completed:false});right.sanctuaryProgress[pid]=progress.applyTaskCompletionChange(earned,{task:right.tasks[1],completed:false});return{d,left,right,pid,earned};
}
test('reopening all work preserves ledger and merges new third-device credits',()=>{
 const {d,left,right,pid,earned}=resetFixture(),cleared=mergeData(d,left,right);assert.equal(cleared.conflicts.length,0);assert.equal(cleared.data.sanctuaryProgress[pid].totalCredits,2);assert.equal(cleared.data.profiles[0].progressEpoch,d.profiles[0].progressEpoch);
 const third=clone(d),task={id:'t3',profileId:pid,subjectId:'',title:'t3',due:'2026-09-09',done:true,notes:''};third.tasks.push(task);third.sanctuaryProgress[pid]=progress.applyTaskCompletionChange(earned,{task,completed:true,completedAt:'2026-09-09T12:00:00Z'});assert.equal(mergeData(d,third,cleared.data).conflicts.length,0);assert.equal(mergeData(d,third,cleared.data).data.sanctuaryProgress[pid].totalCredits,3);
});
test('identical reset merges converge on the same epoch',()=>{
 const {d,left,right}=resetFixture(),a=mergeData(d,left,right),b=mergeData(d,left,right);assert.equal(a.data.profiles[0].progressEpoch,b.data.profiles[0].progressEpoch);
});
test('identical reset snapshots reconcile after a lost PUT acknowledgement',()=>{
 const {d,left,right}=resetFixture(),reset=mergeData(d,left,right);assert.equal(reset.conflicts.length,0);
 const reconciled=mergeData(d,reset.data,clone(reset.data));assert.equal(reconciled.conflicts.length,0);same(reconciled.data,reset.data);
});
test('identical reset merges produce stable progress timestamps',async()=>{
 const {d,left,right,pid}=resetFixture(),a=mergeData(d,left,right);await new Promise(resolve=>setTimeout(resolve,10));const b=mergeData(d,left,right);
 assert.equal(a.data.sanctuaryProgress[pid].updatedAt,b.data.sanctuaryProgress[pid].updatedAt);
});
test('SQL CAS rejects stale writes/deletes and keeps owner histories separate',async()=>{
 const db=sqlite(),data=JSON.stringify(make());assert.equal(await writePlan(db,'A',7,data,randomUUID()),undefined);assert.equal(await writePlan(db,'A',0,data,randomUUID()),1);assert.equal(await writePlan(db,'A',0,data,randomUUID()),undefined);assert.equal(await writePlan(db,'B',1,data,randomUUID()),undefined);assert.equal(await writePlan(db,'B',0,data,randomUUID()),1);assert.equal(await writePlan(db,'A',1,data,randomUUID()),2);assert.equal(await deletePlan(db,'A',1),undefined);assert.equal(await deletePlan(db,'A',2),3);assert.equal((await readPlan(db,'A')).data,null);assert.equal(await writePlan(db,'A',2,data,randomUUID()),undefined);assert.equal((await readPlan(db,'B')).revision,1);
 const a=await db.prepare('SELECT * FROM plan_history WHERE owner = ?').bind('A').all(),b=await db.prepare('SELECT * FROM plan_history WHERE owner = ?').bind('B').all();assert.equal(a.results.length,0);assert.equal(b.results.length,1);
});
test('older clients cannot read, overwrite or delete a new-version cloud plan',async()=>{
 const db=sqlite(),env={DB:db},data=make(),{buildStudyTasks}=load('src/store/studyScheduler.ts');const plan={id:'study-v2',profileId:data.activeProfileId,subjectId:'',title:'Read',unit:'chapter',total:14,start:'2026-09-09',end:'2026-09-22',weekdays:[0,1,2,3,4,5,6],timeZone:'America/New_York'};data.studyPlans=[plan];data.tasks=buildStudyTasks(plan,randomUUID);await writePlan(db,'A',0,JSON.stringify(data),randomUUID());
 for(const method of ['GET','PUT','DELETE']){
  const headers={'oai-authenticated-user-id':'A','X-Kono-Account-ID':'A','X-Kono-Request':'1','Content-Type':'application/json',Origin:'https://example.test'};
  const body=method==='GET'?undefined:JSON.stringify(method==='DELETE'?{expectedRevision:1}:{expectedRevision:1,operationId:randomUUID(),data:make()});
  const response=await server.fetch(new Request('https://example.test/api/plan',{method,headers,body}),env);assert.equal(response.status,426)
 }
 same(JSON.parse((await readPlan(db,'A')).data),data);assert.equal((await readPlan(db,'A')).revision,1)
});
test('server checks account binding on plans and histories, plus CSRF and idempotency',async()=>{
 const db=sqlite(),env={DB:db},origin='https://example.test',data=make();await writePlan(db,'B',0,JSON.stringify(data),randomUUID());
 const req=(route,method='GET',extras={},body)=>new Request(origin+route,{method,headers:{'oai-authenticated-user-id':'B','X-Kono-Account-ID':'B','X-Kono-Request':'1','X-Kono-Data-Version':'6','Content-Type':'application/json',Origin:origin,...extras},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal((await server.fetch(new Request(origin+'/api/plan'),env)).status,401);
 for(const route of ['/api/plan','/api/history','/api/history/1'])assert.equal((await server.fetch(req(route,'GET',{'X-Kono-Account-ID':'A'}),env)).status,401);
 const body={expectedRevision:1,operationId:randomUUID(),data};
 for(const extras of [{Origin:'https://evil.test'},{'X-Kono-Request':'0'},{'sec-fetch-site':'cross-site'}])assert.equal((await server.fetch(req('/api/plan','PUT',extras,body),env)).status,403);
 const response=await server.fetch(req('/api/plan','PUT',{},body),env);assert.equal(response.status,200);assert.equal((await response.json()).revision,2);assert.equal((await (await server.fetch(req('/api/plan','PUT',{},body),env)).json()).revision,2);assert.equal((await readPlan(db,'B')).revision,2);
 assert.equal((await server.fetch(req('/api/history/2'),env)).status,200);assert.equal((await server.fetch(req('/api/history/2','GET',{'oai-authenticated-user-id':'A','X-Kono-Account-ID':'A'}),env)).status,404);
});
test('Trash survives normalization and restores notes without replacing other work',()=>{
const w=load('src/store/workspace.ts');const before=note(make(),'trash-note'),deleted=model.normalizeData(w.captureDeletions(before,w.removeEntry(before,'notes','trash-note')));
assert.equal(deleted.notes.length,0);assert.equal(deleted.trash.length,1);const restored=w.restoreEntry(note(deleted,'newer'),deleted.trash[0].id);assert.equal(restored.notes.length,2);assert.equal(restored.trash.length,0);
});
test('Trash restore rejects tampered cross-profile payloads',()=>{
const w=load('src/store/workspace.ts'),before=note(make(),'private'),deleted=w.captureDeletions(before,w.removeEntry(before,'notes','private'));const payload=JSON.parse(deleted.trash[0].payload);payload.record.profileId='other';deleted.trash[0].payload=JSON.stringify(payload);assert.throws(()=>w.restoreEntry(deleted,deleted.trash[0].id));
});
test('individual study unit deletion keeps a valid plan and restores independently',()=>{
const w=load('src/store/workspace.ts'),sched=load('src/store/studyScheduler.ts'),d=make(),plan={id:'plan',profileId:d.activeProfileId,subjectId:'',title:'Read',unit:'chapter',total:3,start:'2026-09-09',end:'2026-09-11',weekdays:[0,1,2,3,4,5,6],timeZone:'UTC'};d.studyPlans=[plan];d.tasks=sched.buildStudyTasks(plan,randomUUID);const removed=d.tasks[1].id,next=model.normalizeData(w.captureDeletions(d,w.removeEntry(d,'tasks',removed)));assert.equal(next.studyPlans[0].total,2);assert.equal(next.trash.length,1);const restored=w.restoreEntry(next,next.trash[0].id);assert.equal(restored.tasks.length,3);assert.equal(restored.tasks.find(t=>t.id===removed).studyPlanId,undefined);
});
test('canceled study plan restores its complete bundle',()=>{
const w=load('src/store/workspace.ts'),sched=load('src/store/studyScheduler.ts'),d=make(),plan={id:'plan',profileId:d.activeProfileId,subjectId:'',title:'Read',unit:'chapter',total:2,start:'2026-09-09',end:'2026-09-10',weekdays:[0,1,2,3,4,5,6],timeZone:'UTC'};d.studyPlans=[plan];d.tasks=sched.buildStudyTasks(plan,randomUUID);const next=model.normalizeData(w.captureDeletions(d,sched.cancelStudyPlan(d,'plan')));assert.equal(next.trash.length,1);const restored=w.restoreEntry(next,next.trash[0].id);assert.equal(restored.studyPlans.length,1);assert.equal(restored.tasks.length,2);
});
test('deleted recurring blocks restore only to their original season and weekday',()=>{
const w=load('src/store/workspace.ts'),d=make();d.studySeasons[0].week.Monday=[{id:'block',start:'09:00',end:'10:00',label:'Read',kind:'study'}];const next=clone(d);next.studySeasons[0].week.Monday=[];const removed=model.normalizeData(w.captureDeletions(d,next));assert.equal(removed.trash.length,1);const restored=w.restoreEntry(removed,removed.trash[0].id);assert.equal(restored.studySeasons[0].week.Monday[0].id,'block');
});
test('new appearance and board settings survive a legacy upgrade',()=>{
const d=note(make(),'styled');d.schemaVersion=2;delete d.trash;d.settings.theme='midnight';d.settings.textSize='large';d.notes[0].size='large';d.notes[0].position=42;const normalized=model.normalizeData(d);assert.equal(normalized.schemaVersion,6);assert.equal(normalized.settings.theme,'midnight');assert.equal(normalized.notes[0].position,42);assert.equal(normalized.trash.length,0);
});
test('legacy single-choice scheduleView migrates into the three schedule-show checkboxes',()=>{
const all=make();assert.deepEqual([all.settings.scheduleShowAcademic,all.settings.scheduleShowSports,all.settings.scheduleShowAppointments],[true,true,true]);
// A real legacy document predates the three boolean fields entirely — only its old scheduleView
// string exists — so the fixture must delete them, not just set scheduleView on an already-migrated one.
const legacyShaped=(view)=>{const d=make();delete d.settings.scheduleShowAcademic;delete d.settings.scheduleShowSports;delete d.settings.scheduleShowAppointments;d.settings.scheduleView=view;return d}
const migratedAcademic=model.normalizeData(legacyShaped('academic'));
assert.deepEqual([migratedAcademic.settings.scheduleShowAcademic,migratedAcademic.settings.scheduleShowSports,migratedAcademic.settings.scheduleShowAppointments],[true,false,true]);
const migratedSports=model.normalizeData(legacyShaped('sports'));
assert.deepEqual([migratedSports.settings.scheduleShowAcademic,migratedSports.settings.scheduleShowSports,migratedSports.settings.scheduleShowAppointments],[false,true,true]);
const migratedAll=model.normalizeData(legacyShaped('all'));
assert.deepEqual([migratedAll.settings.scheduleShowAcademic,migratedAll.settings.scheduleShowSports,migratedAll.settings.scheduleShowAppointments],[true,true,true]);
const explicit=legacyShaped('sports');explicit.settings.scheduleShowAcademic=true;explicit.settings.scheduleShowSports=false;explicit.settings.scheduleShowAppointments=false;
const normalizedExplicit=model.normalizeData(explicit);
assert.deepEqual([normalizedExplicit.settings.scheduleShowAcademic,normalizedExplicit.settings.scheduleShowSports,normalizedExplicit.settings.scheduleShowAppointments],[true,false,false]);
});
test('eventCategory buckets calendar event kinds into academic, sports or appointments',()=>{
for(const kind of ['exam','test','quiz','assignment','study','activity'])assert.equal(model.eventCategory(kind),'academic');
assert.equal(model.eventCategory('sports'),'sports');
for(const kind of ['personal','appointment','other'])assert.equal(model.eventCategory(kind),'appointments');
});
test('an appointment calendar event kind round-trips through normalization instead of being coerced to other',()=>{
const d=make(),pid=d.activeProfileId;d.calendarEvents=[{id:'evt1',profileId:pid,date:'2026-09-20',title:'Dentist',kind:'appointment',notes:''}];
assert.equal(model.normalizeData(d).calendarEvents[0].kind,'appointment');
});
test('a sports match result is clamped, derives the right outcome, and a malformed one is dropped rather than failing the save',()=>{
const d=make(),pid=d.activeProfileId;
d.calendarEvents=[
 {id:'win',profileId:pid,date:'2026-09-20',title:'Home game',kind:'sports',notes:'',result:{ourScore:3,opponentScore:1}},
 {id:'clamped',profileId:pid,date:'2026-09-21',title:'Blowout',kind:'sports',notes:'',result:{ourScore:9999,opponentScore:-5}},
 {id:'malformed',profileId:pid,date:'2026-09-22',title:'Bad data',kind:'sports',notes:'',result:{ourScore:'nope',opponentScore:2}},
];
const normalized=model.normalizeData(d)
const [win,clamped,malformed]=normalized.calendarEvents
same(win.result,{ourScore:3,opponentScore:1});assert.equal(model.matchOutcome(win.result),'win')
same(clamped.result,{ourScore:999,opponentScore:0});
assert.equal(malformed.result,undefined)
assert.equal(model.matchOutcome({ourScore:1,opponentScore:1}),'tie')
assert.equal(model.matchOutcome({ourScore:0,opponentScore:2}),'loss')
same(model.normalizeData(normalized),normalized)
});
test('a pre-free-placement grid decor (col/row, no x/y) survives normalization instead of rejecting the save',()=>{
const d=make(),pid=d.activeProfileId;d.sanctuaryDecor[pid].placements=[{id:'p1',assetId:'mailbox',col:2,row:3,rotation:90}];
const normalized=model.normalizeData(d);const placement=normalized.sanctuaryDecor[pid].placements[0];
assert.equal(placement.id,'p1');assert.equal(placement.assetId,'mailbox');assert.equal(placement.x,0.5);assert.equal(placement.y,0.5);assert.equal(placement.rotation,90);
assert.equal(placement.scale,1);assert.equal(placement.skewX,0);
same(model.normalizeData(normalized),normalized);
});
test('placement scale/skewX round-trip and clamp to their safe ranges',()=>{
const d=make(),pid=d.activeProfileId;d.sanctuaryDecor[pid].placements=[{id:'p1',assetId:'mailbox',x:0.3,y:0.4,rotation:0,scale:1.6,skewX:-20},{id:'p2',assetId:'bench',x:0.6,y:0.6,rotation:0,scale:99,skewX:9999}];
const normalized=model.normalizeData(d);const [a,b]=normalized.sanctuaryDecor[pid].placements;
assert.equal(a.scale,1.6);assert.equal(a.skewX,-20);assert.equal(b.scale,3);assert.equal(b.skewX,60);
same(model.normalizeData(normalized),normalized);
});
test('homeStyle defaults to null, round-trips as a string, and an oversized value fails rather than silently truncating',()=>{
const d=make(),pid=d.activeProfileId;
assert.equal(model.normalizeData(d).sanctuaryDecor[pid].homeStyle,null);
d.sanctuaryDecor[pid].homeStyle='treehouse';
const normalized=model.normalizeData(d);
assert.equal(normalized.sanctuaryDecor[pid].homeStyle,'treehouse');
same(model.normalizeData(normalized),normalized);
d.sanctuaryDecor[pid].homeStyle='x'.repeat(101);
assert.throws(()=>model.normalizeData(d));
});
test('pondStyle defaults to null, round-trips as a string, and an oversized value fails rather than silently truncating',()=>{
const d=make(),pid=d.activeProfileId;
assert.equal(model.normalizeData(d).sanctuaryDecor[pid].pondStyle,null);
d.sanctuaryDecor[pid].pondStyle='round-stone-pond';
const normalized=model.normalizeData(d);
assert.equal(normalized.sanctuaryDecor[pid].pondStyle,'round-stone-pond');
same(model.normalizeData(normalized),normalized);
d.sanctuaryDecor[pid].pondStyle='x'.repeat(101);
assert.throws(()=>model.normalizeData(d));
});
test('home/pond style scale and mirror default sensibly, round-trip, and clamp out-of-range scale',()=>{
const d=make(),pid=d.activeProfileId;
const fresh=model.normalizeData(d).sanctuaryDecor[pid];
assert.equal(fresh.homeStyleScale,1);assert.equal(fresh.homeStyleFlipX,false);
assert.equal(fresh.pondStyleScale,1);assert.equal(fresh.pondStyleFlipX,false);
d.sanctuaryDecor[pid].homeStyleScale=1.6;d.sanctuaryDecor[pid].homeStyleFlipX=true;
d.sanctuaryDecor[pid].pondStyleScale=99;d.sanctuaryDecor[pid].pondStyleFlipX=true;
const normalized=model.normalizeData(d);const decor=normalized.sanctuaryDecor[pid];
assert.equal(decor.homeStyleScale,1.6);assert.equal(decor.homeStyleFlipX,true);
assert.equal(decor.pondStyleScale,3);assert.equal(decor.pondStyleFlipX,true);
same(model.normalizeData(normalized),normalized);
});
test('all cozy color palettes survive save normalization',()=>{
 for(const theme of ['coral','sakura','lavender','mint','honey']){const d=make();d.settings.theme=theme;assert.equal(model.normalizeData(d).settings.theme,theme)}
});
test('repository Undo and Redo preserve independent newer records',async()=>{
const d=make(),r=setup(d);r.scheduleSync=()=>{};await r.update(x=>note(x,'first'));assert.equal(r.canUndo,true);await r.undo();assert.equal(r.getSnapshot().data.notes.length,0);assert.equal(r.canRedo,true);await r.redo();assert.equal(r.getSnapshot().data.notes[0].id,'first');r.state={...r.state,data:note(r.state.data,'remote')};await r.undo();assert.equal(r.state.data.notes.length,1);assert.equal(r.state.data.notes[0].id,'remote');
});
test('repeated reopen complete delete restore never awards the same task twice',()=>{
const w=load('src/store/workspace.ts'),d=make(),pid=d.activeProfileId;d.tasks=[{id:'one',profileId:pid,subjectId:'',title:'One',due:'2026-09-09',done:false,notes:''}];let next=w.completeTask(d,'one',true);for(let i=0;i<3;i++){next=w.completeTask(next,'one',false);next=w.completeTask(next,'one',true)}assert.equal(next.sanctuaryProgress[pid].totalCredits,1);const removed=model.normalizeData(w.captureDeletions(next,w.removeEntry(next,'tasks','one')));next=w.restoreEntry(removed,removed.trash[0].id);assert.equal(next.sanctuaryProgress[pid].totalCredits,1);
});
(async()=>{let failed=0;for(const {name,fn}of tests){defaults();try{await fn();console.log('PASS '+name)}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack)}}console.log(`${tests.length-failed}/${tests.length} positive regression groups passed. Isolated hooks/SQLite; no Site or user-data writes.`);if(failed)process.exitCode=1})().catch(e=>{console.error(e);process.exitCode=1});
