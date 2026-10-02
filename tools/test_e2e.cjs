// End-to-end checks of KONO's core flows against the production build (`vite preview` of dist/).
// Run `npm run build` first. Every test starts from an empty browser profile, blocks all non-local
// network (weather, sign-in) so results don't depend on outside services, and fails on any page error.
// Set PLAYWRIGHT_TEST_EXECUTABLE to use a pre-installed Chromium instead of `npx playwright install`.
const {spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict')
const {chromium}=require('playwright')
const ROOT=path.resolve(__dirname,'..'),PORT=Number(process.env.KONO_E2E_PORT||4179),BASE=`http://localhost:${PORT}/`
const ARTIFACTS=path.join(ROOT,'test-results','e2e')

function startServer(){
 if(!fs.existsSync(path.join(ROOT,'dist','client','index.html')))throw new Error('No production build found. Run `npm run build` first.')
 const proc=spawn(process.execPath,[path.join(ROOT,'node_modules','vite','bin','vite.js'),'preview','--port',String(PORT),'--strictPort'],{cwd:ROOT,stdio:'pipe'})
 let output='',exited=null
 proc.stdout.on('data',data=>{output+=data});proc.stderr.on('data',data=>{output+=data})
 proc.on('exit',code=>{exited=code})
 // Wait for the port to answer rather than parsing log text, which differs between terminals and CI.
 return new Promise((resolve,reject)=>{
  const started=Date.now()
  const poll=async()=>{
   if(exited!==null)return reject(new Error(`vite preview exited early (${exited}):\n${output}`))
   try{const response=await fetch(BASE);if(response.ok)return resolve(proc)}catch{/* not listening yet */}
   if(Date.now()-started>60000){proc.kill();return reject(new Error(`vite preview did not answer on ${BASE} within 60s:\n${output}`))}
   setTimeout(poll,250)
  }
  void poll()
 })
}

let browser
async function freshPage(options={}){
 const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:true,viewport:{width:1280,height:900},...options})
 await context.route(url=>!url.href.startsWith(BASE),route=>route.abort())
 const page=await context.newPage(),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 page.setDefaultTimeout(10000)
 return {context,page,errors}
}
/** A device-only plan (the demo), which needs no account. */
async function createPlan(page){
 await page.goto(BASE)
 await page.getByRole('button',{name:'Try a small demo instead'}).click()
 await heading(page,'Sanctuary')
}
const mainHeading=page=>page.locator('#workspace-main h1').first()
async function heading(page,name){await page.waitForFunction(n=>document.querySelector('#workspace-main h1')?.textContent?.startsWith(n),name)}
async function go(page,name){
 // By visible text or by name: on phones the Sanctuary tab reads "Home" but is still named Sanctuary.
 await page.locator('nav button:visible, nav a:visible').filter({hasText:name}).or(page.locator(`nav button:visible[aria-label="${name}"]`)).first().click()
 await heading(page,name)
}
async function settingsTab(page,name){
 const tab=page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name,exact:true})
 await tab.click()
 await page.waitForFunction(n=>[...document.querySelectorAll('nav[aria-label="Settings sections"] button')].some(el=>el.textContent===n&&el.getAttribute('aria-current')==='page'),name)
}
/** Planner › ＋ Add to my calendar, then one of its choices. */
async function addToCalendar(page,choice){
 await go(page,'Planner')
 await page.getByRole('button',{name:'＋ Add to my calendar'}).click()
 await page.getByRole('group',{name:'What do you have?'}).getByRole('button',{name:new RegExp('^'+choice.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).click()
 await page.getByRole('region',{name:'Add to my calendar'}).getByRole('heading',{name:new RegExp(choice.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).waitFor()
}
async function addFromMenu(page,type,title,extra){
 await page.getByRole('button',{name:'＋ Add',exact:true}).click()
 const chooser=page.getByRole('dialog',{name:'Add to your plan'})
 await chooser.getByLabel('Add type').selectOption(type)
 await chooser.getByRole('button',{name:'Continue'}).click()
 const editor=page.locator('dialog[open]')
 await editor.getByLabel('Title').fill(title)
 if(extra)await extra(editor)
 await editor.getByRole('button',{name:'Save',exact:true}).click()
 await editor.waitFor({state:'detached'}).catch(()=>{})
}
/** Waits until the debounced save has reached IndexedDB, so a reload reads what the test just did. */
async function flushSave(page,text){
 await page.waitForFunction(needle=>new Promise(resolve=>{const request=indexedDB.open('kono-recovery-and-sync',1);request.onsuccess=()=>{const db=request.result,get=db.transaction('plans').objectStore('plans').get('device');get.onsuccess=()=>{db.close();resolve(JSON.stringify(get.result??'').includes(needle))};get.onerror=()=>{db.close();resolve(false)}};request.onerror=()=>resolve(false)}),text,{timeout:10000,polling:250})
}

const tests=[]
const test=(name,fn)=>tests.push({name,fn})

test('a new visitor is asked to sign in with email to start, and can try the demo instead',async({page})=>{
 await page.goto(BASE)
 await page.getByRole('heading',{name:'A little space for steady progress.'}).waitFor()
 await page.getByLabel('Email address').waitFor()
 await page.getByRole('button',{name:'Email me a link to start'}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Create my study plan'}).count(),0,'a plan can be created without an account')
 await createPlan(page)
 for(const name of ['Planner','Notes','Exams','Settings','Sanctuary'])await go(page,name)
})

test('a device-only plan is nudged to save to an email account; "Remind me tomorrow" is remembered',async({page})=>{
 await createPlan(page)
 const banner=page.getByRole('region',{name:'Save your plan to your email'})
 await banner.waitFor()
 await banner.getByRole('button',{name:'Remind me tomorrow'}).click()
 await banner.waitFor({state:'detached'})
 await page.reload()
 await mainHeading(page).waitFor()
 assert.equal(await banner.count(),0)
})

test('homework added in the Planner survives a reload',async({page})=>{
 await createPlan(page)
 await go(page,'Planner')
 await addFromMenu(page,'tasks','Read chapter 3 (e2e)')
 await page.getByText('Read chapter 3 (e2e)').filter({visible:true}).first().waitFor()
 await flushSave(page,'Read chapter 3 (e2e)')
 await page.reload()
 await go(page,'Planner')
 await page.getByText('Read chapter 3 (e2e)').filter({visible:true}).first().waitFor()
})

test('a study note can be moved to Trash and restored',async({page})=>{
 await createPlan(page)
 await addFromMenu(page,'notes','Mitochondria facts (e2e)')
 await go(page,'Notes')
 const note=page.locator('article.kono-sticky').filter({hasText:'Mitochondria facts (e2e)'})
 await note.waitFor()
 await note.getByRole('button',{name:'Delete note'}).click()
 await page.getByRole('button',{name:'Confirm'}).click()
 await page.getByText('Mitochondria facts (e2e)').first().waitFor({state:'hidden'})
 await page.getByRole('button',{name:'Trash'}).first().click()
 await heading(page,'Trash')
 const row=page.locator('li, article, tr, .wb-panel > div').filter({hasText:'Mitochondria facts (e2e)'}).last()
 await row.getByRole('button',{name:'Restore'}).click()
 await go(page,'Notes')
 await page.getByText('Mitochondria facts (e2e)').first().waitFor()
})

test('Planner › ＋ Add to my calendar: one place to start, each choice opens its tool, and Settings points there',async({page})=>{
 await createPlan(page)
 await go(page,'Planner')
 await page.getByRole('button',{name:'＋ Add to my calendar'}).click()
 const hub=page.getByRole('region',{name:'Add to my calendar'}),choices=hub.getByRole('group',{name:'What do you have?'})
 assert.equal(await choices.getByRole('button').count(),7)
 const opens={'My school schedule':'School calendar & rotation','My college classes':'College semester','A calendar link':'Or paste a calendar link','Photos or screenshots':null,'A PDF of dates':'Import PDF','A weekly activity':null,'A sports season':null}
 for(const [choice,expect] of Object.entries(opens)){
  await choices.getByRole('button',{name:new RegExp('^'+choice)}).click()
  await hub.getByRole('heading',{name:new RegExp(choice+'$')}).waitFor()
  await hub.locator('.lazy-panel-loading').first().waitFor({state:'detached'}).catch(()=>{})
  assert.equal(await hub.locator('.lazy-panel-error').count(),0,choice+' failed to load')
  if(expect)assert.ok(await hub.getByText(expect,{exact:false}).first().count(),choice+' opened the wrong tool')
  await hub.getByRole('button',{name:'← Other options'}).click()
 }
 await hub.getByRole('button',{name:'Done'}).click()
 await hub.waitFor({state:'detached'})
 await page.locator('summary',{hasText:'Plan my week'}).waitFor()
 // Import & export points to the hub instead of repeating the importers.
 await go(page,'Settings');await settingsTab(page,'Import & export')
 assert.equal(await page.getByText('Import from Google Calendar, Apple Calendar, Canvas or Classroom').count(),0)
 await page.locator('.add-moved').getByRole('button',{name:'＋ Add to my calendar'}).click()
 await heading(page,'Planner');await hub.waitFor()
})

test('every Settings tab opens, and a theme choice survives a reload',async({page})=>{
 await createPlan(page)
 await go(page,'Settings')
 for(const tab of ['Look & feel','Notifications','Family','Schedules','Import & export','Plans & account']){
  await settingsTab(page,tab)
  // On-demand panels finish loading (or show their reload fallback) rather than hanging.
  await page.locator('.lazy-panel-loading').first().waitFor({state:'detached'}).catch(()=>{})
  assert.equal(await page.locator('.lazy-panel-error').count(),0,`a panel on ${tab} failed to load`)
 }
 await settingsTab(page,'Look & feel')
 await page.getByRole('button',{name:/Modern/}).first().click()
 const experience=()=>page.evaluate(()=>document.documentElement.dataset.experience??document.documentElement.className)
 const chosen=await experience()
 assert.match(chosen,/modern/i)
 await flushSave(page,'"experience":"modern"')
 await page.reload()
 await mainHeading(page).waitFor()
 assert.equal(await experience(),chosen)
})

test('Team colors have their own section in Look & feel: each team sets its jersey, one from Modern switches to Cozy, and the choice survives a reload',async({page})=>{
 await createPlan(page)
 await go(page,'Settings')
 const root=()=>page.evaluate(()=>[document.documentElement.dataset.experience,document.documentElement.dataset.theme,document.documentElement.dataset.team??''].join(' '))
 // Starting from Modern (fixed colors): picking a team switches to Cozy.
 await settingsTab(page,'Look & feel')
 await page.getByRole('button',{name:/Modern/}).first().click()
 const teams=page.getByRole('group',{name:'Team colors'})
 assert.equal(await teams.getByRole('button').count(),8)
 await page.getByText('picking one switches you to Cozy',{exact:false}).waitFor()
 await teams.getByRole('button',{name:/Hanover High · Navy & Gold/}).click()
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='hanover')
 assert.equal(await root(),'cozy hanover dark')
 assert.equal(await teams.getByRole('button',{pressed:true}).innerText().then(t=>t.split('\n')[0]),'Hanover High · Navy & Gold ✓')
 await teams.getByRole('button',{name:/Notre Dame Academy/}).click()
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='nda')
 assert.equal(await root(),'cozy nda light','Notre Dame Academy is a white (light) jersey')
 // Look & feel says team colors are on, and a regular palette turns them off.
 await page.getByText('You’re using team colors.',{exact:false}).waitFor()
 await teams.getByRole('button',{name:/Duxbury · Black & Green/}).click()
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='dragonsblack')
 await flushSave(page,'"theme":"dragonsblack"')
 await page.reload()
 await mainHeading(page).waitFor()
 assert.equal(await root(),'cozy dragonsblack dark')
 await go(page,'Settings');await settingsTab(page,'Look & feel')
 await page.locator('.wb-themes button.theme-ocean').click()
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='ocean')
 assert.equal(await root(),'cozy ocean ','a regular palette clears data-team')
})

test('panels that load on demand (K-Quiz, Flashcards) open without errors',async({page})=>{
 await createPlan(page)
 await go(page,'K-Quiz')
 await page.locator('[class*=kquiz]').first().waitFor()
 await go(page,'Notes')
 await page.getByText('Quiz me · Flashcards').click()
 await page.getByText('Your flashcards').first().waitFor()
})

test('a save this build cannot read shows the recovery screen, not onboarding, and is left untouched',async({page})=>{
 await createPlan(page)
 await addFromMenu(page,'tasks','Keep me safe (e2e)')
 await flushSave(page,'Keep me safe (e2e)')
 const corrupt=()=>page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('kono-recovery-and-sync',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('plans','readwrite'),store=tx.objectStore('plans'),get=store.get('device');get.onsuccess=()=>{const entry=get.result;entry.data.tasks.push({...entry.data.tasks[0]});store.put(entry,'device')};tx.oncomplete=()=>{db.close();resolve()}}}))
 const snapshot=()=>page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('kono-recovery-and-sync',1);request.onsuccess=()=>{const db=request.result,get=db.transaction('plans').objectStore('plans').get('device');get.onsuccess=()=>{db.close();resolve(JSON.stringify(get.result))}}}))
 await corrupt()
 const before=await snapshot()
 await page.reload()
 await page.getByRole('heading',{name:"We couldn't open your saved plan"}).waitFor()
 assert.equal(await page.getByRole('button',{name:'Create my study plan'}).count(),0)
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download a copy of my data'}).click()])
 const saved=fs.readFileSync(await download.path(),'utf8')
 assert.ok(saved.includes('Keep me safe (e2e)'),'the downloaded copy is missing the saved plan')
 await page.waitForTimeout(1500)
 assert.equal(await snapshot(),before,'the unreadable save was modified')
})

test('the backup export contains the plan',async({page})=>{
 await createPlan(page)
 await addFromMenu(page,'tasks','Back me up (e2e)')
 await go(page,'Settings')
 await settingsTab(page,'Import & export')
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export backup'}).click()])
 const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'))
 assert.ok(JSON.stringify(backup).includes('Back me up (e2e)'))
})

test('phone-sized screens have no sideways scrolling on the main pages',async({context,page})=>{
 await context.close()
 const phone=await freshPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
 try{
  await createPlan(phone.page)
  for(const name of ['Sanctuary','Planner','Notes','Settings']){
   await go(phone.page,name)
   await phone.page.waitForTimeout(300)
   const overflow=await phone.page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
   assert.ok(overflow<=1,`${name} scrolls sideways by ${overflow}px on a phone`)
  }
  assert.deepEqual(phone.errors,[])
 }finally{await phone.context.close()}
})

test('iPhone SE: no sideways scrolling, no zoom-on-tap inputs, a one-line save box, and three days in Week',async({context,page})=>{
 await context.close()
 const phone=await freshPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true})
 try{
  const p=phone.page
  await createPlan(p)
  // The save-to-email box is one line on a phone and opens to the form when tapped.
  const box=p.getByRole('region',{name:'Save your plan to your email'})
  await box.getByText('Only saved on this device.').waitFor()
  assert.ok((await box.boundingBox()).height<90,'the save box stays one line on a phone')
  await box.getByRole('button',{name:'Back it up'}).click()
  await box.getByLabel('Email address').waitFor()
  for(const name of ['Sanctuary','Planner','Notes','Exams','Settings']){
   await go(p,name)
   await p.waitForTimeout(300)
   const found=await p.evaluate(()=>{
    const over=document.documentElement.scrollWidth-document.documentElement.clientWidth
    const small=[...document.querySelectorAll('input,select,textarea')].filter(el=>el.offsetParent&&!['checkbox','radio','range','color','file','hidden'].includes(el.type)&&parseFloat(getComputedStyle(el).fontSize)<16).map(el=>el.getAttribute('aria-label')||el.name||el.type)
    return {over,small}
   })
   assert.ok(found.over<=1,`${name} scrolls sideways by ${found.over}px on an iPhone SE`)
   assert.deepEqual(found.small,[],`${name} has inputs under 16px, so iOS zooms in when they're tapped`)
  }
  // Week shows three days from the selected one, and the arrows move by three.
  await go(p,'Planner')
  assert.equal(await p.getByLabel('Calendar view').inputValue(),'week')
  const week=p.getByRole('region',{name:'Week'})
  assert.equal(await week.locator('.week-grid-head button').count(),3)
  const first=await week.locator('.week-grid-head button').first().getAttribute('aria-label')
  await p.getByRole('button',{name:'Next days'}).click()
  assert.notEqual(await week.locator('.week-grid-head button').first().getAttribute('aria-label'),first)
  assert.deepEqual(phone.errors,[])
 }finally{await phone.context.close()}
})

