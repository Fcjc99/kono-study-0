// Runs every supabase/migrations/*.sql against a throwaway local PostgreSQL that imitates Supabase
// (auth.users, auth.uid() from the request JWT, the anon/authenticated roles and Supabase's default
// grants), then checks row-level security, automatic backups and KONO support access as real users.
// Skips (exit 0) when no PostgreSQL server binaries are installed.
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto')
const root=path.resolve(__dirname,'..')
const binDir=['/usr/lib/postgresql'].flatMap(base=>fs.existsSync(base)?fs.readdirSync(base).sort().reverse().map(v=>path.join(base,v,'bin')):[]).find(dir=>fs.existsSync(path.join(dir,'initdb')))
if(!binDir){console.log('Supabase policy tests skipped: no PostgreSQL server binaries found.');process.exit(0)}

const asRoot=process.getuid?.()===0
const run=(cmd,args,options={})=>{
 const full=asRoot&&['initdb','pg_ctl'].includes(cmd)?['runuser',['-u','postgres','--',path.join(binDir,cmd),...args]]:[path.join(binDir,cmd),args]
 const result=spawnSync(full[0],full[1],{encoding:'utf8',...options})
 if(result.status!==0)throw new Error(`${cmd} failed: ${result.stderr||result.stdout}`)
 return result.stdout
}
const work=fs.mkdtempSync(path.join(os.tmpdir(),'kono-pg-')),data=path.join(work,'data'),sock=path.join(work,'sock'),port=String(54000+Math.floor(Math.random()*900))
fs.mkdirSync(sock)
if(asRoot){fs.chmodSync(work,0o777);fs.chmodSync(sock,0o777)}
run('initdb',['-D',data,'-U','postgres','--auth=trust','-E','UTF8','--locale=C'])
run('pg_ctl',['-D',data,'-o',`-k ${sock} -p ${port} -c listen_addresses=''`,'-w','-l',path.join(work,'log'),'start'])

const psql=sql=>{
 const result=spawnSync(path.join(binDir,'psql'),['-h',sock,'-p',port,'-U','postgres','-d','postgres','-X','-q','-At','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'})
 if(result.status!==0)throw new Error(result.stderr.trim())
 return result.stdout.trim()
}
/** Runs SQL as a signed-in Supabase user (or anon when id is null), the way PostgREST does. */
const as=(id,sql)=>psql(`begin;\nset local role ${id?'authenticated':'anon'};\nselect set_config('request.jwt.claim.sub','${id??''}',true) is not null;\n${sql}\ncommit;`).split('\n').slice(1).join('\n')
const fails=(id,sql,pattern)=>assert.throws(()=>as(id,sql),pattern)

