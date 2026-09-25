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
 await page.getByText('Read chapter 3 (e2e)').first().waitFor()
 await flushSave(page,'Read chapter 3 (e2e)')
 await page.reload()
 await go(page,'Planner')
 await page.getByText('Read chapter 3 (e2e)').first().waitFor()
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
 return {users:{alice:named('Alice','alice@example.com'),carol:{...named('Carol','carol@example.com'),admin:true}},me:'alice',calls:[],audit:[]}
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
   case '/rest/v1/rpc/kono_admin_accounts':return me.admin?reply(Object.entries(cloud.users).map(([id,u])=>({user_id:id,email:u.email,created_at:'2026-09-01T00:00:00Z',last_sign_in_at:'2026-09-24T00:00:00Z',revision:u.plan.revision,updated_at:'2026-09-24T00:00:00Z',profiles:u.plan.data.profiles.map(p=>p.name+' · '+p.label).join(', '),username:null}))):denied()
   case '/rest/v1/rpc/kono_admin_get_plan':{if(!me.admin)return denied();const owner=cloud.users[body.p_owner];cloud.audit.push({id:cloud.audit.length+1,account_id:body.p_owner,admin_id:cloud.me,action:'view',revision:owner.plan.revision,created_at:new Date().toISOString()});return reply({revision:owner.plan.revision,data:owner.plan.data})}
   case '/rest/v1/rpc/kono_admin_save_plan':{if(!me.admin)return denied();const result=saveTo(cloud.users[body.p_owner],body.p_expected_revision);cloud.audit.push({id:cloud.audit.length+1,account_id:body.p_owner,admin_id:cloud.me,action:'edit',revision:null,created_at:new Date().toISOString()});return result}
   case '/rest/v1/kono_plans':return reply([{revision:me.plan.revision,data:me.plan.data}])
   case '/rest/v1/kono_admin_audit':return reply(me.admin?cloud.audit:cloud.audit.filter(a=>a.account_id===cloud.me))
   case '/rest/v1/kono_shared_snapshots':return reply([],201)
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
  await other.page.getByText('Saved to my account (e2e)').first().waitFor()
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