// ---------------------------------------------------------------- signed-in flows against a fake Supabase
// Answers the auth/REST/RPC calls KONO makes from in-memory state, so account features can be exercised
// in the real UI without a live project. The SQL behind these calls is tested in test_supabase_policies.cjs.
const fixture=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','save-2026-09.json'),'utf8'))
function supabaseHost(){
 const assets=path.join(ROOT,'dist','client','assets')
 for(const file of fs.readdirSync(assets).filter(f=>f.endsWith('.js'))){const m=fs.readFileSync(path.join(assets,file),'utf8').match(/https:\/\/([a-z0-9]+)\.supabase\.co/);if(m)return m[1]}
 throw new Error('No Supabase URL found in the build.')
}
function fakeCloud(){
 const named=(name,email)=>{const d=fixture();d.profiles[0].name=name;return {email,admin:false,plan:{revision:3,data:d}}}
 return {users:{alice:named('Alice','alice@example.com'),carol:{...named('Carol','carol@example.com'),admin:true},dave:{email:'dave@example.com',admin:false,plan:{revision:0,data:null}}},me:'alice',calls:[],audit:[],errors:[],feedback:[],nightly:{},feeds:[],catalog:[]}
}
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
function sessionFor(cloud,id){
 const exp=Math.floor(Date.now()/1000)+3600
 const user={id,aud:'authenticated',role:'authenticated',email:cloud.users[id].email,app_metadata:{},user_metadata:{},created_at:'2026-09-01T00:00:00Z'}
 return {access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:id,exp,role:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:exp,refresh_token:'fake-refresh',user}
}
async function signInAs(context,cloud,id){
 cloud.me=id
 await context.addInitScript(([key,value])=>localStorage.setItem(key,value),[`sb-${supabaseHost()}-auth-token`,JSON.stringify(sessionFor(cloud,id))])
 await routeCloud(context,cloud)
}
/** The fake Supabase: sign-in emails and codes, plans, support, feeds. The code in every sign-in email is 123456. */
async function routeCloud(context,cloud){
 await context.route(/\.supabase\.co\//,async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method(),where=url.pathname
  if(cloud.offline)return route.abort('internetdisconnected')
  const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
  if(method==='OPTIONS')return route.fulfill({status:204,headers:cors})
  const body=request.postData()?JSON.parse(request.postData()):null,me=cloud.users[cloud.me]
  cloud.calls.push({method,where,body,as:cloud.me})
  const reply=(json,status=200)=>route.fulfill({status,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(json)})
  const denied=()=>reply({code:'P0001',message:'KONO support access only'},400)
  const saveTo=(owner,expected)=>{if(owner.plan.revision!==expected)return reply({revision:owner.plan.revision,conflict:true});owner.plan={revision:expected+1,data:body.p_data};return reply({revision:owner.plan.revision,conflict:false})}
  switch(where){
   case '/auth/v1/token':return reply(sessionFor(cloud,cloud.me))
   case '/auth/v1/otp':cloud.emails=[...(cloud.emails??[]),body.email];return reply({})
   case '/auth/v1/verify':{
    const id=Object.keys(cloud.users).find(k=>cloud.users[k].email===body.email)
    if(!id||body.token!=='123456')return reply({code:403,error_code:'otp_expired',msg:'Token has expired or is invalid'},403)
    cloud.me=id;return reply(sessionFor(cloud,id))
   }
   case '/rest/v1/rpc/kono_backup_on_open':return reply({backedUp:true,revision:me.plan.revision})
   case '/rest/v1/rpc/kono_is_admin':return reply(me.admin)
   case '/rest/v1/rpc/kono_save_plan':return saveTo(me,body.p_expected_revision)
   case '/rest/v1/rpc/kono_admin_accounts':return me.admin?reply(Object.entries(cloud.users).map(([id,u])=>({user_id:id,email:u.email,created_at:'2026-09-01T00:00:00Z',last_sign_in_at:'2026-09-24T00:00:00Z',revision:u.plan.revision,updated_at:'2026-09-24T00:00:00Z',profiles:(u.plan.data?.profiles??[]).map(p=>p.name+' · '+p.label).join(', '),username:null}))):denied()
   case '/rest/v1/rpc/kono_admin_get_plan':{if(!me.admin)return denied();const owner=cloud.users[body.p_owner];cloud.audit.push({id:cloud.audit.length+1,account_id:body.p_owner,admin_id:cloud.me,action:'view',revision:owner.plan.revision,created_at:new Date().toISOString()});return reply({revision:owner.plan.revision,data:owner.plan.data})}
   case '/rest/v1/rpc/kono_admin_save_plan':{if(!me.admin)return denied();const result=saveTo(cloud.users[body.p_owner],body.p_expected_revision);cloud.audit.push({id:cloud.audit.length+1,account_id:body.p_owner,admin_id:cloud.me,action:'edit',revision:null,created_at:new Date().toISOString()});return result}
   case '/rest/v1/kono_plans':return reply([{revision:me.plan.revision,data:me.plan.data}])
   case '/rest/v1/kono_admin_audit':return reply(me.admin?cloud.audit:cloud.audit.filter(a=>a.account_id===cloud.me))
   case '/rest/v1/kono_shared_snapshots':return reply([],201)
   case '/rest/v1/kono_school_catalog':{if(method==='POST'){const rows=Array.isArray(body)?body:[body];for(const r of rows)cloud.catalog.push({...r,created_at:new Date().toISOString()});return reply([],201)}return reply(cloud.catalog)}
   case '/rest/v1/kono_connections':{if(method!=='GET')return reply([],201);return reply((cloud.connections??[]).filter(c=>c.requester_id===cloud.me||c.recipient_id===cloud.me))}
   case '/rest/v1/kono_profiles':{
    const ids=(url.searchParams.get('user_id')??'').replace(/^(eq\.|in\.\()/,'').replace(/\)$/,'').split(',')
    return reply(Object.entries(cloud.profiles??{}).filter(([id])=>ids.includes(id)).map(([id,p])=>({user_id:id,username:p.username,display_name:p.displayName})))
   }
   case '/rest/v1/kono_shared_items':{
    cloud.shared??=[]
    if(method==='POST'){const rows=Array.isArray(body)?body:[body];for(const r of rows)cloud.shared.push({id:'share-'+(cloud.shared.length+1)+'-'+Date.now(),created_at:new Date().toISOString(),...r});return reply([],201)}
    if(method==='DELETE'){const id=(url.searchParams.get('id')??'').replace('eq.','');cloud.shared=cloud.shared.filter(r=>!(r.id===id&&(r.recipient_id===cloud.me||r.sender_id===cloud.me)));return reply([],204)}
    return reply(cloud.shared.filter(r=>r.recipient_id===cloud.me))
   }
   case '/rest/v1/kono_plan_nightly':{const n=cloud.nightly[cloud.me];return reply(n?[n]:[])}
   case '/rest/v1/rpc/kono_admin_get_nightly':{if(!me.admin)return denied();return reply(cloud.nightly[body.p_owner]??null)}
   case '/rest/v1/kono_client_errors':if(method==='POST'){const rows=Array.isArray(body)?body:[body];for(const r of rows)cloud.errors.push({id:cloud.errors.length+1,user_id:cloud.me,created_at:new Date().toISOString(),...r});return reply([],201)}return reply(me.admin?[...cloud.errors].reverse():[])
   case '/rest/v1/kono_feedback':{if(method==='POST'){const rows=Array.isArray(body)?body:[body];for(const r of rows)cloud.feedback.push({id:cloud.feedback.length+1,user_id:cloud.me,created_at:new Date().toISOString(),...r});return reply([],201)}if(method==='DELETE'){const id=Number((url.searchParams.get('id')??'').replace('eq.',''));if(me.admin)cloud.feedback=cloud.feedback.filter(f=>f.id!==id);return reply([],204)}return reply(me.admin?[...cloud.feedback].reverse():[])}
   case '/rest/v1/kono_calendar_feeds':{
    const profile=(url.searchParams.get('profile_id')??'').replace('eq.',''),mine=cloud.feeds.filter(f=>f.user_id===cloud.me)
    if(method==='POST'){const row={user_id:cloud.me,profile_id:body.profile_id,token:'ab12'.repeat(12)};cloud.feeds.push(row);return reply({token:row.token},201)}
    if(method==='DELETE'){cloud.feeds=cloud.feeds.filter(f=>!(f.user_id===cloud.me&&f.profile_id===profile));return reply([],204)}
    return reply(mine.filter(f=>f.profile_id===profile).map(f=>({token:f.token})))
   }
   default:return reply([])
  }
 })
}
const accountStatus=page=>page.locator('.save-status [role=status]').first()

test('signed in: KONO keeps an automatic backup on open, shows no sign-in nudge, and regular accounts get no support tab',async({context,page})=>{
 const cloud=fakeCloud()
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 await page.waitForFunction(()=>document.querySelector('.save-status [role=status]')?.textContent?.includes('alice@example.com'))
 await page.waitForTimeout(500)
 assert.ok(cloud.calls.some(c=>c.where==='/rest/v1/rpc/kono_backup_on_open'),'no automatic backup was requested on open')
 assert.equal(await page.getByRole('region',{name:'Save your plan to your email'}).count(),0)
 await go(page,'Settings')
 assert.equal(await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'KONO support'}).count(),0)
})

test('signed in: changes upload to the account, and a brand-new device opens the same plan (the lost-account bug)',async({context,page})=>{
 const cloud=fakeCloud()
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 await addFromMenu(page,'tasks','Saved to my account (e2e)')
 for(let i=0;i<40&&!JSON.stringify(cloud.users.alice.plan.data).includes('Saved to my account (e2e)');i++)await page.waitForTimeout(250)
 assert.ok(JSON.stringify(cloud.users.alice.plan.data).includes('Saved to my account (e2e)'),'the change never reached the account')
 const other=await freshPage()
 try{
  await signInAs(other.context,cloud,'alice')
  await other.page.goto(BASE)
  await heading(other.page,'Sanctuary')
  await go(other.page,'Planner')
  await other.page.getByText('Saved to my account (e2e)').filter({visible:true}).first().waitFor()
  assert.deepEqual(other.errors,[])
 }finally{await other.context.close()}
})

test('KONO support can list every account, open one to add something for them, and exit back to their own plan',async({context,page})=>{
 const cloud=fakeCloud()
 await signInAs(context,cloud,'carol')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 await go(page,'Settings')
 await settingsTab(page,'KONO support')
 await page.getByRole('button',{name:'Show all accounts'}).click()
 const row=page.locator('.support-account').filter({hasText:'alice@example.com'})
 await row.waitFor()
 assert.match(await row.innerText(),/Alice · My study plan/)
 assert.match(await page.locator('.support-account').filter({hasText:'carol@example.com'}).innerText(),/You/)
 page.once('dialog',dialog=>void dialog.accept())
 await row.getByRole('button',{name:'Open to help'}).click()
 const banner=page.locator('.support-banner')
 await banner.waitFor()
 assert.match(await banner.innerText(),/alice@example\.com/)
 await page.waitForFunction(()=>document.querySelector('.save-status [role=status]')?.textContent?.includes('Helping: alice@example.com'))
 const publishedBefore=cloud.calls.filter(c=>c.where==='/rest/v1/kono_shared_snapshots').length
 await addFromMenu(page,'tasks','Added by support (e2e)')
 for(let i=0;i<40&&!JSON.stringify(cloud.users.alice.plan.data).includes('Added by support (e2e)');i++)await page.waitForTimeout(250)
 assert.ok(JSON.stringify(cloud.users.alice.plan.data).includes('Added by support (e2e)'),"the change didn't reach Alice's account")
 assert.ok(!JSON.stringify(cloud.users.carol.plan.data).includes('Added by support (e2e)'),"the change leaked into the support person's own plan")
 assert.ok(cloud.calls.some(c=>c.where==='/rest/v1/rpc/kono_admin_save_plan'&&c.body.p_owner==='alice'))
 assert.equal(cloud.calls.filter(c=>c.where==='/rest/v1/kono_shared_snapshots').length,publishedBefore,"Alice's plan was published as a friend snapshot")
 assert.deepEqual(cloud.audit.map(a=>a.action).filter((a,i,all)=>all.indexOf(a)===i),['view','edit'])
 await banner.getByRole('button',{name:'Exit support'}).click()
 await page.waitForFunction(()=>document.querySelector('.save-status [role=status]')?.textContent?.includes('Account: carol@example.com'))
 assert.equal(await banner.count(),0)
})

test('keyboard: K-Quiz practice questions and flashcards keep focus inside, close with Escape, and return focus',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data
 plan.kquizSets=[{id:'set-1',profileId:plan.activeProfileId,subjectId:'',title:'Cells (e2e)',createdAt:'2026-09-20T00:00:00Z',flashcardDeckId:plan.flashcardDecks[0].id,practiceTest:{questions:[{id:'q1',type:'mcq',prompt:'Powerhouse of the cell?',choices:['Mitochondria','Nucleus'],correctIndex:0}]}}]
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await mainHeading(page).waitFor()
 await go(page,'K-Quiz')
 for(const [opener,label] of [['Practice questions','Practice test'],['Flashcards','Flashcards']]){
  const button=page.getByRole('button',{name:new RegExp(opener)}).first()
  await button.click()
  const dialog=page.getByRole('dialog',{name:label})
  await dialog.waitFor()
  assert.ok(await page.evaluate(()=>!!document.activeElement?.closest('[role=dialog]')),`${label}: focus didn't move into the dialog`)
  for(let i=0;i<12;i++){
   await page.keyboard.press(i%3?'Tab':'Shift+Tab')
   assert.ok(await page.evaluate(()=>!!document.activeElement?.closest('[role=dialog]')),`${label}: Tab left the dialog`)
  }
  await page.keyboard.press('Escape')
  await dialog.waitFor({state:'detached'})
  assert.ok(await button.evaluate(el=>el===document.activeElement),`${label}: focus didn't return to the button that opened it`)
 }
})

test('an app on the Home Screen or desktop signs in with the code from the email, right in the app (the link would open the browser)',async({context,page})=>{
 const cloud=fakeCloud()
 await routeCloud(context,cloud)
 await page.goto(BASE)
 await page.getByLabel('Email address').fill('Alice@Example.com')
 await page.getByRole('checkbox',{name:/13 or older/}).check()
 await page.getByRole('button',{name:'Email me a link to start'}).click()
 await page.getByText('Using KONO as an app on your Home Screen or desktop? Use the code',{exact:false}).waitFor()
 assert.deepEqual(cloud.emails,['alice@example.com'])
 const code=page.getByLabel('Code from the email')
 await code.fill('000000');await page.getByRole('button',{name:'Sign in with code'}).click()
 await page.getByText('That code didn’t work. It may have expired',{exact:false}).waitFor()
 await code.fill('123 456');await page.getByRole('button',{name:'Sign in with code'}).click()
 await mainHeading(page).waitFor({timeout:20000})
 const verify=cloud.calls.filter(c=>c.where==='/auth/v1/verify').map(c=>c.body.token+' '+c.body.email+' '+c.body.type)
 assert.deepEqual(verify,['000000 alice@example.com email','123456 alice@example.com email'])
 assert.ok(cloud.calls.some(c=>c.where==='/rest/v1/kono_plans'&&c.as==='alice'),'Alice’s plan loaded after signing in with the code')
})

test('sign-up needs the age and Terms agreement, and the Terms open without ticking the box',async({page})=>{
 await page.goto(BASE)
 await page.getByLabel('Email address').fill('newperson@example.com')
 const box=page.getByRole('checkbox',{name:/13 or older/})
 assert.equal(await box.isChecked(),false)
 await page.getByRole('button',{name:'Email me a link to start'}).click()
 assert.equal(await page.evaluate(()=>document.querySelector('.terms-check input')?.validity.valid??null),false,'the form was allowed to send without the agreement')
 await page.getByRole('button',{name:'Read them'}).click()
 const dialog=page.getByRole('dialog',{name:'Terms and Privacy'})
 await dialog.getByText('You need to be').click()
 await dialog.getByRole('button',{name:'Close'}).last().click()
 await dialog.waitFor({state:'detached'})
 assert.equal(await box.isChecked(),false,'clicking inside the Terms ticked the box')
})

test('KONO support can set up the first plan for an account that has never saved',async({context,page})=>{
 const cloud=fakeCloud()
 await signInAs(context,cloud,'carol')
 await page.goto(BASE)
 await mainHeading(page).waitFor()
 await go(page,'Settings')
 await settingsTab(page,'KONO support')
 await page.getByRole('button',{name:'Show all accounts'}).click()
 const row=page.locator('.support-account').filter({hasText:'dave@example.com'})
 page.once('dialog',dialog=>void dialog.accept())
 await row.getByRole('button',{name:'Set up their plan'}).click()
 await page.getByText('Setting up a plan for').waitFor()
 assert.equal(await page.getByRole('checkbox',{name:/13 or older/}).count(),0,'support was asked to accept the Terms for someone else')
 await page.getByLabel('Your name').fill('Dave')
 await page.getByRole('button',{name:'Create their study plan'}).click()
 for(let i=0;i<40&&!cloud.users.dave.plan.data;i++)await page.waitForTimeout(250)
 assert.equal(cloud.users.dave.plan.data?.profiles?.[0]?.name,'Dave')
 assert.equal(cloud.users.carol.plan.data.profiles[0].name,'Carol')
})

test('signed in: last night\'s backup downloads, and app errors reach KONO support',async({context,page})=>{
 const cloud=fakeCloud()
 cloud.nightly.alice={revision:3,saved_at:'2026-09-25T03:00:00Z',data:cloud.users.alice.plan.data}
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await mainHeading(page).waitFor()
 await go(page,'Settings')
 await settingsTab(page,'Import & export')
 await page.getByText('Nightly backup').click()
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:"Download last night's backup"}).click()])
 assert.ok(fs.readFileSync(await download.path(),'utf8').includes('"Alice"'))
 await page.evaluate(()=>window.dispatchEvent(new ErrorEvent('error',{error:new Error('Boom from e2e'),message:'Boom from e2e'})))
 for(let i=0;i<20&&!cloud.errors.length;i++)await page.waitForTimeout(250)
 assert.equal(cloud.errors[0]?.message,'Boom from e2e')
 assert.ok(!JSON.stringify(cloud.errors[0]).includes('Read chapter 3'),'an error report carried plan content')
})