const tests=[]
const test=(name,fn)=>tests.push({name,fn})
const alice=randomUUID(),bob=randomUUID(),carol=randomUUID(),dave=randomUUID()
const plan=name=>JSON.stringify({schemaVersion:6,profiles:[{id:'p1',name,label:'Fall term'}]}).replace(/'/g,"''")
const save=(id,expected,name)=>JSON.parse(as(id,`select public.kono_save_plan(${expected},'${randomUUID()}','${plan(name)}'::jsonb);`))

try{
 psql(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users(id uuid primary key, email text, created_at timestamptz not null default now(), last_sign_in_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  -- Supabase grants everything in public to these roles by default; migrations must revoke what they don't want.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  insert into auth.users(id,email) values ('${alice}','alice@example.com'),('${bob}','bob@example.com'),('${carol}','carol@example.com'),('${dave}','dave@example.com');
 `)
 for(const file of fs.readdirSync(path.join(root,'supabase','migrations')).filter(f=>f.endsWith('.sql')).sort())psql(fs.readFileSync(path.join(root,'supabase','migrations',file),'utf8'))
 // People run the newest migration by hand in the Supabase SQL editor, sometimes twice: it must be re-runnable.
 for(const again of ['0004_kono_backups_and_support.sql','0005_kono_nightly_backup_support_setup_errors.sql','0006_kono_feedback.sql'])psql(fs.readFileSync(path.join(root,'supabase','migrations',again),'utf8'))

 test('a signed-in person saves their plan and nobody else can read it',()=>{
  assert.equal(save(alice,0,'Alice').revision,1)
  assert.equal(save(bob,0,'Bob').revision,1)
  assert.equal(as(bob,`select count(*) from public.kono_plans where owner='${alice}';`),'0')
  fails(null,'select count(*) from public.kono_plans;',/permission denied/)
 })

 test('opening KONO keeps a backup, skips it when nothing changed, and keeps the newest 30',()=>{
  assert.equal(JSON.parse(as(alice,'select public.kono_backup_on_open();')).backedUp,true)
  assert.equal(JSON.parse(as(alice,'select public.kono_backup_on_open();')).backedUp,false)
  let revision=1
  for(let i=0;i<35;i++){revision=save(alice,revision,'Alice '+i).revision;as(alice,'select public.kono_backup_on_open();')}
  assert.equal(as(alice,`select count(*) from public.kono_plan_backups;`),'30')
  assert.equal(as(alice,`select max(revision) from public.kono_plan_backups;`),String(revision))
  assert.equal(as(bob,`select count(*) from public.kono_plan_backups where owner='${alice}';`),'0')
 })

 test('people who are not KONO support cannot see the admin list, read another plan, or make themselves admin',()=>{
  fails(bob,'select * from public.kono_admin_accounts();',/KONO support access only/)
  fails(bob,`select public.kono_admin_get_plan('${alice}');`,/KONO support access only/)
  fails(bob,`select public.kono_admin_save_plan('${alice}',1,'${randomUUID()}','{}'::jsonb);`,/KONO support access only/)
  fails(bob,'select * from public.kono_admins;',/permission denied/)
  fails(bob,`insert into public.kono_admins(user_id) values ('${bob}');`,/permission denied/)
  fails(bob,`insert into public.kono_admin_audit(account_id,action) values ('${alice}','view');`,/permission denied/)
  assert.equal(as(bob,'select public.kono_is_admin();'),'f')
  for(const fn of ['kono_admin_accounts()',`kono_admin_get_plan('${alice}')`,'kono_is_admin()','kono_backup_on_open()'])fails(null,`select public.${fn};`,/permission denied/)
 })

 test('KONO support lists every account with its email and study profiles',()=>{
  psql(`insert into public.kono_admins(user_id) values ('${carol}');`)
  assert.equal(as(carol,'select public.kono_is_admin();'),'t')
  const rows=as(carol,`select email||'|'||coalesce(profiles,'') from public.kono_admin_accounts() order by email;`).split('\n')
  assert.deepEqual(rows,['alice@example.com|Alice 34 · Fall term','bob@example.com|Bob · Fall term','carol@example.com|','dave@example.com|'])
 })

 test('support opening an account backs it up first and is logged; edits are attributed and logged',()=>{
  const opened=JSON.parse(as(carol,`select public.kono_admin_get_plan('${alice}');`))
  assert.equal(opened.data.profiles[0].name,'Alice 34')
  as(carol,`select public.kono_admin_get_plan('${alice}');`)
  assert.equal(as(alice,`select count(*) from public.kono_plan_backups where reason='before-support';`),'0','an unchanged plan is already backed up, so no duplicate')
  const edited=JSON.parse(as(carol,`select public.kono_admin_save_plan('${alice}',${opened.revision},'${randomUUID()}','${plan('Alice (fixed by support)')}'::jsonb);`))
  assert.equal(edited.revision,opened.revision+1)
  assert.equal(JSON.parse(as(carol,`select public.kono_admin_save_plan('${alice}',${opened.revision},'${randomUUID()}','${plan('stale')}'::jsonb);`)).conflict,true)
  assert.equal(as(alice,`select data->'profiles'->0->>'name' from public.kono_plans;`),'Alice (fixed by support)')
  assert.equal(as(alice,`select changed_by from public.kono_plan_history where revision=${edited.revision};`),carol)
  assert.equal(as(alice,`select string_agg(action,',' order by id) from public.kono_admin_audit;`),'view,edit')
  assert.equal(as(bob,`select count(*) from public.kono_admin_audit;`),'0')
  // A plan changed since its last automatic backup gets a 'before-support' copy when support opens it.
  save(bob,1,'Bob 2')
  as(carol,`select public.kono_admin_get_plan('${bob}');`)
  assert.equal(as(bob,`select count(*) from public.kono_plan_backups where reason='before-support';`),'1')
 })

 test('the nightly job keeps one backup per account, overwritten each night, readable only by its owner',()=>{
  assert.equal(psql('select public.kono_nightly_backup();'),'2')
  const first=as(alice,'select revision from public.kono_plan_nightly;')
  assert.equal(psql('select public.kono_nightly_backup();'),'0','an unchanged plan is not copied again')
  save(alice,Number(as(alice,'select revision from public.kono_plans;')),'Alice later')
  assert.equal(psql('select public.kono_nightly_backup();'),'1')
  assert.equal(as(alice,'select count(*) from public.kono_plan_nightly;'),'1')
  assert.notEqual(as(alice,'select revision from public.kono_plan_nightly;'),first)
  assert.equal(as(alice,"select data->'profiles'->0->>'name' from public.kono_plan_nightly;"),'Alice later')
  assert.equal(as(bob,`select count(*) from public.kono_plan_nightly where owner='${alice}';`),'0')
  fails(alice,'select public.kono_nightly_backup();',/permission denied/)
  fails(alice,`delete from public.kono_plan_nightly;`,/permission denied/)
  assert.equal(JSON.parse(as(carol,`select public.kono_admin_get_nightly('${alice}');`)).data.profiles[0].name,'Alice later')
  fails(bob,`select public.kono_admin_get_nightly('${alice}');`,/KONO support access only/)
 })

 test('KONO support can set up the first plan for an account that has never saved',()=>{
  assert.equal(JSON.parse(as(carol,`select public.kono_admin_get_plan('${dave}');`)).data,null)
  const made=JSON.parse(as(carol,`select public.kono_admin_save_plan('${dave}',0,'${randomUUID()}','${plan('Dave')}'::jsonb);`))
  assert.deepEqual(made,{revision:1,conflict:false})
  assert.equal(as(dave,"select data->'profiles'->0->>'name' from public.kono_plans;"),'Dave')
  assert.equal(JSON.parse(as(carol,`select public.kono_admin_save_plan('${dave}',0,'${randomUUID()}','${plan('Again')}'::jsonb);`)).conflict,true)
  fails(bob,`select public.kono_admin_save_plan('${randomUUID()}',0,'${randomUUID()}','${plan('x')}'::jsonb);`,/KONO support access only/)
 })

 test('app errors: people can report their own, only KONO support can read them',()=>{
  as(bob,"insert into public.kono_client_errors(message,page) values ('Boom','Planner');")
  fails(bob,`insert into public.kono_client_errors(user_id,message) values ('${alice}','spoof');`,/row-level security/)
  fails(null,"insert into public.kono_client_errors(message) values ('anon');",/permission denied/)
  assert.equal(as(bob,'select count(*) from public.kono_client_errors;'),'0')
  assert.equal(as(carol,"select message||'|'||user_id from public.kono_client_errors;"),'Boom|'+bob)
 })

 test('feedback: people send their own, only KONO support can read and clear it',()=>{
  as(bob,"insert into public.kono_feedback(message,page) values ('The Friday lab is missing','Settings');")
  fails(bob,`insert into public.kono_feedback(user_id,message) values ('${alice}','spoof');`,/row-level security/)
  fails(null,"insert into public.kono_feedback(message) values ('anon');",/permission denied/)
  fails(bob,"insert into public.kono_feedback(message) values ('');",/check constraint/)
  assert.equal(as(bob,'select count(*) from public.kono_feedback;'),'0','people can’t read feedback, even their own')
  as(bob,'delete from public.kono_feedback;');assert.equal(psql('select count(*) from public.kono_feedback;'),'1','a regular account can’t clear feedback')
  assert.equal(as(carol,"select message||'|'||user_id||'|'||page from public.kono_feedback;"),'The Friday lab is missing|'+bob+'|Settings')
  as(carol,'delete from public.kono_feedback;');assert.equal(psql('select count(*) from public.kono_feedback;'),'0')
 })

 test('deleting your cloud study data also deletes its automatic backups',()=>{
  const revision=Number(as(alice,'select revision from public.kono_plans;'))
  as(alice,`select public.kono_delete_plan(${revision},'${randomUUID()}');`)
  assert.equal(as(alice,'select count(*) from public.kono_plan_backups;'),'0')
  assert.equal(psql(`select count(*) from public.kono_plan_nightly where owner='${alice}';`),'0')
 })
}catch(error){tests.length=0;console.error('FAIL setting up the database');console.error(error);process.exitCode=1}

let passed=0
for(const t of tests){try{t.fn();passed++;console.log('PASS',t.name)}catch(e){console.error('FAIL',t.name);console.error(e);process.exitCode=1}}
try{run('pg_ctl',['-D',data,'-m','immediate','stop'])}catch{}
fs.rmSync(work,{recursive:true,force:true})
console.log(`${passed}/${tests.length} Supabase policy groups passed.`)
