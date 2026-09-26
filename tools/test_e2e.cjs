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
 await page.locator('nav button:visible, nav a:visible').filter({hasText:name}).first().click()
 await heading(page,name)
}
async function settingsTab(page,name){
 const tab=page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name,exact:true})
 await tab.click()
 await page.waitForFunction(n=>[...document.querySelectorAll('nav[aria-label="Settings sections"] button')].some(el=>el.textContent===n&&el.getAttribute('aria-current')==='page'),name)
}
async function addFromMenu(page,type,title,extra){
 await page.getByRole('button',{name:'＋ Add'}).click()
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
 return {users:{alice:named('Alice','alice@example.com'),carol:{...named('Carol','carol@example.com'),admin:true},dave:{email:'dave@example.com',admin:false,plan:{revision:0,data:null}}},me:'alice',calls:[],audit:[],errors:[],feedback:[],nightly:{}}
}
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
async function signInAs(context,cloud,id){
 cloud.me=id
 const ref=supabaseHost(),exp=Math.floor(Date.now()/1000)+3600
 const user={id,aud:'authenticated',role:'authenticated',email:cloud.users[id].email,app_metadata:{},user_metadata:{},created_at:'2026-09-01T00:00:00Z'}
 const session={access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:id,exp,role:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:exp,refresh_token:'fake-refresh',user}
 await context.addInitScript(([key,value])=>localStorage.setItem(key,value),[`sb-${ref}-auth-token`,JSON.stringify(session)])
 await context.route(/\.supabase\.co\//,async route=>{
  const request=route.request(),url=new URL(request.url()),method=request.method(),where=url.pathname
  const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
  if(method==='OPTIONS')return route.fulfill({status:204,headers:cors})
  const body=request.postData()?JSON.parse(request.postData()):null,me=cloud.users[cloud.me]
  cloud.calls.push({method,where,body,as:cloud.me})
  const reply=(json,status=200)=>route.fulfill({status,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(json)})
  const denied=()=>reply({code:'P0001',message:'KONO support access only'},400)
  const saveTo=(owner,expected)=>{if(owner.plan.revision!==expected)return reply({revision:owner.plan.revision,conflict:true});owner.plan={revision:expected+1,data:body.p_data};return reply({revision:owner.plan.revision,conflict:false})}
  switch(where){
   case '/rest/v1/rpc/kono_backup_on_open':return reply({backedUp:true,revision:me.plan.revision})
   case '/rest/v1/rpc/kono_is_admin':return reply(me.admin)
   case '/rest/v1/rpc/kono_save_plan':return saveTo(me,body.p_expected_revision)
   case '/rest/v1/rpc/kono_admin_accounts':return me.admin?reply(Object.entries(cloud.users).map(([id,u])=>({user_id:id,email:u.email,created_at:'2026-09-01T00:00:00Z',last_sign_in_at:'2026-09-24T00:00:00Z',revision:u.plan.revision,updated_at:'2026-09-24T00:00:00Z',profiles:(u.plan.data?.profiles??[]).map(p=>p.name+' · '+p.label).join(', '),username:null}))):denied()
   case '/rest/v1/rpc/kono_admin_get_plan':{if(!me.admin)return denied();const owner=cloud.users[body.p_owner];cloud.audit.push({id:cloud.audit.length+1,account_id:body.p_owner,admin_id:cloud.me,action:'view',revision:owner.plan.revision,created_at:new Date().toISOString()});return reply({revision:owner.plan.revision,data:owner.plan.data})}
   case '/rest/v1/rpc/kono_admin_save_plan':{if(!me.admin)return denied();const result=saveTo(cloud.users[body.p_owner],body.p_expected_revision);cloud.audit.push({id:cloud.audit.length+1,account_id:body.p_owner,admin_id:cloud.me,action:'edit',revision:null,created_at:new Date().toISOString()});return result}
   case '/rest/v1/kono_plans':return reply([{revision:me.plan.revision,data:me.plan.data}])
   case '/rest/v1/kono_admin_audit':return reply(me.admin?cloud.audit:cloud.audit.filter(a=>a.account_id===cloud.me))
   case '/rest/v1/kono_shared_snapshots':return reply([],201)
   case '/rest/v1/kono_plan_nightly':{const n=cloud.nightly[cloud.me];return reply(n?[n]:[])}
   case '/rest/v1/rpc/kono_admin_get_nightly':{if(!me.admin)return denied();return reply(cloud.nightly[body.p_owner]??null)}
   case '/rest/v1/kono_client_errors':if(method==='POST'){const rows=Array.isArray(body)?body:[body];for(const r of rows)cloud.errors.push({id:cloud.errors.length+1,user_id:cloud.me,created_at:new Date().toISOString(),...r});return reply([],201)}return reply(me.admin?[...cloud.errors].reverse():[])
   case '/rest/v1/kono_feedback':{if(method==='POST'){const rows=Array.isArray(body)?body:[body];for(const r of rows)cloud.feedback.push({id:cloud.feedback.length+1,user_id:cloud.me,created_at:new Date().toISOString(),...r});return reply([],201)}if(method==='DELETE'){const id=Number((url.searchParams.get('id')??'').replace('eq.',''));if(me.admin)cloud.feedback=cloud.feedback.filter(f=>f.id!==id);return reply([],204)}return reply(me.admin?[...cloud.feedback].reverse():[])}
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
 await ready()
 // The canvas has real artwork on it (a blank canvas encodes to a tiny image).
 await page.waitForFunction(()=>{const c=document.querySelector('.sanctuary-viewport canvas');return !!c&&c.width>100&&c.toDataURL('image/png').length>60000},null,{timeout:20000})
 assert.ok(loaded.some(([path,status])=>/terrace-23\.0\/\w+\.webp$/.test(path)&&status===200),'the island map did not load')
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
 const other=phase==='morning'?'evening':'morning'
 const mapLoaded=page.waitForResponse(r=>r.url().endsWith(`/terrace-23.0/${other}.webp`)&&r.status()===200,{timeout:20000})
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

test('Calendar import: a Google/Apple calendar file or link adds weekly repeats and events, and importing again adds nothing new',async({context,page})=>{
 const requests=[]
 await context.route(BASE+'api/calendar-feed',route=>{requests.push(route.request().postDataJSON());return route.fulfill({status:200,headers:{'content-type':'text/calendar'},body:sampleIcs()})})
 await createPlan(page)
 await go(page,'Settings')
 await settingsTab(page,'Import & export')
 await page.getByText('Import from Google Calendar, Apple Calendar, Canvas or Classroom').click()
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

 await settingsTab(page,'Schedules')
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
 const d=new Date(),ymd=x=>x.getFullYear()+String(x.getMonth()+1).padStart(2,'0')+String(x.getDate()).padStart(2,'0'),inDays=n=>{const x=new Date(d);x.setDate(d.getDate()+n);return ymd(x)}
 const feed=['BEGIN:VCALENDAR','X-WR-CALNAME:Canvas','BEGIN:VEVENT','UID:a1','SUMMARY:Essay 1 [ENGL 1010]','DTSTART;VALUE=DATE:'+inDays(4),'URL:https://canvas.bc.edu/courses/1/assignments/2','END:VEVENT','BEGIN:VEVENT','UID:q1','SUMMARY:Chapter 3 quiz [BIOL 1100]','DTSTART;VALUE=DATE:'+inDays(6),'URL:https://canvas.bc.edu/courses/3/quizzes/4','END:VEVENT','END:VCALENDAR'].join('\r\n')
 await context.route(BASE+'api/calendar-feed',route=>route.fulfill({status:200,headers:{'content-type':'text/calendar'},body:feed}))
 await createPlan(page)
 await go(page,'Settings')
 await settingsTab(page,'Import & export')
 await page.getByText('Import from Google Calendar, Apple Calendar, Canvas or Classroom').click()
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
 await page.getByLabel('Class timetable file').setInputFiles(proseSchedulePdf())
 await page.getByRole('button',{name:'Read timetable & find classes'}).click()
 await page.getByText(/couldn’t find classes in this layout/).waitFor()
 assert.equal(await page.getByText('Set up the AI helper (a free Gemini key works)').count(),0,'no key setup is asked for')
 await page.getByRole('button',{name:'Read with AI helper'}).click()
 await page.getByText('Your AI helper found 2 classes.',{exact:false}).waitFor()
 assert.equal(posts.length,1)
 assert.match(posts[0].auth,/^Bearer .+\..+\..+/,'the request carries the student’s sign-in')
 assert.match(posts[0].body.prompt,/Marine Biology with Dr\. Lee/)
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

 await page.getByLabel('Class timetable file').setInputFiles(proseSchedulePdf())
 await page.getByRole('button',{name:'Read timetable & find classes'}).click()
 await page.getByText(/couldn’t find classes in this layout/).waitFor()
 for(let i=0;i<20&&!cloud.errors.length;i++)await page.waitForTimeout(250)
 const logged=cloud.errors.find(e=>e.message==='Schedule upload found no classes (weekly college)')
 assert.ok(logged,'the unreadable layout was not reported to KONO support')
 assert.match(logged.detail,/File: PDF · text read: \d+ characters · column headings found: no/)
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
 await page.getByLabel('Class timetable file').setInputFiles(classTablePdf())
 await page.getByRole('button',{name:'Read timetable & find classes'}).click()
 await page.getByText('Found 5 classes and 0 schedule blocks.',{exact:false}).waitFor()
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

 // The Import & export PDF importer offers the semester for weekly classes; re-adding them skips duplicates.
 await settingsTab(page,'Import & export')
 await page.getByText('Import assignments or dated events from a PDF').click()
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