test('Sanctuary: the island draws, zooms, expands and changes time; Decorate adds, duplicates, removes and keeps items',async({page})=>{
 const loaded=[];page.on('response',r=>{const u=new URL(r.url());if(/\/garden\/(terrace-23\.0|kono)\//.test(u.pathname))loaded.push([u.pathname,r.status()])})
 await createPlan(page)
 const ready=()=>page.waitForFunction(()=>!document.querySelector('.sanctuary-load-status'),null,{timeout:30000})
 // The island loads once it's on screen (for a new plan it's just below Getting started).
 await page.locator('.wb-island').scrollIntoViewIfNeeded()
 await ready()
 // The canvas has real artwork on it (a blank canvas encodes to a tiny image).
 await page.waitForFunction(()=>{const c=document.querySelector('.sanctuary-viewport canvas');return !!c&&c.width>100&&c.toDataURL('image/png').length>60000},null,{timeout:20000})
 assert.ok(loaded.some(([path,status])=>/terrace-23\.0\/(halloween\/)?\w+\.webp$/.test(path)&&status===200),'the island map did not load')
 assert.ok(loaded.every(([,status])=>status===200),'a Sanctuary image failed to load: '+JSON.stringify(loaded.filter(([,st])=>st!==200)))
 const zoom=page.getByRole('group',{name:'Zoom island'})
 await zoom.getByRole('button',{name:'Zoom in'}).click()
 await zoom.getByText('125%').waitFor()
 await zoom.getByRole('button',{name:'Zoom out'}).click()
 await zoom.getByText('100%').waitFor()
 await page.locator('.wb-scene-expand').click()
 await page.locator('.wb-island.is-expanded').waitFor()
 await page.locator('.wb-scene-expand').click()
 await page.locator('.wb-island.is-expanded').waitFor({state:'detached'})
 const phase=await page.getByLabel('Sanctuary time').inputValue()
 // A time whose map isn't loaded yet: near dawn or dusk the island has already loaded the next phase's map
 // to blend into, so switching to it wouldn't fetch anything (which made this test depend on the clock).
 // (In October it's the Halloween island's map: see game/sanctuary/season.ts.)
 const map=p=>new RegExp(`/terrace-23\\.0/(halloween/)?${p}\\.webp$`)
 const other=['evening','night','afternoon','morning'].find(p=>p!==phase&&!loaded.some(([path])=>map(p).test(path)))
 const mapLoaded=page.waitForResponse(r=>map(other).test(new URL(r.url()).pathname)&&r.status()===200,{timeout:20000})
 await page.getByLabel('Sanctuary time').selectOption(other)
 await mapLoaded
 await ready()
 // Decorate
 await page.getByRole('button',{name:'Decorate'}).click()
 const add=page.locator('.build-palette [aria-label^="Add "]').first()
 await add.waitFor()
 await add.click()
 await page.locator('.build-item').first().waitFor()
 assert.equal(await page.locator('.build-item').count(),1)
 // A newly added item comes selected, with its Rotate / Mirror / Duplicate / Remove toolbar.
 await page.locator('.build-item.is-selected').waitFor()
 await page.locator('button[aria-label="Duplicate"]').click()
 await page.waitForFunction(()=>document.querySelectorAll('.build-item').length===2)
 await page.locator('button[aria-label="Remove"]').click()
 await page.waitForFunction(()=>document.querySelectorAll('.build-item').length===1)
 await flushSave(page,'"placements":[{')
 await page.reload()
 await mainHeading(page).waitFor()
 await page.getByRole('button',{name:'Decorate'}).click()
 await page.locator('.build-item').first().waitFor()
 assert.equal(await page.locator('.build-item').count(),1,'the placed item did not survive a reload')
})

test('Work & weekly activities: one list of schedules, one add button; edit adds a day, pause and delete work',async({page})=>{
 await createPlan(page)
 await go(page,'Settings')
 await settingsTab(page,'Schedules')
 const panel=page.locator('#weekly-schedules')
 await panel.getByRole('heading',{name:'Your weekly schedules'}).waitFor()
 assert.equal(await page.getByText('Weekly schedules & seasons').count(),0,'the old duplicate section is still there')
 assert.equal(await page.getByRole('button',{name:/New season|Add recurring class/}).count(),0,'a second add path is still there')
 const add=panel.getByRole('button',{name:'＋ Add a weekly activity'})
 if(await add.count())await add.click()
 const form=panel.locator('form.weekly-add')
 await form.getByLabel('Schedule name').fill('Cafe shifts')
 await form.getByRole('group',{name:'Repeat on weekdays'}).getByLabel('Monday').check()
 await form.getByRole('group',{name:'Repeat on weekdays'}).getByLabel('Tuesday').check()
 await form.getByLabel('Starts at').fill('08:00')
 await form.getByLabel('Ends at').fill('12:00')
 await form.getByRole('button',{name:'Add to my calendar'}).click()
 const card=panel.getByRole('article',{name:'Cafe shifts · weekly'})
 await card.waitFor()
 assert.match(await card.innerText(),/Cafe shifts · Mon, Tue · 8:00 AM–12:00 PM/)
 assert.match(await card.innerText(),/Active/)
 if(await form.getByRole('button',{name:'Done'}).count())await form.getByRole('button',{name:'Done'}).click()
 await panel.getByRole('button',{name:'＋ Add a weekly activity'}).waitFor()

 await card.getByRole('button',{name:'Edit'}).click()
 await card.getByRole('button',{name:'＋ Add a time'}).click()
 await card.getByLabel('Day').selectOption('Wednesday')
 await card.getByRole('button',{name:'Add this time'}).click()
 await card.getByRole('button',{name:'Save schedule'}).click()
 await card.locator('form.weekly-editor').waitFor({state:'detached'})
 assert.match(await card.innerText(),/Cafe shifts · Mon, Tue, Wed · 8:00 AM–12:00 PM/)

 await card.getByRole('button',{name:'Pause'}).click()
 await card.getByText('Paused',{exact:true}).waitFor()
 await card.getByRole('button',{name:'Delete'}).click()
 await card.getByRole('button',{name:'Delete schedule'}).click()
 await card.waitFor({state:'detached'})
})

/** A small calendar like Google Calendar's export: a weekly class and a one-time appointment, dated from today. */
function sampleIcs(){
 const d=new Date(),ymd=x=>x.getFullYear()+String(x.getMonth()+1).padStart(2,'0')+String(x.getDate()).padStart(2,'0')
 const next=new Date(d);next.setDate(d.getDate()+3)
 const until=new Date(d);until.setDate(d.getDate()+60)
 return ['BEGIN:VCALENDAR','VERSION:2.0','X-WR-CALNAME:Sam school','BEGIN:VEVENT','UID:bio@example','SUMMARY:Biology lab','LOCATION:Science 101','DTSTART:'+ymd(d)+'T140000','DTEND:'+ymd(d)+'T153000','RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL='+ymd(until),'END:VEVENT',
  'BEGIN:VEVENT','UID:dentist@example','SUMMARY:Dentist appointment','DTSTART:'+ymd(next)+'T090000','DTEND:'+ymd(next)+'T100000','END:VEVENT','END:VCALENDAR'].join('\r\n')
}

test('Getting started: a new plan shows three steps; each opens the right place, ticks off when done or skipped, and Hide keeps it hidden',async({page})=>{
 await createPlan(page)
 const card=page.getByRole('region',{name:'Getting started'})
 await card.getByText('0 of 3 done').waitFor()
 // Add my school opens Add to my calendar at the school setup.
 await card.getByRole('button',{name:'Add my school',exact:true}).click()
 await page.getByRole('region',{name:'Add to my calendar'}).getByRole('heading',{name:/My school schedule/}).waitFor()
 await go(page,'Sanctuary')
 await card.getByRole('button',{name:'Skip: Add your school or classes'}).click()
 await card.getByText('1 of 3 done').waitFor()
 // Linking a calendar ticks off step 2 by itself.
 await card.getByRole('button',{name:'Link a calendar',exact:true}).click()
 await page.getByLabel('Calendar file (.ics)').setInputFiles({name:'sam.ics',mimeType:'text/calendar',buffer:Buffer.from(sampleIcs())})
 await page.locator('.calendar-import-review').getByRole('button',{name:'Add 2 to my plan'}).click()
 await page.getByText(/^2 added\./).waitFor()
 await go(page,'Sanctuary')
 await card.getByText('2 of 3 done').waitFor()
 assert.match(await card.innerText(),/Link Canvas or your Google calendar\s*Done/)
 // Turn on reminders goes to Settings › Notifications.
 await card.getByRole('button',{name:'Turn on reminders',exact:true}).click()
 await heading(page,'Settings')
 await page.getByText('Get a notification even when KONO is closed',{exact:false}).waitFor()
 await go(page,'Sanctuary')
 await card.getByRole('button',{name:'Hide'}).click()
 await card.waitFor({state:'detached'})
 await page.reload();await heading(page,'Sanctuary')
 assert.equal(await page.getByRole('region',{name:'Getting started'}).count(),0,'stays hidden after a reload')
})

test('Calendar import: a Google/Apple calendar file or link adds weekly repeats and events, and importing again adds nothing new',async({context,page})=>{
 const requests=[]
 await context.route(BASE+'api/calendar-feed',route=>{requests.push(route.request().postDataJSON());return route.fulfill({status:200,headers:{'content-type':'text/calendar'},body:sampleIcs()})})
 await createPlan(page)
 await addToCalendar(page,'A calendar link')
 await page.getByLabel('Calendar file (.ics)').setInputFiles({name:'sam.ics',mimeType:'text/calendar',buffer:Buffer.from(sampleIcs())})
 await page.getByText('Found 1 weekly repeat and 1 event',{exact:false}).waitFor()
 const review=page.locator('.calendar-import-review')
 assert.match(await review.innerText(),/Biology lab · Mon, Wed · 2:00 PM–3:30 PM · Science 101/)
 assert.match(await review.innerText(),/“Sam school · weekly”/)
 await review.getByRole('button',{name:'Add 2 to my plan'}).click()
 await page.getByText(/^2 added\./).waitFor()
 await flushSave(page,'Dentist appointment')

 // The same calendar by link (Google's secret address / an iCloud public link): nothing new to add.
 await page.getByLabel('Or paste a calendar link').fill('webcal://p52-caldav.icloud.com/published/2/abc')
 await page.getByRole('button',{name:'Get calendar'}).click()
 await page.getByText('Found 1 weekly repeat and 1 event',{exact:false}).waitFor()
 assert.equal(requests[0].url,'webcal://p52-caldav.icloud.com/published/2/abc')
 await page.locator('.calendar-import-review').getByRole('button',{name:'Add 2 to my plan'}).click()
 await page.getByText('0 added, 2 already in your plan',{exact:false}).waitFor()

 await go(page,'Settings');await settingsTab(page,'Schedules')
 const card=page.locator('#weekly-schedules').getByRole('article',{name:'Sam school · weekly'})
 await card.waitFor()
 assert.match(await card.innerText(),/Biology lab · Mon, Wed · 2:00 PM–3:30 PM/)
})

test('Send feedback: a signed-in person sends a note with the page it came from, and KONO support reads and clears it',async({context,page})=>{
 const cloud=fakeCloud()
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 await go(page,'Settings')
 await page.getByRole('button',{name:'💬 Send feedback'}).click()
 await page.getByLabel(/What’s working, what’s confusing/).fill('The class upload missed my Friday lab.')
 await page.getByRole('button',{name:'Send',exact:true}).click()
 await page.getByText('Thank you! KONO support will read it.').waitFor()
 assert.equal(cloud.feedback.length,1);assert.equal(cloud.feedback[0].message,'The class upload missed my Friday lab.');assert.equal(cloud.feedback[0].page,'Settings');assert.equal(cloud.feedback[0].user_id,'alice')
 const support=await freshPage()
 try{
  await signInAs(support.context,cloud,'carol')
  await support.page.goto(BASE);await heading(support.page,'Sanctuary')
  await go(support.page,'Settings');await settingsTab(support.page,'KONO support')
  await support.page.getByRole('button',{name:'Show all accounts'}).click()
  const item=support.page.locator('.support-errors li').filter({hasText:'The class upload missed my Friday lab.'})
  await item.waitFor()
  assert.match(await item.innerText(),/alice@example\.com · on Settings/)
  await item.getByRole('button',{name:'Done — remove'}).click()
  await item.waitFor({state:'detached'})
  assert.equal(cloud.feedback.length,0)
  assert.deepEqual(support.errors,[])
 }finally{await support.context.close()}
})

test('Canvas: a Canvas calendar feed puts assignments in the Planner and quizzes in Exams, under their course',async({context,page})=>{
 // A fixed Monday, so the essay (due in 4 days) is in this week's view whatever day the tests run.
 await page.clock.setFixedTime(new Date(WEEK_PLAN_NOW))
 const d=new Date(WEEK_PLAN_NOW),ymd=x=>x.getFullYear()+String(x.getMonth()+1).padStart(2,'0')+String(x.getDate()).padStart(2,'0'),inDays=n=>{const x=new Date(d);x.setDate(d.getDate()+n);return ymd(x)}
 const feed=['BEGIN:VCALENDAR','X-WR-CALNAME:Canvas','BEGIN:VEVENT','UID:a1','SUMMARY:Essay 1 [ENGL 1010]','DTSTART;VALUE=DATE:'+inDays(4),'URL:https://canvas.bc.edu/courses/1/assignments/2','END:VEVENT','BEGIN:VEVENT','UID:q1','SUMMARY:Chapter 3 quiz [BIOL 1100]','DTSTART;VALUE=DATE:'+inDays(6),'URL:https://canvas.bc.edu/courses/3/quizzes/4','END:VEVENT','END:VCALENDAR'].join('\r\n')
 await context.route(BASE+'api/calendar-feed',route=>route.fulfill({status:200,headers:{'content-type':'text/calendar'},body:feed}))
 await createPlan(page)
 await addToCalendar(page,'A calendar link')
 await page.getByLabel('Or paste a calendar link').fill('https://canvas.bc.edu/feeds/calendars/user_abc.ics')
 await page.getByRole('button',{name:'Get calendar'}).click()
 await page.getByText('(2 assignments or exams)',{exact:false}).waitFor()
 const review=page.locator('.calendar-import-review')
 assert.match(await review.innerText(),/Essay 1[\s\S]*→ Planner assignment · ENGL 1010/)
 assert.match(await review.innerText(),/Chapter 3 quiz[\s\S]*→ Exams · BIOL 1100/)
 await review.getByRole('button',{name:'Add 2 to my plan'}).click()
 await page.getByText(/^2 added\./).waitFor()
 await flushSave(page,'Chapter 3 quiz')
 await go(page,'Exams')
 await page.getByText('Chapter 3 quiz').filter({visible:true}).first().waitFor()
 await go(page,'Planner')
 await page.getByText('Essay 1').filter({visible:true}).first().waitFor()
})

test('Linked calendar: a kept-up-to-date Canvas feed adds new assignments and moves changed dates on Check now',async({context,page})=>{
 const d=new Date(),ymd=x=>x.getFullYear()+String(x.getMonth()+1).padStart(2,'0')+String(x.getDate()).padStart(2,'0'),inDays=n=>{const x=new Date(d);x.setDate(d.getDate()+n);return ymd(x)}
 const item=(uid,title,day,kind)=>['BEGIN:VEVENT','UID:'+uid,'SUMMARY:'+title,'DTSTART;VALUE=DATE:'+day,'URL:https://canvas.bc.edu/courses/1/'+kind+'/'+uid,'END:VEVENT']
 let feed=['BEGIN:VCALENDAR','X-WR-CALNAME:Canvas',...item('a1','Essay 1 [ENGL 1010]',inDays(4),'assignments'),'END:VCALENDAR'].join('\r\n')
 await context.route(BASE+'api/calendar-feed',route=>route.fulfill({status:200,headers:{'content-type':'text/calendar'},body:feed}))
 await createPlan(page)
 await addToCalendar(page,'A calendar link')
 await page.getByLabel('Or paste a calendar link').fill('https://canvas.bc.edu/feeds/calendars/user_abc.ics')
 await page.getByRole('button',{name:'Get calendar'}).click()
 const review=page.locator('.calendar-import-review')
 assert.ok(await review.getByLabel(/Keep this calendar up to date/).isChecked(),'keeping a linked calendar up to date is the default')
 await review.getByRole('button',{name:'Add 1 to my plan'}).click()
 await page.getByText(/^1 added\./).waitFor()
 await flushSave(page,'Essay 1')
 const linked=page.locator('.linked-calendars li').filter({hasText:'Canvas'})
 await linked.waitFor()
 assert.match(await linked.innerText(),/Linked\./)
 assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('kono-linked-calendars:')).length),1,'the private link stays on this device')

 // The teacher moves the essay two days later and posts a quiz.
 feed=['BEGIN:VCALENDAR','X-WR-CALNAME:Canvas',...item('a1','Essay 1 [ENGL 1010]',inDays(6),'assignments'),...item('q1','Quiz 1 [ENGL 1010]',inDays(8),'quizzes'),'END:VCALENDAR'].join('\r\n')
 await linked.getByRole('button',{name:'Check now'}).click()
 await page.getByText('Canvas: 1 new, 1 moved to a new date.').waitFor()
 await flushSave(page,'Quiz 1')
 const saved=await page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('kono-recovery-and-sync',1);request.onsuccess=()=>{const db=request.result,get=db.transaction('plans').objectStore('plans').get('device');get.onsuccess=()=>{db.close();resolve(JSON.stringify(get.result??null))}}}))
 const essays=[],walk=v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object'){if(v.title==='Essay 1'&&typeof v.due==='string')essays.push(v.due);Object.values(v).forEach(walk)}}
 walk(JSON.parse(saved).data)
 assert.equal(essays.length,1,'moved, not copied');assert.equal(essays[0].replace(/-/g,''),inDays(6))
 await linked.getByRole('button',{name:'Check now'}).click()
 await page.getByText('Canvas: Up to date.').waitFor()
 await linked.getByRole('button',{name:'Stop'}).click()
 await linked.waitFor({state:'detached'})
 await go(page,'Exams')
 await page.getByText('Quiz 1').filter({visible:true}).first().waitFor()
})

test('Calendar subscribe link: a signed-in student makes a private link for Google/Apple Calendar and can turn it off',async({context,page})=>{
 const cloud=fakeCloud()
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 await go(page,'Settings')
 await settingsTab(page,'Import & export')
 await page.getByText('Show KONO in Google Calendar or Apple Calendar (stays up to date)').click()
 await page.getByRole('button',{name:'Make my calendar link'}).click()
 const link=page.getByLabel('Your KONO calendar link')
 await link.waitFor()
 assert.equal(await link.inputValue(),BASE.replace(/\/$/,'')+'/api/ics?t='+'ab12'.repeat(12))
 assert.match(await page.getByRole('link',{name:'Open in Apple Calendar'}).getAttribute('href'),/^webcal:\/\/.*\/api\/ics\?t=(ab12){12}$/)
 assert.equal(cloud.feeds.length,1);assert.equal(cloud.feeds[0].profile_id,cloud.users.alice.plan.data.activeProfileId)
 page.once('dialog',dialog=>void dialog.accept())
 await page.getByRole('button',{name:'Turn off link'}).click()
 await page.getByRole('button',{name:'Make my calendar link'}).waitFor()
 assert.equal(cloud.feeds.length,0)
})

test('Built-in AI: a signed-in student with no key of their own gets KONO’s AI, sent with their sign-in',async({context,page})=>{
 const cloud=fakeCloud(),posts=[]
 await signInAs(context,cloud,'alice')
 await context.route(BASE+'api/ai',route=>{
  const request=route.request()
  if(request.method()==='GET')return route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true})})
  posts.push({auth:request.headers().authorization,body:request.postDataJSON()})
  const classes=[{name:'Marine Biology',code:null,days:['Tuesday','Thursday'],start:'12:00',end:'13:15',building:'North Hall',room:null,teacher:null}]
  return route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({text:JSON.stringify({classes}),used:1,limit:40})})
 })
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 await go(page,'Settings')
 await settingsTab(page,'Import & export')
 await page.getByText('✓ KONO’s AI is included with your account',{exact:false}).waitFor()
 await settingsTab(page,'Schedules')
 await page.getByRole('button',{name:/^College semester/}).click()
 await page.getByRole('button',{name:'Boston College · Fall 2026'}).click()
 // One upload: KONO's reader finds nothing in this layout, so the AI reads it without another tap.
 await page.getByLabel('Upload my schedule').setInputFiles(proseSchedulePdf())
 await page.getByText('Your AI helper found 2 classes.',{exact:false}).waitFor()
 assert.equal(await page.getByText('Set up the AI helper (a free Gemini key works)').count(),0,'no key setup is asked for')
 await page.getByRole('table',{name:'What KONO found'}).getByText('Marine Biology').first().waitFor()
 assert.equal(posts.length,1)
 assert.match(posts[0].auth,/^Bearer .+\..+\..+/,'the request carries the student’s sign-in')
 assert.match(posts[0].body.prompt,/Marine Biology with Dr\. Lee/)
})

test('Planner › Week: the week by default, items at their hour, source chips hide a whole source, tapping an empty hour adds something then, tapping an item opens it right there, dragging moves it in 15-minute steps, and its bottom edge stretches it',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.settings.parentMode=false // a student: an empty hour opens the event editor (parents get the quick add)
 plan.calendarEvents.push(
  {id:'wk-canvas',profileId:pid,date:'2026-09-29',time:'15:00',endTime:'16:00',title:'Quiz review session',kind:'study',notes:'',source:'canvas'},
  {id:'wk-google',profileId:pid,date:'2026-09-30',time:'09:00',endTime:'10:00',title:'Dentist appointment',kind:'appointment',notes:'',source:'calendar'},
  {id:'wk-sports',profileId:pid,date:'2026-10-01',time:'17:00',endTime:'18:30',title:'Soccer practice',kind:'sports',notes:''})
 plan.tasks.push({id:'wk-hw',profileId:pid,subjectId:'',title:'Math worksheet',due:'2026-10-01',done:false,notes:''})
 await page.clock.setFixedTime(new Date('2026-09-28T08:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await go(page,'Planner')
 assert.equal(await page.getByLabel('Calendar view').inputValue(),'week','Week is the default on a computer')
 const week=page.getByRole('region',{name:'Week'})
 await week.getByRole('button',{name:/^Quiz review session · 3:00 PM–4:00 PM/}).waitFor()
 await week.getByRole('button',{name:/^Soccer practice · 5:00 PM–6:30 PM/}).waitFor()
 // Source chips: hiding Canvas hides only what came from Canvas, and stays hidden after a reload.
 const chips=page.getByRole('group',{name:'Show on calendar'})
 assert.deepEqual(await chips.getByRole('button').allInnerTexts(),['Canvas','Google','Sports','Mine'])
 const canvas=chips.getByRole('button',{name:'Canvas'})
 await canvas.click()
 assert.equal(await canvas.getAttribute('aria-pressed'),'false')
 await week.getByRole('button',{name:/^Quiz review session/}).waitFor({state:'detached'})
 assert.equal(await week.getByRole('button',{name:/^Dentist appointment/}).count(),1,'other sources stay')
 await page.reload();await page.locator('#workspace-main h1').waitFor();await go(page,'Planner')
 await week.getByRole('button',{name:/^Soccer practice/}).waitFor()
 assert.equal(await week.getByRole('button',{name:/^Quiz review session/}).count(),0,'still hidden after a reload')
 await chips.getByRole('button',{name:'Canvas'}).click()
 await week.getByRole('button',{name:/^Quiz review session/}).waitFor()
 // Tap an empty hour: a new event starts then, for an hour.
 await week.getByRole('button',{name:'Add at 10:00 AM on Oct 2, 2026'}).click()
 const editor=page.getByRole('dialog',{name:'New Event'})
 assert.equal(await editor.getByLabel('Start time (optional)').inputValue(),'10:00')
 assert.equal(await editor.getByLabel('End time (optional)').inputValue(),'11:00')
 assert.equal(await editor.getByLabel('Date').inputValue(),'2026-10-02')
 await editor.getByLabel('Title').fill('Tutoring')
 await editor.getByRole('button',{name:'Save'}).click()
 await week.getByRole('button',{name:/^Tutoring · 10:00 AM–11:00 AM · Oct 2, 2026/}).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.calendarEvents.some(e=>e.title==='Tutoring'&&e.date==='2026-10-02'&&e.time==='10:00'),'the new event reaches the account')
 // Tapping an event opens its editor right on the calendar (no scrolling down to the daily page).
 await week.getByRole('button',{name:/^Tutoring · 10:00 AM/}).click()
 const tutoring=page.getByRole('dialog',{name:'Edit Event'})
 assert.equal(await tutoring.getByLabel('Title').inputValue(),'Tutoring')
 await tutoring.getByRole('button',{name:'Close dialog'}).click()
 await tutoring.waitFor({state:'detached'})
 // Tapping a class opens its card (notes, skip, add for this class).
 await week.getByRole('button',{name:/^Biology · 9:00 AM–10:00 AM/}).click()
 const biology=page.getByRole('dialog',{name:/Sep 28, 2026/})
 await biology.getByRole('heading',{name:'Biology',level:3}).waitFor()
 await biology.getByRole('button',{name:'Close dialog'}).click()
 // Dragging: an event moves to another time, keeping its length, in 15-minute steps.
 await weekDrag(page,week.getByRole('button',{name:/^Tutoring · 10:00 AM/}),week.getByRole('button',{name:'Add at 1:00 PM on Oct 2, 2026'}))
 await week.getByRole('button',{name:/^Tutoring · 1:00 PM–2:00 PM/}).waitFor()
 await weekDrag(page,week.getByRole('button',{name:/^Tutoring · 1:00 PM/}),week.getByRole('button',{name:'Add at 2:00 PM on Oct 2, 2026'}),-22)
 await week.getByRole('button',{name:/^Tutoring · 1:30 PM–2:30 PM/}).waitFor()
 // Its bottom edge stretches it: drag the grip down to 4:00 PM.
 const grip=week.getByRole('button',{name:/^Tutoring · 1:30 PM/}).locator('.week-item-grip')
 await weekDrag(page,grip,week.getByRole('button',{name:'Add at 4:00 PM on Oct 2, 2026'}),-3,{fromBottom:true,shot:'week-stretch.png'})
 await week.getByRole('button',{name:/^Tutoring · 1:30 PM–4:00 PM/}).waitFor()
 await waitFor(()=>{const e=cloud.users.alice.plan.data.calendarEvents.find(x=>x.title==='Tutoring');return e?.time==='13:30'&&e.endTime==='16:00'},'the moved and stretched event reaches the account')
 // A tap that's really a drag doesn't open the editor.
 assert.equal(await page.getByRole('dialog').count(),0)
 // An assignment dropped on an earlier day gets a study session then; on its due day, a planned time.
 await weekDrag(page,week.getByRole('button',{name:/^Math worksheet · Oct 1, 2026/}),week.getByRole('button',{name:'Add at 4:00 PM on Sep 29, 2026'}))
 await week.getByRole('button',{name:/^Work on Math worksheet · 4:00 PM–5:00 PM · Sep 29, 2026/}).waitFor()
 await weekDrag(page,week.getByRole('button',{name:/^Math worksheet · Oct 1, 2026/}),week.getByRole('button',{name:'Add at 3:00 PM on Oct 1, 2026'}))
 await week.getByRole('button',{name:/^Math worksheet · 3:00 PM–4:00 PM · Oct 1, 2026/}).waitFor()
 // Stretching a planned assignment sets how long the work takes.
 await weekDrag(page,week.getByRole('button',{name:/^Math worksheet · 3:00 PM/}).locator('.week-item-grip'),week.getByRole('button',{name:'Add at 5:00 PM on Oct 1, 2026'}),-22,{fromBottom:true})
 await week.getByRole('button',{name:/^Math worksheet · 3:00 PM–4:30 PM · Oct 1, 2026/}).waitFor()
 await waitFor(()=>{const d=cloud.users.alice.plan.data,t=d.tasks.find(t=>t.id==='wk-hw');return t?.plannedTime==='15:00'&&t.estimatedMinutes===90&&d.calendarEvents.some(e=>e.planFor==='task:wk-hw'&&e.date==='2026-09-29'&&e.time==='16:00')},'the planned time, its length and the study session reach the account')
 // Repeat: Tutoring every week until Oct 23 adds three more, linked as one series.
 await week.getByRole('button',{name:/^Tutoring · 1:30 PM/}).click()
 const repeatEditor=page.getByRole('dialog',{name:'Edit Event'})
 await repeatEditor.getByLabel('Repeat').selectOption('weekly')
 await repeatEditor.getByLabel('Until').fill('2026-10-23')
 await repeatEditor.getByText(/^Adds 3 more: /).waitFor()
 if(process.env.KONO_SHOTS)await repeatEditor.screenshot({path:process.env.KONO_SHOTS+'/event-repeat.png'})
 await repeatEditor.getByRole('button',{name:'Save'}).click()
 await repeatEditor.waitFor({state:'detached'})
 await waitFor(()=>{const list=cloud.users.alice.plan.data.calendarEvents.filter(e=>e.title==='Tutoring');return list.length===4&&new Set(list.map(e=>e.recurringId)).size===1&&list[0].recurringId&&list.map(e=>e.date).sort().join()==='2026-10-02,2026-10-09,2026-10-16,2026-10-23'&&list.every(e=>e.time==='13:30'&&e.endTime==='16:00')},'the repeats reach the account as one series')
 // The next week, and Month still works.
 await page.getByRole('button',{name:'Next week'}).click()
 await page.getByRole('heading',{name:/^Oct 4 – Oct 10/}).waitFor()
 // A change to one of the series can go to the ones after it too.
 await week.getByRole('button',{name:/^Tutoring · 1:30 PM–4:00 PM · Oct 9, 2026/}).click()
 const seriesEditor=page.getByRole('dialog',{name:'Edit Event'})
 await seriesEditor.getByText('This repeats (4 dates). Save changes to:').waitFor()
 assert.equal(await seriesEditor.getByLabel('Repeat').count(),0,'one already in a series has no Repeat picker')
 await seriesEditor.getByLabel('Title').fill('Math tutoring')
 await seriesEditor.getByLabel('This and the ones after it').check()
 if(process.env.KONO_SHOTS)await seriesEditor.screenshot({path:process.env.KONO_SHOTS+'/event-series.png'})
 await seriesEditor.getByRole('button',{name:'Save'}).click()
 await week.getByRole('button',{name:/^Math tutoring · 1:30 PM–4:00 PM · Oct 9, 2026/}).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.calendarEvents.filter(e=>e.recurringId).map(e=>e.date+' '+e.title).sort().join()==='2026-10-02 Tutoring,2026-10-09 Math tutoring,2026-10-16 Math tutoring,2026-10-23 Math tutoring','only this and the later ones changed')
 await page.getByLabel('Calendar view').selectOption('month')
 assert.equal(await page.getByRole('region',{name:'Week'}).count(),0)
})

/** Planner › Week: drag `source` with the mouse so its top lands `dy` px below the top of `target`
 * (an hour's "Add at" slot), as a student would. With `fromBottom` it grabs the bottom edge (a stretch
 * grip) and lets go at that spot. */
async function weekDrag(page,source,target,dy=0,{fromBottom=false,shot=''}={}){
 await target.scrollIntoViewIfNeeded();await source.scrollIntoViewIfNeeded()
 const a=await source.boundingBox(),b=await target.boundingBox()
 const grabY=fromBottom?a.y+a.height-3:a.y+3
 await page.mouse.move(a.x+a.width/2,grabY);await page.mouse.down()
 const toX=b.x+b.width/2,toY=b.y+dy+(fromBottom?0:3)
 for(let i=1;i<=8;i++)await page.mouse.move(a.x+a.width/2+(toX-a.x-a.width/2)*i/8,grabY+(toY-grabY)*i/8)
 if(shot&&process.env.KONO_SHOTS)await page.getByRole('region',{name:'Week'}).screenshot({path:process.env.KONO_SHOTS+'/'+shot})
 await page.mouse.up()
}
/** Drag one element onto another with real drag events and one shared DataTransfer. Playwright's
 * dragTo moves the mouse, which can miss the drop when the page scrolls between the two. */
async function dragOnto(page,source,target){
 const data=await page.evaluateHandle(()=>new DataTransfer())
 await source.scrollIntoViewIfNeeded();await source.dispatchEvent('dragstart',{dataTransfer:data})
 await target.scrollIntoViewIfNeeded()
 for(const type of ['dragenter','dragover','drop'])await target.dispatchEvent(type,{dataTransfer:data})
 await source.dispatchEvent('dragend',{dataTransfer:data}).catch(()=>{})
}
/** A signed-in account whose plan has an essay due in three days (dates relative to today). */
// Plan-my-week tests run on a fixed Monday morning: the shared fixture has fixed dates (like its Cell
// biology test), so on a real clock the week's work and free time drift from day to day.
const WEEK_PLAN_NOW='2026-09-28T08:00:00'
function weekPlanCloud(){
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,d=new Date(WEEK_PLAN_NOW);d.setDate(d.getDate()+3)
 const due=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
 plan.tasks.push({id:'wk-essay',profileId:plan.activeProfileId,subjectId:'',title:'Week plan essay',due,done:false,notes:'',estimatedMinutes:60})
 return cloud
}
// The island only loads while it's on screen (GardenCard pauses it otherwise), and the page can still
// shift as it settles, so keep it in view while waiting for it to finish.
const islandLoaded=page=>page.waitForFunction(()=>{const island=document.querySelector('.wb-island'),r=island?.getBoundingClientRect();if(island&&(r.bottom<0||r.top>innerHeight))island.scrollIntoView({block:'center'});return island&&!document.querySelector('.sanctuary-load-status')},null,{timeout:30000,polling:250})
const waitFor=async(check,message)=>{for(let i=0;i<60;i++){if(check())return;await new Promise(r=>setTimeout(r,250))}assert.fail(message)}
async function openWeekPlanner(page){
 await go(page,'Planner')
 await page.locator('summary',{hasText:'Plan my week'}).click()
 return page.locator('.week-planner')
}

test('Plan my week: KONO plans study sessions around the schedule, adds them to the Calendar, and can clear them',async({context,page})=>{
 const cloud=weekPlanCloud()
 await page.clock.setFixedTime(new Date(WEEK_PLAN_NOW))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const panel=await openWeekPlanner(page)
 await panel.getByText('for a plan made by KONO’s AI',{exact:false}).waitFor()
 await panel.getByRole('button',{name:'✨ Plan my week'}).click()
 await panel.getByText(/study sessions? planned\. Untick/).waitFor()
 assert.doesNotMatch(await panel.getByRole('status').innerText(),/with KONO’s AI/)
 const review=panel.locator('.week-planner-review')
 assert.match(await review.innerText(),/Work on Week plan essay[\s\S]*For Week plan essay · due/)
 await review.getByRole('button',{name:/^Add \d+ sessions? to my Calendar$/}).click()
 await panel.getByText(/added to your Calendar/).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.calendarEvents?.some(e=>e.planFor==='task:wk-essay'&&e.kind==='study'&&e.time&&e.endTime),'the planned sessions reach the account')
 page.once('dialog',dialog=>void dialog.accept())
 await panel.getByRole('button',{name:/^Clear \d+ planned sessions?$/}).click()
 await panel.getByText('Earlier planned sessions removed.',{exact:false}).waitFor()
 await waitFor(()=>!cloud.users.alice.plan.data.calendarEvents.some(e=>e.planFor),'clearing reaches the account')
})

test('Plan my week with KONO’s AI: the AI’s sessions are shown after checking, and anything it invents is dropped',async({context,page})=>{
 const cloud=weekPlanCloud(),posts=[]
 await page.clock.setFixedTime(new Date(WEEK_PLAN_NOW))
 await signInAs(context,cloud,'alice')
 await context.route(BASE+'api/ai',route=>{
  const request=route.request()
  if(request.method()==='GET')return route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true})})
  const prompt=request.postDataJSON().prompt;posts.push(prompt)
  const work=JSON.parse(prompt.match(/Work: (\[.*\])\n/)[1]),free=JSON.parse(prompt.match(/Free times: (\[.*\])$/)[1])
  const essay=work.find(w=>w.title==='Week plan essay'),slot=free[0]
  const sessions=[{ref:essay.ref,date:slot.date,start:slot.start,minutes:30,focus:'Outline the essay'},{ref:'task:made-up',date:slot.date,start:slot.start,minutes:30,focus:'Invented work'}]
  return route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({text:JSON.stringify({sessions}),used:1,limit:40})})
 })
 await page.goto(BASE);await heading(page,'Sanctuary')
 const panel=await openWeekPlanner(page)
 await panel.getByRole('button',{name:'✨ Plan my week'}).click()
 await panel.getByText('1 study session planned with KONO’s AI.',{exact:false}).waitFor()
 const review=panel.locator('.week-planner-review')
 assert.match(await review.innerText(),/Outline the essay/);assert.doesNotMatch(await review.innerText(),/Invented work/)
 assert.match(await review.innerText(),/Didn’t fit this week: Week plan essay \(about 30 min more\)/)
 assert.equal(posts.length,1);assert.match(posts[0],/"title":"Week plan essay"/)
 await review.getByRole('button',{name:'Add 1 session to my Calendar'}).click()
 await panel.getByText('1 study session added to your Calendar.',{exact:false}).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.calendarEvents?.some(e=>e.planFor==='task:wk-essay'&&e.title==='Outline the essay'),'the AI session reaches the account')
})

test('Weekly recap: the Sunday card on the Sanctuary page hides until next week, and Planner shares it as a picture',async({context,page})=>{
 await page.clock.setFixedTime(new Date('2026-09-27T10:00:00'))
 await createPlan(page)
 const sunday=page.locator('.week-recap-sunday')
 await sunday.getByRole('region',{name:'Your week in review'}).waitFor()
 assert.match(await sunday.innerText(),/YOUR WEEK · SEP 21 – SEP 27/)
 assert.equal(await sunday.locator('.week-recap-days li').count(),7)
 await sunday.getByRole('button',{name:'Hide until next week'}).click()
 await sunday.waitFor({state:'detached'})
 await page.reload();await heading(page,'Sanctuary')
 assert.equal(await page.locator('.week-recap-sunday').count(),0,'stays hidden after a reload')
 await go(page,'Planner')
 await page.locator('summary',{hasText:'Your week so far'}).click()
 const card=page.locator('.week-recap-panel .week-recap')
 await card.waitFor()
 const [download]=await Promise.all([page.waitForEvent('download'),card.getByRole('button',{name:'Share my week'}).click()])
 assert.equal(download.suggestedFilename(),'my-kono-week.png')
 const png=fs.readFileSync(await download.path())
 assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1080);assert.equal(png.readUInt32BE(20),1920)
 await card.getByText('Saved the picture.',{exact:false}).waitFor()
})

test('Lock-screen reminders: the Notifications panel explains setup, needs sign-in, and says when the server isn’t ready',async({context,page})=>{
 await createPlan(page)
 await go(page,'Settings')
 await settingsTab(page,'Notifications')
 const panel=page.locator('.push-settings')
 await panel.getByRole('heading',{name:'Lock-screen reminders'}).waitFor()
 await panel.getByText('Sign in with your email',{exact:false}).waitFor()
 await panel.getByRole('heading',{name:'Install KONO'}).waitFor()
 const sw=fs.readFileSync(path.join(ROOT,'dist','client','sw.js'),'utf8')
 assert.match(sw,/addEventListener\('push'/);assert.match(sw,/addEventListener\('notificationclick'/)
 const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'dist','client','manifest.webmanifest'),'utf8'))
 assert.ok(manifest.icons.some(i=>i.src==='/icons/kono-512.png'))
 assert.ok(fs.existsSync(path.join(ROOT,'dist','client','icons','apple-touch-icon.png')),'the Home Screen icon is published')
 const signedIn=await freshPage()
 try{
  const cloud=fakeCloud()
  await signInAs(signedIn.context,cloud,'alice')
  await signedIn.context.route(BASE+'api/push',route=>route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({publicKey:null})}))
  await signedIn.page.goto(BASE);await heading(signedIn.page,'Sanctuary')
  await go(signedIn.page,'Settings');await settingsTab(signedIn.page,'Notifications')
  await signedIn.page.getByRole('button',{name:'Turn on reminders'}).click()
  await signedIn.page.getByText('Lock-screen reminders aren’t set up on KONO’s server yet.').waitFor()
  assert.deepEqual(signedIn.errors,[])
 }finally{await signedIn.context.close()}
})

/** A landscape class-schedule PDF like a registrar printout: day, time and building cells wrap onto two lines. */
function classTablePdf(){
 const {jsPDF}=require('jspdf'),doc=new jsPDF({orientation:'landscape',unit:'pt',format:'letter'})
 doc.setFontSize(10);doc.text('Class Schedule',41,60)
 ;[['Class Name',50],['Teacher',210],['Day',338],['Time',435],['Building',534],['Room',624]].forEach(([t,x])=>doc.text(t,x,114))
 const cls=(y,name,teacher,days,time,building,room)=>{doc.text(name,50,y);doc.text(teacher,210,y);doc.text(days[0],338,y-6);if(days[1])doc.text(days[1],338,y+6);doc.text(time[0],435,y-(time[1]?6:0));if(time[1])doc.text(time[1],435,y+6);doc.text(building[0],534,y-(building[1]?6:0));if(building[1])doc.text(building[1],534,y+6);doc.text(room,624,y)}
 cls(160,'Corporate Finance','Okafor, Ben',['Tuesday &','Thursday'],['3:00 PM - 4:15 PM'],['245 Beacon','Street'],'102')
 cls(212,'Ethics Seminar (Lecture)','Chen, Li',['Tuesday &','Thursday'],['10:30 AM - 11:45','AM'],['South Hall'],'204')
 cls(264,'Ethics Seminar (Discussion)','Park, Jo',['Monday'],['12:00 PM - 12:50','PM'],['West Hall'],'141N')
 return {name:'class-schedule.pdf',mimeType:'application/pdf',buffer:Buffer.from(doc.output('arraybuffer'))}
}
/** A schedule written as sentences: no table for the built-in reader to follow. */
function proseSchedulePdf(){
 const {jsPDF}=require('jspdf'),doc=new jsPDF({unit:'pt',format:'letter'})
 doc.setFontSize(11);doc.text(['My fall classes','Marine Biology with Dr. Lee meets on Tuesdays and Thursdays from noon until 1:15 in North Hall.','Studio Art is every Friday morning, nine to ten thirty, in the Arts Center.'],50,80)
 return {name:'my-classes.pdf',mimeType:'application/pdf',buffer:Buffer.from(doc.output('arraybuffer'))}
}

test('School setup guide: find the school, answer the grade, save, and land on the Planner (Duxbury Public Schools, Monday–Friday)',async({context,page})=>{
 const cloud=fakeCloud()
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await addToCalendar(page,'My school schedule')
 const find=page.getByRole('region',{name:'Find your school'})
 const search=find.getByRole('searchbox',{name:'Search for your school'})
 await search.fill('hanover')
 assert.equal(await find.getByRole('button',{name:'Duxbury Public Schools · 2026–27'}).count(),0,'search narrows the list')
 await search.fill('duxbury public')
 await find.getByRole('button',{name:'My school isn’t listed'}).waitFor()
 await find.getByRole('button',{name:'Duxbury Public Schools · 2026–27'}).click()
 const steps=page.getByRole('list',{name:'Setup steps'})
 assert.match(await steps.locator('[aria-current=step]').innerText(),/2 · Quick questions/)
 const grade=page.getByRole('region',{name:'Your grade'})
 await grade.getByRole('heading',{name:'What grade are you in?'}).waitFor()
 assert.equal(await page.getByRole('region',{name:'Rotation day'}).count(),0,'a Monday–Friday school has no rotation question')
 const next=page.getByRole('button',{name:'Next: your classes'})
 assert.ok(await next.isDisabled(),'the grade comes first')
 await grade.getByRole('combobox').selectOption('11')
 await next.click()
 assert.match(await steps.locator('[aria-current=step]').innerText(),/3 · Your classes/)
 await page.getByLabel('Upload my schedule').waitFor()
 await page.getByRole('button',{name:'Skip for now: save the school calendar'}).click()
 await page.getByRole('heading',{name:'Check your classes'}).waitFor()
 await page.getByRole('button',{name:'Save to my calendar'}).click()
 // Saved: the guide closes and the Planner is showing.
 await page.getByRole('region',{name:'Add to my calendar'}).waitFor({state:'detached'})
 await page.getByRole('button',{name:'＋ Add to my calendar'}).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.studySeasons?.some(x=>x.school?.name==='Duxbury Public Schools'&&x.school.grade==='11'),'the school reaches the account')
 // My schedules opens the full editor, with the grade in step 1 and no college fields.
 await page.getByRole('button',{name:'My schedules'}).click()
 await page.getByRole('button',{name:/^Rotating school/}).click()
 const card=page.locator('.school-setup .wb-record').filter({hasText:'Duxbury Public Schools 2026–27'})
 await card.getByRole('button',{name:'Edit school calendar / classes'}).click()
 assert.equal(await page.getByLabel('Student grade').inputValue(),'11')
 assert.equal(await page.getByLabel('Faculty / program').count(),0,'no college faculty field')
 assert.equal(await page.getByRole('navigation',{name:'School setup sections'}).count(),1,'the full editor has all four sections')
})

test('Share with classmates: after setting up a school KONO doesn’t have, a student shares its calendar (never their classes or grade) and it shows up in Find your school',async({context,page})=>{
 const cloud=fakeCloud()
 await page.clock.setFixedTime(new Date('2026-09-27T10:00:00')) // a Sunday
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await addToCalendar(page,'My school schedule')
 await page.getByRole('button',{name:'My school isn’t listed'}).click()
 await page.getByLabel('School name').fill('Pembroke High School')
 await page.getByRole('region',{name:'Your grade'}).getByRole('combobox').selectOption('9')
 const rotation=page.getByRole('region',{name:'Rotation day'})
 if(await rotation.getByRole('button',{name:'Set rotation'}).count()){
  await rotation.getByRole('combobox').selectOption({index:1})
  await rotation.getByRole('button',{name:'Set rotation'}).click()
 }
 await page.getByRole('navigation',{name:'School setup sections'}).getByRole('button',{name:'4 · Review'}).click()
 await page.getByLabel(/I checked the calendar, grade/).check()
 await page.getByRole('button',{name:'Save & populate my calendar'}).click()
 // Saved: KONO offers to share it.
 const invite=page.getByRole('region',{name:'Share with classmates'})
 await invite.getByRole('heading',{name:'Share Pembroke High School with classmates?'}).waitFor()
 await invite.getByLabel('Name shown to others').fill('Pembroke High School 2026–27')
 await invite.getByLabel('Town (optional)').fill('Pembroke, MA')
 await invite.getByRole('button',{name:'Share with classmates'}).click()
 await invite.getByText('Shared. Classmates can now search for Pembroke High School 2026–27',{exact:false}).waitFor()
 assert.equal(cloud.catalog.length,1)
 const shared=cloud.catalog[0]
 assert.equal(shared.kind,'school');assert.equal(shared.town,'Pembroke, MA')
 assert.equal(shared.data.school.grade,'','the grade is never shared');assert.equal(shared.data.week,undefined,'classes are never shared')
 await invite.getByRole('button',{name:'Done'}).click()
 await invite.waitFor({state:'detached'})
 // The next student at that school just searches for it.
 await page.getByRole('searchbox',{name:'Search for your school'}).fill('pembroke')
 await page.getByRole('button',{name:/^Pembroke High School 2026–27\s*Shared by a KONO user · Pembroke, MA/}).waitFor()
})

/** A JPEG's pixel width and height, from its start-of-frame marker. */
function jpegSize(jpeg){
 for(let i=2;i<jpeg.length;){const marker=jpeg[i+1],length=jpeg.readUInt16BE(i+2);if(marker>=0xc0&&marker<=0xc3)return [jpeg.readUInt16BE(i+7),jpeg.readUInt16BE(i+5)];i+=2+length}
 throw new Error('Not a JPEG')
}
/** A PDF that is only a picture (a schedule screenshot saved as PDF): one JPEG page, no text at all. */
function picturePdf(jpeg,width,height){
 const parts=[],offsets=[],push=s=>{parts.push(Buffer.isBuffer(s)?s:Buffer.from(s,'latin1'))},size=()=>parts.reduce((n,b)=>n+b.length,0)
 const obj=(n,body)=>{offsets[n]=size();push(n+' 0 obj\n');for(const b of [].concat(body))push(b);push('\nendobj\n')}
 push('%PDF-1.4\n')
 obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
 obj(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`)
 obj(4,[`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,jpeg,'\nendstream'])
 const draw=`q ${width} 0 0 ${height} 0 0 cm /Im1 Do Q`;obj(5,`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`)
 const xref=size();push(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
 return Buffer.concat(parts)
}

test('Rotating school: Duxbury High’s 7 classes rotate through 5 blocks; KONO’s AI reads a picture-only PDF into the 7 classes, every day is built with bell times, lunch and ASP, and a class can be switched for second semester',async({context,page})=>{
 const cloud=fakeCloud(),posts=[]
 // A stand-in schedule picture (made-up classes) laid out like the real one: D1–D7 columns, P1–P5 rows.
 // Drawn on this test's own page before it opens KONO: a second, background tab can't always be
 // captured in headless Chromium ("Unable to capture screenshot" in CI).
 await page.setContent('<table border=1 style="font:14px sans-serif;border-collapse:collapse">'+['<tr><th></th>'+[1,2,3,4,5,6,7].map(d=>'<th>D'+d+'</th>').join('')+'</tr>',...[1,2,3,4,5].map(p=>'<tr><th>P'+p+'</th>'+[1,2,3,4,5,6,7].map(d=>'<td>Class '+((p+d)%7+1)+'</td>').join('')+'</tr>')].join('')+'</table>')
 const jpeg=await page.locator('table').screenshot({type:'jpeg',quality:80}),[pw,ph]=jpegSize(jpeg)
 await page.clock.setFixedTime(new Date('2026-09-27T10:00:00')) // a Sunday
 await signInAs(context,cloud,'alice')
 await context.route(BASE+'api/ai',route=>{
  const request=route.request()
  if(request.method()==='GET')return route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true})})
  posts.push(request.postDataJSON())
  const names=['Chemistry I','US History II','English 10','Spanish III','Algebra II','Ceramics','Free'],classes=[]
  for(let d=0;d<2;d++)for(let p=1;p<=5;p++){const i=(d*5+p-1)%7;classes.push({name:names[i],code:null,days:['D'+(d+1)],start:null,end:null,period:'P'+p+'-Period '+p,room:i===0?'A321':null,teacher:null})}
  return route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({text:JSON.stringify({classes}),used:1,limit:40})})
 })
 await page.goto(BASE);await heading(page,'Sanctuary')
 await addToCalendar(page,'My school schedule')
 await page.getByRole('searchbox',{name:'Search for your school'}).fill('duxbury high')
 await page.getByRole('button',{name:'Duxbury High School · 2026–27 · 7-day rotation'}).click()
 await page.getByRole('region',{name:'Your grade'}).getByRole('combobox').selectOption('10')
 // Asked up front: one known school day and its number, e.g. "September 28 is Day 4".
 const rotation=page.getByRole('region',{name:'Rotation day'})
 await rotation.getByRole('heading',{name:'Which rotation day is it?'}).waitFor()
 assert.match(await rotation.innerText(),/For example: Monday, September 28 is Day 4\./,'the example is the next school day')
 assert.equal(await rotation.getByLabel('School day').inputValue(),'2026-09-28','it suggests the next school day, not a weekend')
 assert.ok(await rotation.getByRole('button',{name:'Set rotation'}).isDisabled())
 await rotation.getByLabel('School day').fill('2026-10-12')
 await rotation.getByRole('combobox').selectOption('Day 4')
 await rotation.getByText('has no school on this calendar',{exact:false}).waitFor()
 assert.ok(await rotation.getByRole('button',{name:'Set rotation'}).isDisabled(),'Columbus Day can’t be the known day')
 await rotation.getByLabel('School day').fill('2026-09-28')
 await rotation.getByRole('button',{name:'Set rotation'}).click()
 await rotation.getByText('✓ Monday, September 28 is Day 4.').waitFor()
 assert.match(await rotation.innerText(),/Coming up: Mon, Sep 28 · Day 4, Tue, Sep 29 · Day 5, Wed, Sep 30 · Day 6, Thu, Oct 1 · Day 7, Fri, Oct 2 · Day 1, Mon, Oct 5 · Day 2\./)
 await page.getByRole('button',{name:'Next: your classes'}).click()
 const mine=page.getByRole('region',{name:'Your classes'})
 await mine.getByRole('heading',{name:'Your 7 classes'}).waitFor()
 assert.match(await mine.innerText(),/Day 1 is classes 1-2-3-4-5, Day 2 is 6-7-1-2-3/)
 await mine.locator('summary',{hasText:'Set up the AI helper'}).waitFor({state:'detached'}) // KONO's AI is on for this account
 // One upload: choosing the file starts reading it.
 await mine.getByLabel('Upload my schedule').setInputFiles({name:'schedule.pdf',mimeType:'application/pdf',buffer:picturePdf(jpeg,pw,ph)})
 await mine.getByText('Found 7 of your 7 classes.',{exact:false}).waitFor({timeout:90000})
 assert.equal(posts.length,1);assert.equal(posts[0].photo?.mimeType,'image/jpeg','the picture-only PDF went to the AI as a picture');assert.doesNotMatch(posts[0].prompt,/Schedule text:/)
 assert.match(posts[0].prompt,/5 periods \(also called blocks\) every day/)
 const names=['Chemistry I','US History II','English 10','Spanish III','Algebra II','Ceramics','Free']
 for(let i=0;i<7;i++)assert.equal(await mine.getByLabel('Class '+(i+1)+' name').inputValue(),names[i])
 assert.equal(await mine.getByLabel('Class 1 room').inputValue(),'A321')
 // Lunch comes from the department: science → 1st, history → 2nd, English → 3rd.
 assert.equal(await mine.getByLabel('Class 1 lunch').inputValue(),'1');assert.equal(await mine.getByLabel('Class 2 lunch').inputValue(),'2');assert.equal(await mine.getByLabel('Class 3 lunch').inputValue(),'3')
 await mine.getByLabel('Class 4 lunch').selectOption('3')
 const days=mine.getByRole('table',{name:'Your days'})
 assert.match(await days.getByRole('row',{name:/^Day 2/}).innerText(),/Ceramics\s+Free\s+Chemistry I\s+US History II\s+Lunch 2\s+English 10/)
 assert.match(await days.getByRole('row',{name:/^Day 7/}).innerText(),/English 10\s+Spanish III\s+Algebra II\s+Ceramics\s+Lunch 3\s+Free/)
 await mine.getByRole('button',{name:'Build all 7 days'}).click()
 // Check and save: the built days as a grid, with each period, lunch and ASP.
 const built=page.getByRole('table',{name:'Duxbury High School'})
 const day2=await built.getByRole('row',{name:/^Day 2/}).innerText()
 for(const text of ['Ceramics','Free','Chemistry I','US History II','Lunch 2','English 10'])assert.ok(day2.includes(text),'Day 2 is missing '+text+': '+day2)
 assert.equal(await built.getByRole('row',{name:/^Day 2/}).getByRole('cell').last().innerText(),'English 10','ASP goes with the Period 5 class')
 assert.match(await built.locator('thead').innerText(),/Period 1\s+8:20 AM/)
 await page.getByRole('button',{name:'Save to my calendar'}).click()
 await page.getByRole('region',{name:'Add to my calendar'}).waitFor({state:'detached'})
 await waitFor(()=>{const s=cloud.users.alice.plan.data.studySeasons?.find(x=>x.school?.name==='Duxbury High School');return s&&Object.values(s.week).flat().length===49},'all 7 days (5 blocks, lunch, ASP) reach the account')
 // Second semester, from My schedules: US History II becomes Economics on every day it meets, lunch included.
 await page.getByRole('button',{name:'My schedules'}).click()
 await page.getByRole('button',{name:/^Rotating school/}).click()
 await page.locator('.school-setup .wb-record').filter({hasText:'Duxbury High School'}).getByRole('button',{name:'Change a class (new semester)'}).click()
 assert.equal(await mine.getByLabel('Class 4 lunch').inputValue(),'3','reopening keeps the classes and lunches')
 await page.getByText('Change a class (new semester, or fix a name)').click()
 const changes=page.locator('.class-changes')
 await changes.getByRole('combobox',{name:'Class that changes'}).selectOption('US History II')
 await changes.getByLabel('New class',{exact:true}).fill('Economics')
 await changes.getByLabel('New class starts').fill('2027-01-25')
 assert.equal(await changes.getByLabel('Lunch with the new class').inputValue(),'2','economics is a history class: 2nd lunch')
 await changes.getByRole('button',{name:'Switch class'}).click()
 await changes.getByText('Economics takes US History II’s place from 2027-01-25.',{exact:false}).waitFor()
 await page.getByRole('combobox',{name:'Rotation day'}).selectOption('Day 2')
 await page.getByRole('heading',{name:'Period 4 · Economics'}).waitFor()
 assert.match(await page.locator('.wb-record',{has:page.getByRole('heading',{name:'Period 4 · US History II'})}).innerText(),/2026-09-02 – 2027-01-24/)
})

test('College semester: choose the term, upload the schedule, review, save; a layout KONO can’t read is logged and the AI helper reads it',async({context,page})=>{
 const cloud=fakeCloud(),aiRequests=[]
 await signInAs(context,cloud,'alice')
 await context.route('https://generativelanguage.googleapis.com/**',route=>{
  const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors})
  aiRequests.push(route.request().postData()??'')
  const classes=[{name:'Marine Biology',code:null,days:['Tuesday','Thursday'],start:'12:00',end:'13:15',building:'North Hall',room:null,teacher:'Dr. Lee'},{name:'Studio Art',code:null,days:['Friday'],start:'09:00',end:'10:30',building:'Arts Center',room:null,teacher:null}]
  return route.fulfill({status:200,headers:{...cors,'content-type':'application/json'},body:JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({classes})}]}}]})})
 })
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 await go(page,'Settings')
 await settingsTab(page,'Schedules')
 await page.getByRole('button',{name:/^College semester/}).click()
 await page.getByRole('button',{name:'Boston College · Fall 2026'}).click()
 // Choosing the term goes straight to uploading classes; its dates and breaks are already filled in.
 const sections=page.getByRole('navigation',{name:'School setup sections'})
 assert.equal(await sections.getByRole('button',{name:'3 · Classes'}).getAttribute('aria-pressed'),'true')
 await page.getByText(/Term dates, breaks and holidays come from the Boston College calendar/).waitFor()

 await page.getByLabel('Upload my schedule').setInputFiles(proseSchedulePdf())
 await page.getByText(/couldn’t find classes in this layout/).waitFor()
 for(let i=0;i<20&&!cloud.errors.length;i++)await page.waitForTimeout(250)
 const logged=cloud.errors.find(e=>e.message==='Schedule upload found no classes (weekly college)')
 assert.ok(logged,'the unreadable layout was not reported to KONO support')
 assert.match(logged.detail,/File: PDF · text read: \d+ characters · column headings found: no · school: Boston College/)
 assert.ok(!JSON.stringify(logged).includes('Marine'),'the schedule text leaked into the error log')

 await page.getByText('Set up the AI helper (a free Gemini key works)').click()
 await page.getByLabel('API key').fill('test-gemini-key')
 await page.getByRole('button',{name:'Read with AI helper'}).click()
 await page.getByText('Your AI helper found 3 classes.',{exact:false}).waitFor()
 assert.equal(aiRequests.length,1);assert.match(aiRequests[0],/Marine Biology with Dr\. Lee/)
 await page.getByRole('button',{name:'Continue to calendar preview'}).click()
 await page.getByText(/^3 recurring blocks/).waitFor()

 // Adding more classes later: the same upload, into the same draft.
 await sections.getByRole('button',{name:'3 · Classes'}).click()
 await page.getByLabel('Upload my schedule').setInputFiles(classTablePdf())
 await page.getByText('Found 5 classes and 0 schedule blocks.',{exact:false}).waitFor()
 // The results show as a days × times grid.
 const found=page.getByRole('table',{name:'What KONO found'})
 assert.match(await found.getByRole('row',{name:/^Monday/}).innerText(),/Ethics Seminar \(Discussion\)/)
 await page.getByRole('button',{name:'Continue to calendar preview'}).click()
 await page.getByText(/^8 recurring blocks/).waitFor()
 await page.getByLabel('Faculty / program').fill('Carroll School of Management')
 await page.getByLabel(/I checked the calendar/).check()
 await page.getByRole('button',{name:'Save & populate my calendar'}).click()
 await page.getByText(/Schedule saved/).waitFor()
 for(let i=0;i<40&&!JSON.stringify(cloud.users.alice.plan.data).includes('Ethics Seminar (Discussion)');i++)await page.waitForTimeout(250)
 const semester=cloud.users.alice.plan.data.studySeasons.find(s=>s.school?.catalogId==='bc-fall-2026')
 assert.ok(semester,'the semester never reached the account')
 const monday=semester.week.Monday.find(b=>b.label==='Ethics Seminar (Discussion)')
 assert.equal(monday.start,'12:00');assert.equal(monday.end,'12:50');assert.equal(monday.location,'West Hall 141N · Park, Jo')
 assert.equal(semester.week.Tuesday.find(b=>b.label==='Corporate Finance').location,'245 Beacon Street 102 · Okafor, Ben')
 await page.getByRole('button',{name:'Add classes from a file'}).waitFor()

 // The PDF importer (Planner › Add to my calendar) offers the semester for weekly classes; re-adding them skips duplicates.
 await addToCalendar(page,'A PDF of dates')
 await page.getByRole('button',{name:'Import PDF'}).click()
 await page.getByLabel('Choose PDF (up to 20 MB)').setInputFiles(classTablePdf())
 await page.getByRole('button',{name:'Read selected pages'}).click()
 await page.getByText('Text is ready').waitFor()
 await page.getByRole('button',{name:'Find schedule items'}).click()
 const into=page.getByLabel('Put weekly classes in')
 await into.waitFor()
 assert.match(await into.locator('option:checked').innerText(),/Boston College/)
 for(const box of await page.getByLabel('Add this item').all())await box.check()
 await page.getByLabel(/I checked the selected subjects/).check()
 await page.getByRole('button',{name:/Add 3 selected items/}).click()
 await page.getByText(/0 records added; 5 duplicates skipped\. Classes are in /).waitFor()
})

test('Share with a classmate: a student sends an exam from its editor to a connected classmate, who adds it to their plan from “Shared with you”',async({context,page})=>{
 const cloud=fakeCloud()
 cloud.connections=[{id:'c1',requester_id:'alice',recipient_id:'carol',status:'accepted',created_at:'2026-09-20T00:00:00Z'}]
 cloud.profiles={alice:{username:'alice',displayName:'Alice'},carol:{username:'carol',displayName:'Carol'}}
 cloud.users.carol.plan.data.exams=[]
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 assert.equal(await page.getByRole('region',{name:'Shared with you'}).count(),0,'nothing shared yet: no card')
 await go(page,'Exams')
 await page.locator('article').filter({hasText:'Cell biology test'}).first().getByRole('button',{name:'Edit'}).click()
 const editor=page.locator('dialog[open]')
 await editor.getByRole('button',{name:'Share with a classmate'}).click()
 const panel=editor.getByRole('region',{name:'Share with a classmate'})
 await panel.getByText('They’ll get').waitFor()
 await panel.getByText(/Exam · due .* · Biology/).waitFor()
 await panel.getByRole('button',{name:'Send to Carol'}).click()
 await panel.getByText('Sent ✓').waitFor()
 assert.equal(cloud.shared.length,1)
 const sent=cloud.shared[0]
 assert.equal(sent.sender_id,'alice');assert.equal(sent.recipient_id,'carol');assert.equal(sent.kind,'exam')
 assert.deepEqual(Object.keys(sent.item).sort(),['due','notes','subject','title'],'only the shown fields are sent')
 assert.equal(sent.item.title,'Cell biology test');assert.equal(sent.item.subject,'Biology')

 const other=await freshPage()
 try{
  await signInAs(other.context,cloud,'carol')
  await other.page.goto(BASE)
  await heading(other.page,'Sanctuary')
  const inbox=other.page.getByRole('region',{name:'Shared with you'})
  await inbox.getByText('Alice shared an exam').waitFor()
  await inbox.getByText('Cell biology test').waitFor()
  await inbox.getByRole('button',{name:'Add to my plan: Cell biology test'}).click()
  await inbox.getByText('Added “Cell biology test” to your plan.').waitFor()
  assert.equal(cloud.shared.length,0,'added items are cleared')
  await go(other.page,'Exams')
  await other.page.getByText('Cell biology test').filter({visible:true}).first().waitFor()
  await waitFor(()=>JSON.stringify(cloud.users.carol.plan.data.exams).includes('Shared by Alice.'),'the added exam never reached Carol’s account')
  const exam=cloud.users.carol.plan.data.exams.find(e=>e.title==='Cell biology test')
  assert.equal(exam.subjectId,'sub-bio','matched to Carol’s own Biology')
  assert.deepEqual(other.errors,[])
 }finally{await other.context.close()}
})

test('Overdue: past-due assignments show one card with Done, Move to today, Move all and Later; on phones the island comes before Getting started',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.tasks.push({id:'old-sheet',profileId:pid,subjectId:'',title:'Old worksheet',due:'2026-09-01',done:false,notes:''},{id:'old-map',profileId:pid,subjectId:'',title:'Map quiz review',due:'2026-09-10',done:false,notes:''})
 const now=new Date(),today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0')
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 const card=page.getByRole('region',{name:'Overdue'})
 await card.getByRole('heading',{name:'3 assignments are overdue'}).waitFor()
 await card.getByRole('button',{name:'Done: Old worksheet'}).click()
 await card.getByRole('heading',{name:'2 assignments are overdue'}).waitFor()
 await card.getByRole('button',{name:'Move to today: Map quiz review'}).click()
 await card.getByRole('heading',{name:'1 assignment is overdue'}).waitFor()
 await card.getByRole('button',{name:'Later'}).click()
 await card.waitFor({state:'detached'})
 await page.reload();await heading(page,'Sanctuary')
 assert.equal(await page.getByRole('region',{name:'Overdue'}).count(),0,'Later hides it for the rest of today')
 await page.evaluate(id=>localStorage.removeItem('kono-overdue-hidden:'+id),pid)
 await page.reload();await heading(page,'Sanctuary')
 await card.getByRole('heading',{name:'1 assignment is overdue'}).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.tasks.find(t=>t.id==='old-map')?.due===today,'the move never reached the account')
 cloud.users.alice.plan.data.tasks.push({id:'old-lab',profileId:pid,subjectId:'',title:'Late lab',due:'2026-09-12',done:false,notes:''})
 cloud.users.alice.plan.revision++
 await page.reload();await heading(page,'Sanctuary')
 await card.getByRole('heading',{name:'2 assignments are overdue'}).waitFor()
 await card.getByRole('button',{name:'Move all to today'}).click()
 await card.waitFor({state:'detached'})
 await waitFor(()=>{const d=cloud.users.alice.plan.data;return d.tasks.find(t=>t.id==='old-sheet')?.done===true&&['Read chapter 3','Late lab'].every(title=>d.tasks.find(t=>t.title===title)?.due===today)},'the changes never reached the account')

 const phone=await freshPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true})
 try{
  await createPlan(phone.page)
  const start=phone.page.getByRole('region',{name:'Getting started'})
  await start.getByText(/SET UP KONO · \d of 3 done/).waitFor()
  assert.ok(await phone.page.evaluate(()=>{const island=document.querySelector('.wb-island'),start=document.querySelector('.getting-started');return !!island&&!!start&&!!(island.compareDocumentPosition(start)&Node.DOCUMENT_POSITION_FOLLOWING)}),'the island comes first on phones')
  await start.getByRole('button',{name:'Show all setup steps'}).click()
  await start.getByRole('heading',{name:'Set up KONO in a few minutes'}).waitFor()
  assert.deepEqual(phone.errors,[])
 }finally{await phone.context.close()}
})

test('Dark mode: follows a phone set to dark by default; Light and Dark in Look & feel override it and stay after a reload',async()=>{
 const dark=await freshPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'dark'})
 try{
  const page=dark.page,isDark=()=>page.evaluate(()=>document.documentElement.dataset.dark==='true')
  await createPlan(page)
  assert.equal(await isDark(),true,'a phone in dark mode gets KONO in dark')
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.workbench')).backgroundColor),'rgb(22, 19, 26)')
  await go(page,'Settings')
  const choice=page.getByRole('group',{name:'Dark mode'})
  await choice.getByRole('button',{name:'☀️ Light'}).click()
  await page.waitForFunction(()=>!document.documentElement.dataset.dark)
  await flushSave(page,'"darkMode":"light"')
  await page.reload();await heading(page,'Settings')
  assert.equal(await isDark(),false,'Light stays light on a dark phone')
  await page.getByRole('group',{name:'Dark mode'}).getByRole('button',{name:'📱 Match my phone'}).click()
  await page.waitForFunction(()=>document.documentElement.dataset.dark==='true')
  assert.deepEqual(dark.errors,[])
 }finally{await dark.context.close()}
 const light=await freshPage()
 try{
  await createPlan(light.page)
  assert.equal(await light.page.evaluate(()=>document.documentElement.dataset.dark),undefined,'a light device stays light')
  await go(light.page,'Settings')
  await light.page.getByRole('group',{name:'Dark mode'}).getByRole('button',{name:'🌙 Dark'}).click()
  await light.page.waitForFunction(()=>document.documentElement.dataset.dark==='true')
 }finally{await light.context.close()}
})

/** A finger swipe across an element: touchstart, a few touchmoves, touchend (phones only). */
async function swipe(locator,dx){
 await locator.evaluate((el,dx)=>{const r=el.getBoundingClientRect(),x0=r.left+r.width/2,y=r.top+r.height/2
  const fire=(type,x)=>{const t=new Touch({identifier:1,target:el,clientX:x,clientY:y});el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[t],targetTouches:type==='touchend'?[]:[t],changedTouches:[t]}))}
  fire('touchstart',x0);for(let i=1;i<=6;i++)fire('touchmove',x0+dx*i/6);fire('touchend',x0+dx)},dx)
}
test('Weekend, quick add and swipe: Saturday leads with Monday; "bio worksheet due fri" becomes a Biology assignment; on a phone, swipe right finishes and left moves to tomorrow',async({context,page})=>{
 const SATURDAY='2026-10-03T10:00:00'
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.tasks.push({id:'mon-read',profileId:pid,subjectId:'sub-bio',title:'Monday reading',due:'2026-10-05',done:false,notes:''},{id:'mon-lab',profileId:pid,subjectId:'',title:'Lab sheet',due:'2026-10-05',done:false,notes:''})
 plan.exams.push({id:'wed-quiz',profileId:pid,subjectId:'sub-bio',title:'Unit quiz',due:'2026-10-07',done:false,notes:''})
 await page.clock.setFixedTime(new Date(SATURDAY))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 const weekend=page.getByRole('region',{name:'Get ready for Monday'})
 await weekend.getByText('Monday reading').first().waitFor()
 await weekend.getByText('Tests this week:').waitFor()
 assert.match(await weekend.locator('.weekend-tests').innerText(),/Unit quiz \(Wed\)/)

 await page.getByRole('button',{name:'＋ Add',exact:true}).click()
 const chooser=page.getByRole('dialog',{name:'Add to your plan'})
 await chooser.getByLabel('Type it').fill('bio worksheet due fri at 4')
 await chooser.getByText('Assignment: Worksheet').waitFor()
 assert.match(await chooser.locator('.quick-add-preview').innerText(),/Biology · Fri, Oct 9 · 4:00 PM/)
 await chooser.getByRole('button',{name:'Add',exact:true}).click()
 await chooser.waitFor({state:'detached'})
 await page.locator('.undo-toast').getByText('Added “Worksheet”',{exact:false}).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.tasks.some(t=>t.title==='Worksheet'&&t.subjectId==='sub-bio'&&t.due==='2026-10-09'&&t.plannedTime==='16:00'),'the quick-added assignment never reached the account')

 const phone=await freshPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
 try{
  await phone.page.clock.setFixedTime(new Date(SATURDAY))
  await signInAs(phone.context,cloud,'alice')
  await phone.page.goto(BASE)
  await heading(phone.page,'Sanctuary')
  const card=title=>phone.page.getByRole('region',{name:'Get ready for Monday'}).locator('.swipe-row').filter({hasText:title}).first()
  await swipe(card('Monday reading'),150)
  await waitFor(()=>cloud.users.alice.plan.data.tasks.find(t=>t.id==='mon-read')?.done===true,'swipe right never finished it')
  await swipe(card('Lab sheet'),-150)
  await waitFor(()=>cloud.users.alice.plan.data.tasks.find(t=>t.id==='mon-lab')?.due==='2026-10-04','swipe left never moved it to tomorrow')
  // Every one-tap action confirms in a bar at the bottom with Undo.
  const bar=phone.page.locator('.undo-toast')
  await bar.getByText('Moved “Lab sheet” to tomorrow.').waitFor()
  await bar.getByRole('button',{name:'Undo'}).click()
  await bar.waitFor({state:'detached'})
  await waitFor(()=>cloud.users.alice.plan.data.tasks.find(t=>t.id==='mon-lab')?.due==='2026-10-05','Undo never put it back on Monday')
  assert.deepEqual(phone.errors,[])
 }finally{await phone.context.close()}
})

test('Add from Siri or the share sheet, links and photos: /?add=… starts quick add with the link kept; the card opens the link; a photo stays with the assignment after a reload',async({page})=>{
 const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64')
 await createPlan(page)
 await page.goto(BASE+'/?add='+encodeURIComponent('lab report due tomorrow https://docs.google.com/document/d/kono-test'))
 await heading(page,'Sanctuary')
 const chooser=page.getByRole('dialog',{name:'Add to your plan'})
 assert.equal(await chooser.getByLabel('Type it').inputValue(),'lab report due tomorrow')
 await chooser.getByText('docs.google.com/document/d/kono-test').waitFor()
 assert.equal(new URL(page.url()).search,'','the address is cleaned up so a reload doesn’t add it twice')
 await chooser.getByRole('button',{name:'Add',exact:true}).click()
 await chooser.waitFor({state:'detached'})
 const row=()=>page.locator('article.cozy-task-row').filter({hasText:'Lab report'}).first()
 assert.equal(await row().getByRole('link',{name:'🔗 Open link'}).getAttribute('href'),'https://docs.google.com/document/d/kono-test')
 await row().getByRole('button',{name:'Edit'}).click()
 const editor=page.locator('dialog[open]')
 assert.equal(await editor.getByLabel('Link (optional)').inputValue(),'https://docs.google.com/document/d/kono-test')
 await editor.locator('.assignment-photo-add input[type=file]').setInputFiles({name:'worksheet.png',mimeType:'image/png',buffer:PNG})
 await editor.getByRole('button',{name:'Open photo 1'}).waitFor()
 await editor.getByRole('button',{name:'Save',exact:true}).click()
 await editor.waitFor({state:'detached'})
 await row().getByRole('button',{name:'1 photo, open it'}).waitFor()
 await flushSave(page,'"photos":["photo-')
 await page.reload();await heading(page,'Sanctuary')
 await row().getByRole('button',{name:'1 photo, open it'}).click()
 const img=page.locator('dialog[open] .assignment-photo-thumb img')
 await img.waitFor()
 await page.waitForFunction(()=>{const i=document.querySelector('dialog[open] .assignment-photo-thumb img');return !!i&&i.complete&&i.naturalWidth>0})
 await page.locator('dialog[open]').getByRole('button',{name:'Open photo 1'}).click()
 await page.getByRole('dialog',{name:'Photo'}).getByRole('button',{name:'Close'}).click()
 await page.locator('dialog[open]').getByRole('button',{name:'Remove photo 1'}).click()
 assert.equal(await page.locator('dialog[open] .assignment-photo-thumb').count(),0)
})

test('KONO today and stickers: KONO is worried about late work and sleepy late at night; a new sticker gets a speech bubble, opens in Decorate › Stickers and goes on the island; locked ones say how to earn them',async({context,page})=>{
 const cloud=fakeCloud(),pid=cloud.users.alice.plan.data.activeProfileId
 await page.clock.setFixedTime(new Date('2026-09-30T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 const today=page.getByRole('region',{name:'KONO today'})
 await today.getByText('KONO is a little worried about 1 late assignment. One at a time?').waitFor()
 await today.getByRole('button',{name:'Your stickers: 2 of 12 earned'}).waitFor()
 await page.waitForTimeout(900)
 assert.equal(await page.getByText(/New sticker/).count(),0,'the first look on a device only notes what is already earned')
 await page.getByRole('region',{name:'Overdue'}).getByRole('button',{name:'Done: Read chapter 3'}).click()
 await today.getByText('Nothing due today. KONO is having a cup of tea.').waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.tasks.find(t=>t.title==='Read chapter 3')?.done===true,'the finished assignment never reached the account')
 const plan=cloud.users.alice.plan.data
 plan.tasks.push({id:'early-essay',profileId:pid,subjectId:'',title:'Essay draft',due:'2026-10-05',done:true,completedAt:'2026-09-30T14:00:00.000Z',notes:''})
 cloud.users.alice.plan.revision++
 await page.reload();await heading(page,'Sanctuary')
 await page.getByRole('status').filter({hasText:'New sticker: 🐦 Early bird! Put it on your island in Decorate › Stickers.'}).waitFor()
 await today.getByRole('button',{name:'Your stickers: 3 of 12 earned'}).click()
 const palette=page.locator('.build-palette')
 await page.getByRole('navigation',{name:'Decoration categories'}).getByRole('button',{name:'Stickers',exact:true}).and(page.locator('[aria-current="page"]')).waitFor()
 await page.getByText('3 of 12 earned.').waitFor()
 assert.equal(await palette.getByRole('button',{name:'Add Gem'}).count(),0,'a locked sticker can’t be placed')
 await palette.getByLabel('Gem, locked. Finish 100 assignments.').waitFor()
 await palette.getByRole('button',{name:'Add Early bird'}).click()
 await waitFor(()=>(cloud.users.alice.plan.data.sanctuaryDecor?.[pid]?.placements??[]).some(p=>p.assetId==='sticker-early-bird'),'the sticker never reached the island')
 await page.clock.setFixedTime(new Date('2026-09-30T23:15:00'))
 await page.reload();await heading(page,'Sanctuary')
 await today.getByText('It’s late. KONO is curled up for the night. Sleep well!').waitFor()
 assert.match(await today.locator('img').getAttribute('src'),/sleep\.webp$/)
})

test('What should I do now and the app icon number: late work first, "Something else" steps on, "Already done" finishes it, Start opens a focus sized to it; the icon shows due today plus late, and Settings can turn it off',async({context,page})=>{
 const cloud=fakeCloud(),pid=cloud.users.alice.plan.data.activeProfileId
 cloud.users.alice.plan.data.tasks.push({id:'lab-today',profileId:pid,subjectId:'',title:'Lab report',due:'2026-09-30',done:false,notes:'',estimatedMinutes:40})
 await context.addInitScript(()=>{window.__badges=[];navigator.setAppBadge=n=>{window.__badges.push(n);return Promise.resolve()};navigator.clearAppBadge=()=>{window.__badges.push(0);return Promise.resolve()}})
 await page.clock.setFixedTime(new Date('2026-09-30T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 const badge=()=>page.evaluate(()=>window.__badges.at(-1))
 const until=async(check,message)=>{for(let k=0;k<60;k++){if(await check())return;await page.waitForTimeout(250)}assert.fail(message)}
 await until(async()=>await badge()===2,'the icon should count the late assignment and the one due today')
 await page.getByRole('button',{name:'What should I do now?'}).click()
 const now=page.getByRole('region',{name:'What to do now'})
 await now.getByRole('heading',{name:'Read chapter 3'}).waitFor()
 await now.getByText('DO THIS NOW · 1 of 2').waitFor()
 await now.getByText(/It’s late/).waitFor()
 await now.getByRole('button',{name:'Something else'}).click()
 await now.getByRole('heading',{name:'Lab report'}).waitFor()
 await now.getByText('It’s due today. About 40 minutes.').waitFor()
 await now.getByRole('button',{name:'Already done'}).click()
 await now.getByRole('heading',{name:'Read chapter 3'}).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.tasks.find(t=>t.id==='lab-today')?.done===true,'Already done never reached the account')
 await until(async()=>await badge()===1,'the icon should drop to 1')
 await now.getByRole('button',{name:'Start a 30-minute focus'}).click()
 await now.waitFor({state:'detached'})
 await until(()=>page.evaluate(()=>document.querySelector('details.sanctuary-focus')?.open===true),'the focus session never opened')
 await go(page,'Settings')
 await settingsTab(page,'Notifications')
 await page.getByLabel('Show how many things are due today (and late) on KONO’s icon').uncheck()
 await until(async()=>await badge()===0,'turning it off should clear the icon')
})

test('Halloween island: all of October the island has its spooky look (with its own quick picture while it loads), and in November it is back to normal',async({context,page})=>{
 const cloud=fakeCloud(),maps=[]
 page.on('response',r=>{const u=new URL(r.url());if(/\/garden\/terrace-23\.0\//.test(u.pathname))maps.push([u.pathname,r.status()])})
 await page.clock.setFixedTime(new Date('2026-10-15T21:30:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await islandLoaded(page)
 assert.ok(maps.some(([p,st])=>p==='/garden/terrace-23.0/halloween/night.webp'&&st===200),'the Halloween night island loads: '+JSON.stringify(maps))
 assert.ok(!maps.some(([p])=>p==='/garden/terrace-23.0/night.webp'),'not the regular one')
 if(process.env.KONO_SHOTS){await page.waitForTimeout(6000);await page.locator('.sanctuary-viewport').screenshot({path:process.env.KONO_SHOTS+'/halloween-island-night.png'})}
 maps.length=0
 await page.clock.setFixedTime(new Date('2026-11-02T21:30:00'))
 await page.reload();await heading(page,'Sanctuary')
 await islandLoaded(page)
 assert.ok(maps.some(([p,st])=>p==='/garden/terrace-23.0/night.webp'&&st===200),'in November the regular island is back: '+JSON.stringify(maps))
 assert.ok(!maps.some(([p])=>p.includes('/halloween/')))
})

test('Halloween on the island: in October KONO wears a pumpkin, a banner counts the 4 spooky stickers, finishing work earns the Pumpkin, and it goes on the island',async({context,page})=>{
 const cloud=fakeCloud(),pid=cloud.users.alice.plan.data.activeProfileId
 // No test that day (on a test day KONO wears its study headband instead of the pumpkin).
 for(const e of cloud.users.alice.plan.data.exams)e.due='2026-10-20'
 await page.clock.setFixedTime(new Date('2026-10-02T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 const today=page.getByRole('region',{name:'KONO today'})
 await today.getByText('Spooky season: 0/4 special stickers until Oct 31',{exact:false}).waitFor()
 assert.equal(await today.locator('.kono-mood-face').getAttribute('data-costume'),'🎃')
 await today.getByRole('button',{name:'Your stickers: 2 of 16 earned'}).waitFor()
 await page.waitForTimeout(900)
 await page.getByRole('region',{name:'Overdue'}).getByRole('button',{name:'Done: Read chapter 3'}).click()
 await page.getByRole('status').filter({hasText:'New sticker: 🎃 Pumpkin! Put it on your island in Decorate › Stickers.'}).waitFor()
 await today.getByText('Spooky season: 1/4 special stickers',{exact:false}).waitFor()
 await today.getByRole('button',{name:'Your stickers: 3 of 16 earned'}).click()
 const palette=page.locator('.build-palette')
 await palette.getByLabel('Friendly ghost, locked. Study 3 days in a row in October.').waitFor()
 await palette.getByRole('button',{name:'Add Pumpkin'}).click()
 await waitFor(()=>(cloud.users.alice.plan.data.sanctuaryDecor?.[pid]?.placements??[]).some(p=>p.assetId==='sticker-halloween-pumpkin'),'the pumpkin never reached the island')
 await page.clock.setFixedTime(new Date('2026-11-05T15:00:00'))
 await page.reload();await heading(page,'Sanctuary')
 assert.equal(await today.locator('.kono-season').count(),0,'the event is over')
 await today.getByRole('button',{name:'Your stickers: 3 of 13 earned'}).click()
 await palette.getByRole('button',{name:'Add Pumpkin'}).waitFor()
 assert.equal(await palette.getByText('Friendly ghost').count(),0,'unearned event stickers leave with the event')
})

test('Project steps: "Break into steps" asks KONO’s AI for dated steps, they can be changed and reach the account, and "What should I do now?" brings up today’s step',async({context,page})=>{
 const cloud=fakeCloud(),prompts=[]
 await context.route(BASE+'api/ai',route=>{
  const request=route.request()
  if(request.method()==='GET')return route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true})})
  prompts.push(request.postDataJSON().prompt)
  const steps=[{title:'Find three sources',date:'2026-09-30'},{title:'Write your thesis and outline',date:'2026-10-04'},{title:'Write the draft',date:'2026-10-08'}]
  return route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({text:JSON.stringify({steps}),used:1,limit:40})})
 })
 await page.clock.setFixedTime(new Date('2026-09-30T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 await page.getByRole('button',{name:'＋ Add',exact:true}).click()
 const chooser=page.getByRole('dialog',{name:'Add to your plan'})
 await chooser.getByLabel('Type it').fill('history essay due 10/12')
 await chooser.getByRole('button',{name:'Edit details'}).click()
 const editor=page.locator('dialog[open]')
 await editor.getByRole('button',{name:'✨ Break into steps'}).click()
 await editor.getByText('KONO’s AI suggested these steps.',{exact:false}).waitFor()
 assert.match(prompts[0],/essay/i)
 assert.match(prompts[0],/It is due 2026-10-12/)
 assert.equal(await editor.getByLabel('Day for Find three sources').inputValue(),'2026-09-30')
 await editor.getByLabel('Day for Write the draft').fill('2026-10-09')
 assert.equal(await editor.getByRole('button',{name:'✨ Break into steps'}).count(),0,'only offered while there are no steps')
 await editor.getByRole('button',{name:'Save',exact:true}).click()
 await editor.waitFor({state:'detached'})
 await waitFor(()=>{const t=cloud.users.alice.plan.data.tasks.find(x=>/essay/i.test(x.title));return t?.subtasks?.map(st=>st.title+'@'+st.due).join('|')==='Find three sources@2026-09-30|Write your thesis and outline@2026-10-04|Write the draft@2026-10-09'},'the dated steps never reached the account')
 await page.getByRole('button',{name:'What should I do now?'}).click()
 const now=page.getByRole('region',{name:'What to do now'})
 await now.getByRole('heading',{name:'Read chapter 3'}).waitFor()
 await now.getByRole('button',{name:'Something else'}).click()
 await now.getByText('Next step: Find three sources').waitFor()
 await now.getByText('Today’s step for this project.',{exact:false}).waitFor()
})

test('Team calendar for a parent: a TeamSnap webcal link is a team calendar, the parent picks whose team it is, every game is tagged with that kid and counts as sports, and the link stays followed',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.settings.parentMode=true
 const requests=[]
 const feed=['BEGIN:VCALENDAR','X-WR-CALNAME:Hawks U12','BEGIN:VEVENT','UID:g1','SUMMARY:Hawks vs Lions','DTSTART:20261010T090000','DTEND:20261010T103000','LOCATION:Riverside Park','END:VEVENT','BEGIN:VEVENT','UID:pic','SUMMARY:Team photos','DTSTART:20261003T100000','END:VEVENT','END:VCALENDAR'].join('\r\n')
 await context.route(BASE+'api/calendar-feed',route=>{requests.push(route.request().postDataJSON());return route.fulfill({status:200,headers:{'content-type':'text/calendar'},body:feed})})
 await page.clock.setFixedTime(new Date('2026-09-30T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 await addToCalendar(page,'A calendar link')
 await page.getByText('How to follow a team’s schedule (TeamSnap, GameChanger, SportsEngine…)').waitFor()
 await page.getByLabel('Or paste a calendar link').fill('webcal://go.teamsnap.com/ical/abc123.ics')
 await page.getByRole('button',{name:'Get calendar'}).click()
 const review=page.locator('.calendar-import-review')
 await review.waitFor()
 assert.equal(requests[0].url,'webcal://go.teamsnap.com/ical/abc123.ics')
 assert.equal(await review.getByLabel('It’s a team or activity calendar (practices and games show as sports)').isChecked(),true,'a TeamSnap link is a team calendar')
 await review.getByLabel('Whose calendar is this?').selectOption('kid-emma')
 await review.getByRole('button',{name:'Add 2 to my plan'}).click()
 await page.getByText(/^2 added\./).waitFor()
 await waitFor(()=>{const e=cloud.users.alice.plan.data.calendarEvents.filter(x=>x.profileId===pid&&/Hawks vs Lions|Team photos/.test(x.title));return e.length===2&&e.every(x=>x.kidId==='kid-emma'&&x.kind==='sports')},'the team’s events never reached the account tagged with Emma as sports')
 const linked=page.locator('.linked-calendars')
 await linked.getByText('Hawks U12').waitFor()
 assert.match(await linked.innerText(),/Hawks U12 · Emma · team/)
})

test('School heads-up: a week before Thanksgiving the Sanctuary says there is an early release and two days off, Got it hides it, and it stays hidden after a reload',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
 plan.studySeasons.push({id:'riverside',profileId:pid,name:'Riverside Middle',start:'2026-09-01',end:'2027-06-20',active:true,week:Object.fromEntries(days.map(d=>[d,[]])),
  school:{pattern:'weekly',name:'Riverside Middle',grade:'7',cycle:days,anchorDate:'2026-09-01',anchorDay:'Tuesday',weekdays:[1,2,3,4,5],snowAdvances:false,lastClassDate:'2027-06-15',exceptions:[
   {id:'x1',start:'2026-11-26',end:'2026-11-27',kind:'holiday',label:'Thanksgiving recess',audience:'all'},
   {id:'x2',start:'2026-11-25',end:'2026-11-25',kind:'half',label:'Early release',audience:'all'},
   {id:'x3',start:'2026-12-24',end:'2026-12-31',kind:'holiday',label:'Winter recess',audience:'all'}]}})
 await page.clock.setFixedTime(new Date('2026-11-19T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 const notice=page.locator('.school-heads-up')
 await notice.getByText('📅 Coming up at school').waitFor()
 assert.equal(await notice.locator('li').evaluateAll(li=>li.map(x=>x.textContent).join(' | ')),'Early release Wed, Nov 25 · Riverside Middle | No school Thu, Nov 26 – Fri, Nov 27 · Thanksgiving recess · Riverside Middle')
 assert.ok(!(await notice.innerText()).includes('Winter'),'only the next week')
 await go(page,'Planner')
 await page.locator('.school-heads-up').getByText('No school Thu, Nov 26 – Fri, Nov 27').waitFor()
 await page.locator('.school-heads-up').getByRole('button',{name:'Got it'}).click()
 await page.locator('.school-heads-up').waitFor({state:'detached'})
 await page.reload();await heading(page,'Planner')
 await go(page,'Sanctuary')
 assert.equal(await page.locator('.school-heads-up').count(),0,'Got it keeps them hidden on this device')
})

test('Ask KONO: KONO greets and asks what you want to know and answers today, this week and "when is … due" on screen only (KONO doesn’t talk)',async({context,page})=>{
 const cloud=fakeCloud()
 await context.addInitScript(()=>{window.__spoken=[];window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak:u=>window.__spoken.push(u.text),cancel(){},getVoices:()=>[]}})})
 await page.clock.setFixedTime(new Date('2026-09-30T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 await page.getByRole('button',{name:'Ask KONO',exact:true}).click()
 const kono=page.getByRole('dialog',{name:'Ask KONO'})
 await kono.getByText('What do you want to know?',{exact:false}).waitFor()
 await kono.getByRole('button',{name:'📅 Today’s schedule'}).click()
 await kono.getByText('Today · Wednesday, September 30').waitFor()
 await kono.getByText('⚠ Late: Emma: Read chapter 3').waitFor()
 await kono.getByRole('button',{name:'🗓️ This week'}).click()
 await kono.getByText('Friday: ★ Cell biology test').waitFor()
 await kono.getByRole('button',{name:'⏰ When is something due?'}).click()
 await kono.getByLabel('What’s it called?').fill('chapter 3')
 await kono.getByRole('button',{name:'Ask',exact:true}).click()
 await kono.getByText('Read chapter 3 was due Friday, September 25, so it’s late.').waitFor()
 await page.waitForTimeout(300)
 assert.deepEqual(await page.evaluate(()=>window.__spoken.slice()),[],'KONO doesn’t talk')
 for(const name of [/Talk/,/Quiet/,/Natural voice/,/Say it again/])assert.equal(await kono.getByRole('button',{name}).count(),0)
 await kono.getByRole('button',{name:'Close'}).click()
 await kono.waitFor({state:'detached'})
 await page.getByRole('button',{name:'What should I do now?'}).waitFor()
})

test('Sanctuary: KONO today is a slim bar on top of the island, and Decorate opened from its sticker button keeps the decorations on the island',async({context,page})=>{
 const cloud=fakeCloud()
 await page.clock.setFixedTime(new Date('2026-10-02T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const bar=page.getByRole('region',{name:'KONO today'}),island=page.locator('.wb-island')
 // Measured together once the page has settled (late content above can still move both for a moment).
 await page.waitForFunction(()=>{const b=document.querySelector('.kono-bar')?.getBoundingClientRect(),i=document.querySelector('.wb-island')?.getBoundingClientRect();return b&&i&&b.bottom<=i.top+1},null,{timeout:5000,polling:200}).catch(()=>undefined)
 const b=await bar.boundingBox(),i=await island.boundingBox(),docY=await page.evaluate(()=>scrollY)
 if(process.env.KONO_SHOTS){await page.screenshot({fullPage:true,path:process.env.KONO_SHOTS+'/kono-bar.png',clip:{x:b.x-10,y:b.y+docY-10,width:b.width+20,height:b.height+200}});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);const pb=await bar.evaluate(e=>{const r=e.getBoundingClientRect();return {y:r.top+scrollY,height:r.height}});await page.screenshot({fullPage:true,path:process.env.KONO_SHOTS+'/kono-bar-phone.png',clip:{x:0,y:Math.max(0,pb.y-10),width:390,height:pb.height+160}});await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(400)}
 assert.ok(b.height<160,'the KONO bar is slim (two short rows, even with a note from KONO): '+b.height+'px')
 assert.ok(b.y+b.height<=i.y+1,'the KONO bar sits right above the island')
 await page.getByRole('button',{name:'Decorate'}).click()
 const nav=page.getByRole('navigation',{name:'Decoration categories'})
 for(const cat of ['Homes','Trees','Ponds']){await nav.getByRole('button',{name:cat,exact:true}).click();await page.locator('.build-palette [role=button][aria-label^="Add "]').first().click()}
 await page.getByRole('button',{name:'Your island'}).click()
 await bar.getByRole('button',{name:/^Your stickers/}).click()
 await page.getByText(/^Earn stickers by keeping up with your work/).waitFor()
 await page.waitForTimeout(600)
 const aligned=async why=>{const art=await page.locator('.wb-sanctuary-zoom-wrap').boundingBox(),layer=await page.locator('.build-hotspot-layer').boundingBox();assert.ok(Math.abs(art.y-layer.y)<2&&Math.abs(art.x-layer.x)<2&&Math.abs(art.height-layer.height)<8,why+': the decorations layer '+JSON.stringify(layer)+' left the island '+JSON.stringify(art))}
 await aligned('opened from the sticker button')
 await page.mouse.wheel(0,500);await page.waitForTimeout(300)
 await aligned('after scrolling down to the palette')
 if(process.env.KONO_SHOTS)await page.screenshot({path:process.env.KONO_SHOTS+'/decorate-stickers.png'})
})

test('Sanctuary › Today’s and Tomorrow’s schedule: ＋ Add saves an assignment, test or event for that day right in the card, and it shows on the Planner calendar',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data
 plan.settings.parentMode=false
 await page.clock.setFixedTime(new Date('2026-09-28T08:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const todayCard=page.locator('section.today-schedule-compact').filter({has:page.getByRole('heading',{name:'Today’s schedule'})})
 const tomorrowCard=page.locator('section.tomorrow-schedule')
 const dialogs=await page.getByRole('dialog').count()
 await todayCard.getByRole('button',{name:'Add for today'}).click()
 const todayForm=todayCard.getByRole('form',{name:'Add for today'})
 await todayForm.getByLabel('What to add for today').fill('Lab report')
 await todayForm.getByRole('button',{name:'Add',exact:true}).click()
 await todayCard.getByText('Lab report').first().waitFor()
 await todayForm.getByLabel('What to add for today').fill('Tutoring')
 await todayForm.getByRole('radio',{name:'Event'}).click()
 await todayForm.getByLabel('Time').fill('16:30')
 await todayForm.getByRole('button',{name:'Add',exact:true}).click()
 await todayCard.getByText('Tutoring').first().waitFor()
 if(process.env.KONO_SHOTS)await todayCard.screenshot({path:process.env.KONO_SHOTS+'/quick-day.png'})
 await todayForm.getByRole('button',{name:'Done'}).click()
 await tomorrowCard.getByRole('button',{name:'Add for tomorrow'}).click()
 const tomorrowForm=tomorrowCard.getByRole('form',{name:'Add for tomorrow'})
 await tomorrowForm.getByLabel('What to add for tomorrow').fill('Spanish quiz')
 assert.equal(await tomorrowForm.getByRole('radio',{name:'Test'}).getAttribute('aria-checked'),'true','a quiz is a test')
 await tomorrowForm.getByRole('button',{name:'Add',exact:true}).click()
 await tomorrowCard.getByText('Spanish quiz').first().waitFor()
 assert.equal(await page.getByRole('dialog').count(),dialogs,'nothing pops up')
 await waitFor(()=>{const d=cloud.users.alice.plan.data;return d.tasks.some(t=>t.title==='Lab report'&&t.due==='2026-09-28')&&d.calendarEvents.some(e=>e.title==='Tutoring'&&e.date==='2026-09-28'&&e.time==='16:30'&&e.endTime==='17:30')&&d.exams.some(e=>e.title==='Spanish quiz'&&e.due==='2026-09-29')},'the three reach the account')
 await go(page,'Planner')
 const week=page.getByRole('region',{name:'Week'})
 await week.getByRole('button',{name:/^Lab report · Sep 28, 2026/}).waitFor()
 await week.getByRole('button',{name:/^Tutoring · 4:30 PM–5:30 PM · Sep 28, 2026/}).waitFor()
 await week.getByRole('button',{name:/^★ Spanish quiz|^Spanish quiz · Sep 29, 2026/}).first().waitFor()
})

test('KONO’s notes: good luck the evening before a test, the study headband on test day, How did it go? after it (answered once), and one gentle nudge a day, all in the KONO bar',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.exams.push({id:'bio-quiz',profileId:pid,subjectId:'',title:'Bio quiz',due:'2026-10-08',done:false,notes:''})
 await page.clock.setFixedTime(new Date('2026-10-07T18:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const bar=page.getByRole('region',{name:'KONO today'}),note=bar.locator('.kono-note')
 await note.getByText('🍀 Good luck on Bio quiz tomorrow! You’ve got this.').waitFor()
 const dialogs=await page.getByRole('dialog').count()
 // Test day: KONO wears its study headband.
 await page.clock.setFixedTime(new Date('2026-10-08T09:00:00'))
 await page.reload();await heading(page,'Sanctuary')
 await note.getByText(/^💪 Bio quiz is today\./).waitFor()
 await bar.locator('.kono-mood-face img.kono-outfit[src$="headband.webp"]').waitFor()
 // After it: How did it go?
 await page.clock.setFixedTime(new Date('2026-10-08T16:00:00'))
 await page.reload();await heading(page,'Sanctuary')
 await note.getByText('How did Bio quiz go?').waitFor()
 if(process.env.KONO_SHOTS)await bar.screenshot({path:process.env.KONO_SHOTS+'/kono-note-ask.png'})
 await note.getByRole('button',{name:'Good'}).click()
 await bar.getByText(/^Yay! I knew you could do it!/).waitFor()
 await bar.getByText('How did Bio quiz go?').waitFor({state:'detached'})
 await waitFor(()=>(cloud.users.alice.plan.data.konoCare?.[pid]?.log??[]).some(e=>e.id==='exam-bio-quiz'&&e.item==='good'),'the answer reaches the account')
 // The next morning: not asked again, and the day’s one nudge instead.
 await page.clock.setFixedTime(new Date('2026-10-09T09:00:00'))
 await page.reload();await heading(page,'Sanctuary')
 await note.getByText(/^📌 .+ Start with \d+ minutes\?/).waitFor()
 assert.equal(await bar.getByText('How did Bio quiz go?').count(),0)
 await note.getByRole('button',{name:'Not now'}).click()
 await note.waitFor({state:'detached'})
 await waitFor(()=>(cloud.users.alice.plan.data.konoCare?.[pid]?.log??[]).some(e=>e.id==='nudge-2026-10-09'&&e.item==='later'),'Not now reaches the account')
 await page.reload();await heading(page,'Sanctuary')
 await bar.locator('.kono-mood-face').waitFor()
 assert.equal(await bar.locator('.kono-note').count(),0,'one nudge a day')
 assert.equal(await page.getByRole('dialog').count(),dialogs,'nothing pops up')
})

test('KONO’s taps: coming back after a while gets a wave, a tap right after finishing something is a high five, three quick taps tickle, and the Feed button knows this week’s favorite snack',async({context,page})=>{
 const cloud=fakeCloud(),pid=cloud.users.alice.plan.data.activeProfileId,now=new Date('2026-10-12T16:00:00')
 for(const e of cloud.users.alice.plan.data.exams)e.due='2026-10-20'
 await page.clock.setFixedTime(now)
 await context.addInitScript(([key,value])=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem(key,value);sessionStorage.setItem('seeded','1')}},['kono-last-visit:'+pid,String(now.getTime()-3*3_600_000)])
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const bar=page.getByRole('region',{name:'KONO today'}),face=bar.getByRole('button',{name:'Pet KONO'})
 // Back after three hours: a wave hello.
 await bar.getByText('👋 Welcome back! KONO missed you.').waitFor()
 await bar.locator('.kono-react.is-wave').waitFor()
 await bar.getByText('👋 Welcome back! KONO missed you.').waitFor({state:'detached',timeout:8000})
 // Finish something, then tap KONO: a high five (once for it).
 await page.getByRole('region',{name:'Overdue'}).getByRole('button',{name:'Done: Read chapter 3'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.tasks.find(t=>t.title==='Read chapter 3')?.done===true,'finished')
 await page.waitForTimeout(600)
 await face.click()
 await bar.getByText('✋ High five! Nice work on Read chapter 3!').waitFor()
 await bar.locator('.kono-react.is-highfive').waitFor()
 // The Feed button says what this week's favorite is.
 assert.match(await bar.locator('.kono-feed').getAttribute('title'),/favorite this week/)
 await page.waitForTimeout(3800)
 // Three quick taps: a tickle.
 for(let i=0;i<3;i++)await face.click({delay:20})
 await bar.getByText(/^(Hehe! That tickles!|Ahaha! Stop, stop!|KONO giggles and wiggles all over!)/).waitFor()
 await bar.locator('.kono-mood-face.is-tickle').waitFor()
 if(process.env.KONO_SHOTS)await bar.screenshot({path:process.env.KONO_SHOTS+'/kono-tickle.png'})
})

test('Taking care of KONO: finished work earns a snack, Feed KONO feeds it in the card, a pat makes KONO happy, and both reach the account without anything popping up',async({context,page})=>{
 const cloud=fakeCloud(),pid=cloud.users.alice.plan.data.activeProfileId
 await page.clock.setFixedTime(new Date('2026-09-30T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 const today=page.getByRole('region',{name:'KONO today'}),care=today.getByRole('group',{name:'How KONO is doing'})
 assert.equal(await today.getByText('KONO just got back from a little trip',{exact:false}).count(),0,'the first visit ever isn’t a homecoming')
 await page.evaluate(pid=>localStorage.setItem('kono-last-visit:'+pid,String(Date.now()-5*86_400_000)),pid)
 await page.reload();await heading(page,'Sanctuary')
 await today.getByText('KONO just got back from a little trip and missed you! 🧳').waitFor()
 await page.reload();await heading(page,'Sanctuary')
 await today.getByText('KONO is a little worried about 1 late assignment. One at a time?').waitFor()
 assert.deepEqual(await care.getByRole('meter').evaluateAll(m=>m.map(x=>x.getAttribute('aria-label'))),['Full','Rested','Happy'])
 const value=name=>care.getByRole('meter',{name}).getAttribute('aria-value'+'now').then(Number)
 const feed=care.getByRole('button',{name:/^Feed KONO/})
 const snacksBefore=await feed.count()
 await page.getByRole('region',{name:'Overdue'}).getByRole('button',{name:'Done: Read chapter 3'}).click()
 await feed.waitFor()
 const dialogsBefore=await page.getByRole('dialog').count()
 const fullBefore=await value('Full'),happyBefore=await value('Happy')
 await feed.click()
 await today.getByText(/^Yum! .+ KONO loved the .+\. Thank you!$/).waitFor()
 await waitFor(()=>(cloud.users.alice.plan.data.konoCare?.[pid]?.log??[]).some(e=>e.kind==='feed'),'the feeding never reached the account')
 const fed=cloud.users.alice.plan.data.konoCare[pid].log.find(e=>e.kind==='feed')
 assert.equal(cloud.users.alice.plan.data.tasks.find(t=>t.id===fed.taskId)?.done,true,'KONO eats the snack from finished work')
 assert.ok(await value('Full')>fullBefore,'a snack fills KONO up')
 if(!snacksBefore)assert.equal(await feed.count(),0,'the one snack is eaten, so the chip goes away')
 await today.getByRole('button',{name:'Pet KONO'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.konoCare[pid].log.some(e=>e.kind==='pet'),'the pat never reached the account')
 // (Work was just finished, so this tap is a high five; it still counts as a pat.)
 await today.getByText(/KONO (giggles|leans|does a happy)|^✋ High five!/).waitFor()
 assert.ok(await value('Happy')>happyBefore,'pats and snacks make KONO happier')
 await today.getByRole('button',{name:'Pet KONO'}).click()
 await page.waitForTimeout(500)
 assert.equal(cloud.users.alice.plan.data.konoCare[pid].log.filter(e=>e.kind==='pet').length,1,'lots of taps still count as one pat for ten minutes')
 assert.equal(await page.getByRole('dialog').count(),dialogsBefore,'caring for KONO never opens anything')
 if(process.env.KONO_SHOTS){await today.screenshot({path:process.env.KONO_SHOTS+'/care-desktop.png'});await page.setViewportSize({width:375,height:800});await today.screenshot({path:process.env.KONO_SHOTS+'/care-phone.png'});await page.setViewportSize({width:1280,height:900})}
 await page.reload();await heading(page,'Sanctuary')
 assert.ok(await value('Full')>fullBefore,'the meters come from the saved log after a reload')
})

test('Bedtime and wake-up: in the evening KONO can be tucked in and shows tomorrow’s plan (without talking), sleeps until morning (pats just get a "shh"), and in the morning Wake up shows today’s plan, all inside the card',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.calendarEvents.push({id:'soccer',profileId:pid,title:'Soccer practice',date:'2026-10-01',time:'17:00',kind:'personal',done:false,notes:''})
 plan.tasks.push({id:'dinner',profileId:pid,subjectId:'',title:'Math homework',due:'2026-09-30',done:true,completedAt:'2026-09-30T18:00:00.000Z',notes:''})
 await context.addInitScript(()=>{window.__spoken=[];window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak:u=>window.__spoken.push(u.text),cancel(){},getVoices:()=>[]}})})
 await page.clock.setFixedTime(new Date('2026-09-30T21:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const today=page.getByRole('region',{name:'KONO today'}),care=today.getByRole('group',{name:'How KONO is doing'})
 assert.equal(await care.getByRole('button',{name:'Wake up'}).count(),0,'no wake-up in the evening')
 const dialogs=await page.getByRole('dialog').count()
 // Dinner before bed: with a snack waiting and KONO hungry, the one chip is Feed; once fed, Tuck in.
 assert.equal(await care.getByRole('button',{name:'Tuck in'}).count(),0)
 const feed=care.getByRole('button',{name:/^Feed KONO/}),tuck=care.getByRole('button',{name:'Tuck in'})
 for(let meals=0;;meals++){
  // After each snack the card re-renders: wait until it shows the next chip, then decide.
  await feed.or(tuck).first().waitFor()
  if(await tuck.count())break
  assert.ok(meals<5,'KONO should be full enough for bed after a few snacks')
  // Wait for this snack itself (KONO's daily wish is saved around now too), so the next look at the
  // chip sees the card after the meal.
  const meals0=(cloud.users.alice.plan.data.konoCare?.[pid]?.log??[]).filter(e=>e.kind==='feed').length
  await feed.click()
  await waitFor(()=>(cloud.users.alice.plan.data.konoCare?.[pid]?.log??[]).filter(e=>e.kind==='feed').length>meals0,'the snack never reached the account')
 }
 assert.equal(await care.getByRole('button').count(),1,'one action chip at a time')
 await care.getByRole('button',{name:'Tuck in'}).click()
 await today.locator('p[aria-live]',{hasText:/^Goodnight! 🌙 Tomorrow: .*Soccer practice at 5:00 PM.*\.$/}).waitFor()
 await waitFor(()=>(cloud.users.alice.plan.data.konoCare?.[pid]?.log??[]).some(e=>e.kind==='sleep'),'the tuck-in never reached the account')
 const spoken=await page.evaluate(()=>window.__spoken.slice())
 assert.deepEqual(spoken,[],'KONO doesn’t talk')
 assert.equal(await page.getByRole('dialog').count(),dialogs,'nothing opens')
 await page.reload();await heading(page,'Sanctuary')
 await today.getByText('KONO is fast asleep. Sweet dreams! 🌙').waitFor()
 assert.equal(await care.getByRole('button',{name:'Tuck in'}).count(),0,'already tucked in')
 assert.equal(await care.getByRole('button',{name:/^Feed KONO/}).count(),0,'no snacks while KONO sleeps')
 assert.equal(await care.getByRole('meter',{name:'Sleeping'}).count(),1)
 await today.getByRole('button',{name:'Pet KONO'}).click()
 await today.getByText('Shh… KONO is sleeping. 💤').waitFor()
 await page.clock.setFixedTime(new Date('2026-10-01T07:30:00'))
 await page.reload();await heading(page,'Sanctuary')
 await care.getByRole('button',{name:'Wake up'}).click()
 await today.locator('p[aria-live]',{hasText:/^Good morning! ☀️ Today: .*Soccer practice at 5:00 PM.*\.$/}).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.konoCare[pid].log.some(e=>e.kind==='wake'),'the wake-up never reached the account')
 assert.equal(await care.getByRole('button',{name:'Wake up'}).count(),0,'once a day')
 assert.deepEqual(await page.evaluate(()=>window.__spoken.slice()),[],'KONO doesn’t talk')
})

test('Wardrobe and daily wish: finishing work grants KONO’s wish, which earns the beanie; KONO wears it in the card from Decorate › Wardrobe; Halloween costumes show in October with how to earn them',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.tasks.push({id:'quiz-prep',profileId:pid,subjectId:'',title:'Quiz prep',due:'2026-10-01',done:false,notes:''})
 await page.clock.setFixedTime(new Date('2026-10-01T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const today=page.getByRole('region',{name:'KONO today'})
 await today.getByText('✨ KONO wishes you’d finish one thing today').waitFor()
 const dialogs=await page.getByRole('dialog').count()
 await page.getByRole('region',{name:'Overdue'}).getByRole('button',{name:'Done: Read chapter 3'}).click()
 await today.getByText('✨ KONO’s wish came true! Thank you!').waitFor()
 await waitFor(()=>(cloud.users.alice.plan.data.konoCare?.[pid]?.log??[]).some(e=>e.id==='wish-2026-10-01'&&e.kind==='wish'),'the granted wish never reached the account')
 await today.getByText('✨ Today’s wish came true.').waitFor()
 await today.getByText('🎁 New outfit for KONO: Cozy beanie! Try it on in Decorate › Wardrobe.').waitFor({timeout:15000})
 assert.equal(await page.getByRole('dialog').count(),dialogs,'nothing pops up')
 await page.getByRole('button',{name:'Decorate'}).click()
 await page.getByRole('navigation',{name:'Decoration categories'}).getByRole('button',{name:'Wardrobe'}).click()
 const wardrobe=page.locator('.kono-wardrobe')
 await wardrobe.getByLabel('Witch hat, locked. Finish 2 assignments in October.').waitFor()
 await wardrobe.getByLabel(/^Ghost costume, locked/).waitFor()
 await wardrobe.getByLabel('Frankenstein, locked. Grant 3 of KONO’s wishes in October.').waitFor()
 await wardrobe.getByRole('button',{name:'Wear Cozy beanie'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.konoCare[pid].log.some(e=>e.kind==='wear'&&e.item==='beanie'),'the outfit never reached the account')
 await today.locator('.kono-mood-face img.kono-outfit[src$="beanie.webp"]').waitFor()
 if(process.env.KONO_SHOTS){await today.screenshot({path:process.env.KONO_SHOTS+'/wardrobe-card.png'});await wardrobe.screenshot({path:process.env.KONO_SHOTS+'/wardrobe-panel.png'})}
 await wardrobe.getByRole('button',{name:'Take off Cozy beanie'}).click()
 await today.locator('.kono-mood-face img.kono-outfit').waitFor({state:'detached'})
 await waitFor(()=>cloud.users.alice.plan.data.konoCare[pid].log.some(e=>e.kind==='wear'&&e.item===''),'taking it off never reached the account')
 await page.reload();await heading(page,'Sanctuary')
 assert.equal(await today.locator('.kono-mood-face img.kono-outfit').count(),0,'taken off stays off')
})

test('Focus finds: when a focus session runs all the way down, KONO (who read beside you) shares a find in its line; it unlocks in Decorate › Finds and can go on the island',async({context,page})=>{
 const cloud=fakeCloud(),pid=cloud.users.alice.plan.data.activeProfileId
 await page.clock.install({time:new Date('2026-09-15T15:00:00')})
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const today=page.getByRole('region',{name:'KONO today'})
 const outer=page.locator('details.sanctuary-focus')
 await outer.locator(':scope > summary').click()
 const focus=outer.locator('details.focus-session')
 await focus.locator(':scope > summary').click()
 await focus.getByLabel('Minutes').fill('25');await focus.getByLabel('Seconds').fill('0')
 await focus.getByRole('button',{name:'Start timer'}).click()
 await page.clock.runFor(25*60*1000+3000)
 await focus.getByText('Session complete. Take a short break.').waitFor()
 await today.getByText(/^KONO found an? .+ while you focused for 25 minutes! It’s in Decorate › Finds\.$/).waitFor()
 await today.locator('img.kono-find-icon').waitFor()
 if(process.env.KONO_SHOTS)await today.screenshot({path:process.env.KONO_SHOTS+'/find-card.png'})
 await waitFor(()=>(cloud.users.alice.plan.data.konoCare?.[pid]?.log??[]).some(e=>e.kind==='find'),'the find never reached the account')
 const find=cloud.users.alice.plan.data.konoCare[pid].log.find(e=>e.kind==='find').item
 assert.ok(['pebble','acorn','leaf','feather','shell','clover','pinecone','seaglass','mushroom'].includes(find),'25 minutes finds something common or uncommon, not '+find)
 assert.equal(cloud.users.alice.plan.data.konoCare[pid].log.filter(e=>e.kind==='find').length,1,'one find per session')
 await page.getByRole('button',{name:'Decorate'}).click()
 await page.getByRole('navigation',{name:'Decoration categories'}).getByRole('button',{name:'Finds',exact:true}).click()
 await page.getByText('1 of 12 found.',{exact:false}).waitFor()
 await page.locator('.build-palette').getByLabel('Fallen star, locked. Found on focus sessions of 45+ minutes.').waitFor()
 assert.equal(await page.locator('.build-palette').getByLabel(/Tiny pumpkin/).count(),0,'the October find only shows in October')
 if(process.env.KONO_SHOTS)await page.locator('.build-palette').screenshot({path:process.env.KONO_SHOTS+'/finds-palette.png'})
 await page.locator('.build-palette').getByRole('button',{name:/^Add /}).first().click()
 await waitFor(()=>(cloud.users.alice.plan.data.sanctuaryDecor?.[pid]?.placements??[]).some(p=>p.assetId==='find-'+find),'the find never went on the island')
})

test('Island visitors: after a good week a friend comes to visit (saved once for the day), KONO says so in its line, and it can then live on the island from Decorate › Friends',async({context,page})=>{
 const cloud=fakeCloud(),data=()=>cloud.users.alice.plan.data,pid=data().activeProfileId
 for(const [i,day] of ['2026-09-10','2026-09-11','2026-09-13'].entries())data().tasks.push({id:'week-'+i,profileId:pid,subjectId:'',title:'Week work '+i,due:day,done:true,notes:'',completedAt:day+'T18:00:00.000Z',needsReview:false})
 await page.clock.setFixedTime(new Date('2026-09-15T15:00:00'))
 const art=page.waitForResponse(r=>/\/garden\/friends\/[a-z]+\.webp$/.test(r.url())&&r.status()===200)
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const bar=page.getByRole('region',{name:'KONO today'})
 await bar.getByText(/^\S+ \w+ the \w+ came to visit the island! A good week brings friends\. Find them in Decorate › Friends\.$/).waitFor()
 await bar.locator('img.kono-find-icon').waitFor()
 await art
 if(process.env.KONO_SHOTS){await page.locator('.wb-island').scrollIntoViewIfNeeded();await page.waitForTimeout(1500);await page.locator('.wb-island').screenshot({path:process.env.KONO_SHOTS+'/visitor-island.png'});await bar.screenshot({path:process.env.KONO_SHOTS+'/visitor-bar.png'})}
 await waitFor(()=>(data().konoCare?.[pid]?.log??[]).some(e=>e.id==='visit-2026-09-15'),'the visit never reached the account')
 const friend=data().konoCare[pid].log.find(e=>e.kind==='visit').item
 assert.ok(['cat','duck','frog','bunny','hedgehog','turtle'].includes(friend),'a good week brings an everyday friend, not '+friend)
 // Back again the same day: the same friend, not announced or saved twice.
 await page.reload();await heading(page,'Sanctuary')
 await page.waitForTimeout(1500)
 assert.equal(await bar.getByText(/came to visit the island/).count(),0,'announced once')
 assert.equal(data().konoCare[pid].log.filter(e=>e.kind==='visit').length,1,'saved once')
 await page.getByRole('button',{name:'Decorate'}).click()
 await page.getByRole('navigation',{name:'Decoration categories'}).getByRole('button',{name:'Friends',exact:true}).click()
 await page.getByText('1 of 8 met.',{exact:false}).waitFor()
 await page.locator('.build-palette').getByLabel('Hoot the owl, locked. Visits after a great week (6+ things done, none late).').waitFor()
 if(process.env.KONO_SHOTS)await page.locator('.build-palette').screenshot({path:process.env.KONO_SHOTS+'/friends-palette.png'})
 await page.locator('.build-palette').getByRole('button',{name:/^Add /}).first().click()
 await waitFor(()=>(data().sanctuaryDecor?.[pid]?.placements??[]).some(p=>p.assetId==='friend-'+friend),'the friend never went on the island')
})
test('Planner daily page matches Today’s schedule: the day’s classes as compact cards, the rest under "Also today", ‹ › to step days, and "Back to today" only once you’ve moved away',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.calendarEvents.push({id:'soccer',profileId:pid,title:'Soccer practice',date:'2026-09-28',time:'17:00',kind:'personal',done:false,notes:''})
 await page.clock.setFixedTime(new Date('2026-09-28T08:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const sanctuaryClass=await page.locator('.today-schedule-compact').first().locator('.today-schedule-list > *').first().getAttribute('class')
 await go(page,'Planner');await heading(page,'Planner')
 const day=page.locator('.planner-day-paper')
 await day.getByRole('heading',{name:'Today · Sep 28, 2026'}).waitFor()
 const board=day.getByRole('region',{name:'Plan for Sep 28, 2026'})
 assert.equal(await board.locator('.today-schedule-list > *').first().getAttribute('class'),sanctuaryClass,'the same class card as the Sanctuary')
 await board.getByText('Biology').first().waitFor()
 await board.locator('.tomorrow-extra-list').getByText('Also today').waitFor()
 await board.getByText('Soccer practice').waitFor()
 assert.equal(await day.getByText('Drag an item here',{exact:false}).count(),0)
 const calendar=page.locator('.cozy-calendar-shell')
 assert.equal(await calendar.getByRole('button',{name:'↩ Back to today'}).count(),0,'already on today: no Back to today button')
 await day.getByRole('button',{name:'Next day'}).click()
 await day.getByRole('heading',{name:'Sep 29, 2026'}).waitFor()
 await calendar.getByRole('button',{name:'↩ Back to today'}).click()
 await day.getByRole('heading',{name:'Today · Sep 28, 2026'}).waitFor()
 assert.equal(await calendar.getByRole('button',{name:'↩ Back to today'}).count(),0)
})

test('Planner › Week on a phone: press and hold moves an event, a quick swipe still scrolls, and a tap opens it',async()=>{
 const phone=await freshPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
 try{
  const {context,page}=phone,cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
  plan.settings.parentMode=false
  plan.calendarEvents.push({id:'ph-piano',profileId:pid,date:'2026-09-29',time:'15:00',endTime:'16:00',title:'Piano lesson',kind:'activity',notes:''})
  await page.clock.setFixedTime(new Date('2026-09-28T08:00:00'))
  await signInAs(context,cloud,'alice')
  await page.goto(BASE);await heading(page,'Sanctuary')
  await go(page,'Planner')
  const week=page.getByRole('region',{name:'Week'})
  await page.getByText('Press and hold to move something').waitFor()
  const piano=()=>week.getByRole('button',{name:/^Piano lesson · /})
  const cdp=await context.newCDPSession(page)
  const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:Math.round(x),y:Math.round(y)}]})
  const slot=week.getByRole('button',{name:'Add at 5:00 PM on Sep 29, 2026'})
  await slot.scrollIntoViewIfNeeded();await piano().scrollIntoViewIfNeeded()
  // A quick swipe that starts on the event scrolls; it doesn't move the event.
  let a=await piano().boundingBox()
  await touch('touchStart',a.x+a.width/2,a.y+5)
  for(let i=1;i<=5;i++)await touch('touchMove',a.x+a.width/2,a.y+5+i*15)
  await touch('touchEnd')
  await page.waitForTimeout(300)
  await week.getByRole('button',{name:/^Piano lesson · 3:00 PM–4:00 PM/}).waitFor()
  // Press and hold, then drag: it moves (in 15-minute steps) to 5:00 PM.
  await slot.scrollIntoViewIfNeeded();await piano().scrollIntoViewIfNeeded()
  a=await piano().boundingBox();const b=await slot.boundingBox()
  await touch('touchStart',a.x+a.width/2,a.y+5)
  await page.waitForTimeout(450)
  for(let i=1;i<=8;i++)await touch('touchMove',a.x+a.width/2,a.y+5+(b.y+5-a.y-5)*i/8)
  await touch('touchEnd')
  await week.getByRole('button',{name:/^Piano lesson · 5:00 PM–6:00 PM/}).waitFor()
  await waitFor(()=>cloud.users.alice.plan.data.calendarEvents.find(e=>e.id==='ph-piano')?.time==='17:00','the move reaches the account')
  assert.equal(await page.getByRole('dialog').count(),0,'a drag doesn’t open the editor')
  // A tap opens it to edit.
  await piano().tap()
  await page.getByRole('dialog',{name:'Edit Event'}).getByLabel('Title').waitFor()
  assert.deepEqual(phone.errors,[])
 }finally{await phone.context.close()}
})

test('Phone check-up: on a 375px phone no page scrolls sideways, every tab label fits (Sanctuary reads Home), and the hour column fits "10 AM"',async()=>{
 const phone=await freshPage({viewport:{width:375,height:740},isMobile:true,hasTouch:true})
 try{
  await createPlan(phone.page)
  const p=phone.page
  const nav=p.locator('nav.mobile-nav')
  assert.equal(await nav.locator('button.active small').innerText(),'Home')
  assert.deepEqual(await nav.locator('button small').evaluateAll(s=>s.filter(x=>x.scrollWidth>x.clientWidth).map(x=>x.textContent)),[],'a tab label is cut off')
  for(const name of ['Sanctuary','Planner','Subjects','Notes','K-Quiz','Exams','Settings']){
   await go(p,name)
   await p.waitForTimeout(300)
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' scrolls sideways')
  }
  await go(p,'Planner')
  const hours=p.locator('.week-grid-hours span')
  if(await hours.count())assert.deepEqual(await hours.evaluateAll(s=>s.filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>x.textContent)),[],'an hour label is cut off')
  assert.deepEqual(phone.errors,[])
 }finally{await phone.context.close()}
})

test('offline: the Home Screen app opens with no signal, shows the plan, keeps a new assignment on the device, and uploads it when the signal is back',async()=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,now=new Date()
 const today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0')
 plan.tasks.push({id:'offline-known',profileId:plan.activeProfileId,subjectId:'',title:'Due today (from the account)',due:today,done:false,notes:''})
 const {context,page,errors}=await freshPage({serviceWorkers:'allow'})
 try{
  await signInAs(context,cloud,'alice')
  await page.goto(BASE)
  await heading(page,'Sanctuary')
  // First visit: KONO installs itself for offline use.
  await page.waitForFunction(()=>navigator.serviceWorker?.controller!==null&&navigator.serviceWorker?.controller!==undefined,null,{timeout:20000}).catch(async()=>{await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:20000})})
  await page.waitForFunction(()=>caches.keys().then(keys=>keys.some(k=>k.startsWith('kono-precache-'))),null,{timeout:20000})
  await page.waitForFunction(()=>document.querySelector('.save-status [role=status]')?.textContent?.includes('alice@example.com'))
  // No signal: reopen KONO.
  cloud.offline=true
  await context.setOffline(true)
  // The sign-in has also expired overnight (they last an hour) and can't be refreshed with no signal.
  await context.addInitScript(([key,value])=>localStorage.setItem(key,value),[`sb-${supabaseHost()}-auth-token`,JSON.stringify({...sessionFor(cloud,'alice'),expires_at:Math.floor(Date.now()/1000)-600})])
  const opened=Date.now()
  await page.reload()
  await heading(page,'Sanctuary')
  assert.ok(Date.now()-opened<9000,'opening with no signal took '+(Date.now()-opened)+'ms')
  await page.waitForFunction(()=>document.querySelector('.save-status [role=status]')?.textContent?.includes('alice@example.com'))
  await go(page,'Planner')
  await page.getByText('Due today (from the account)').filter({visible:true}).first().waitFor()
  await addFromMenu(page,'tasks','Written with no signal (e2e)')
  await page.getByText('Written with no signal (e2e)').filter({visible:true}).first().waitFor()
  await page.waitForFunction(()=>/offline|kept on this device|sync pending|unavailable/i.test(document.querySelector('.save-status [role=status]')?.textContent??''))
  assert.ok(!JSON.stringify(cloud.users.alice.plan.data).includes('Written with no signal (e2e)'))
  // Signal back: it reaches the account without doing anything.
  cloud.offline=false
  await context.setOffline(false)
  for(let i=0;i<80&&!JSON.stringify(cloud.users.alice.plan.data).includes('Written with no signal (e2e)');i++)await page.waitForTimeout(250)
  assert.ok(JSON.stringify(cloud.users.alice.plan.data).includes('Written with no signal (e2e)'),'the assignment written offline never reached the account')
  assert.deepEqual(errors,[])
 }finally{await context.close()}
})

async function main(){
 const server=await startServer()
 const onlyArg=process.argv[2]
 let passed=0,run=0
 try{
  browser=await chromium.launch(process.env.PLAYWRIGHT_TEST_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_TEST_EXECUTABLE}:{})
  for(const t of tests){
   if(onlyArg&&!t.name.includes(onlyArg))continue
   run++
   const {context,page,errors}=await freshPage()
   try{
    await t.fn({context,page})
    assert.deepEqual(errors,[],'page errors')
    passed++;console.log('PASS',t.name)
   }catch(error){
    process.exitCode=1;console.error('FAIL',t.name);console.error(error)
    fs.mkdirSync(ARTIFACTS,{recursive:true})
    await page.screenshot({path:path.join(ARTIFACTS,t.name.replace(/[^a-z0-9]+/gi,'-').slice(0,80)+'.png'),fullPage:true}).catch(()=>{})
   }finally{await context.close().catch(()=>{})}
  }
 }finally{
  await browser?.close()
  server.kill()
 }
 console.log(`${passed}/${run} end-to-end flows passed.`)
}
main().then(()=>process.exit(),error=>{console.error(error);process.exit(1)})
