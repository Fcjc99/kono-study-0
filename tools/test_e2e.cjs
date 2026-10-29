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
 // KONO_VIDEO=dir records each flow as a video there (to check animations by eye).
 const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:true,viewport:{width:1280,height:900},...(process.env.KONO_VIDEO?{recordVideo:{dir:process.env.KONO_VIDEO,size:{width:1280,height:900}}}:{}),...options})
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
 // Phones show the everyday pages in the bottom bar; the rest are under More.
 // With the island turned off, the Sanctuary tab reads "Home" on every screen.
 const text=name==='Sanctuary'?/Sanctuary|Home/:name
 const tab=page.locator('nav button:visible, nav a:visible').filter({hasText:text}).or(page.locator(`nav button:visible[aria-label="${name}"]`)).first()
 if(!await tab.count()&&await page.locator('nav button:visible[aria-label="More"]').count()){await page.locator('nav button:visible[aria-label="More"]').click();await page.getByRole('dialog',{name:'More'}).getByRole('button',{name,exact:true}).click()}
 else await tab.click()
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
 await chooser.getByRole('group',{name:'Add type'}).getByRole('button',{name:{tasks:'Homework',exams:'Test or exam',notes:'Study note',lesson:'Lesson'}[type]}).click()
 const editor=page.locator('dialog[open]')
 await editor.getByLabel('Title').fill(title)
 if(extra)await extra(editor)
 await editor.getByRole('button',{name:'Save',exact:true}).click()
 await editor.waitFor({state:'detached'}).catch(()=>{})
}
/** Waits until the debounced save has reached IndexedDB, so a reload reads what the test just did. */
// Waits until the saved plan on this device contains `text` (or, with gone=true, no longer does).
async function flushSave(page,text,gone=false){
 await page.waitForFunction(needle=>new Promise(resolve=>{const request=indexedDB.open('kono-recovery-and-sync',1);request.onsuccess=()=>{const db=request.result,get=db.transaction('plans').objectStore('plans').get('device');get.onsuccess=()=>{db.close();resolve(JSON.stringify(get.result??'').includes(needle[0])!==needle[1])};get.onerror=()=>{db.close();resolve(false)}};request.onerror=()=>resolve(false)}),[text,gone],{timeout:10000,polling:250})
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

test('Today in time order, Settings search and search filters',async({page})=>{
 await createPlan(page)
 await addFromMenu(page,'tasks','First thing (e2e)')
 await addFromMenu(page,'tasks','Second thing (e2e)')
 await go(page,'Sanctuary')
 // Also today is in time order, with no handles to move things around.
 await page.locator('.tomorrow-extra-list').getByText('Second thing (e2e)').waitFor()
 assert.equal(await page.locator('.tomorrow-extra-list .reorder-handle').count(),0,'Today and Tomorrow can’t be rearranged by hand')
 // Settings search: "dark" finds Dark mode and opens Look & feel.
 await go(page,'Settings')
 await page.getByLabel('Search settings').fill('dark')
 await page.getByRole('list',{name:'Matching settings'}).getByRole('button',{name:/Dark mode/}).click()
 await page.getByRole('group',{name:'Dark mode'}).waitFor()
 // Search: "This week" lists this week's assignments under their own heading.
 await page.getByRole('button',{name:'Search'}).first().click()
 const search=page.getByRole('dialog',{name:'Search your work'})
 await search.getByRole('button',{name:'This week'}).click()
 await search.getByRole('group',{name:'Assignments'}).getByText('First thing (e2e)').waitFor()
})

test('Island & KONO: a plan can turn the island off or keep just KONO, and Simple view trims the pages',async({page})=>{
 await createPlan(page)
 const choose=async label=>{await go(page,'Settings');await settingsTab(page,'Look & feel');await page.getByRole('group',{name:'Island and KONO'}).getByRole('button',{name:new RegExp('^'+label)}).click()}
 // Off: a plain planner, no island and no KONO bar; Home still has your day.
 await choose('Off')
 await go(page,'Sanctuary')
 await page.getByRole('region',{name:'Your day'}).waitFor()
 assert.equal(await page.locator('.wb-island').count(),0,'no island')
 assert.equal(await page.getByRole('region',{name:'KONO today'}).count(),0,'no KONO bar')
 // Just KONO: KONO's card is back, still no island.
 await choose('Just KONO')
 await go(page,'Sanctuary')
 await page.getByRole('region',{name:'KONO today'}).waitFor()
 assert.equal(await page.locator('.wb-island').count(),0,'still no island')
 // Back to the whole island, and it stays after a reload.
 await choose('Island and KONO')
 await flushSave(page,'"island":',true)
 await page.reload();await go(page,'Sanctuary')
 await page.locator('.wb-island').waitFor()
 // Simple view: only Home, Planner and Notes (and Settings) in the tabs.
 await go(page,'Settings');await settingsTab(page,'Look & feel')
 await page.getByRole('checkbox',{name:/Simple view/}).check()
 await page.waitForFunction(()=>document.querySelector('.workbench')?.classList.contains('is-simple'))
 assert.equal(await page.locator('nav button:visible, nav a:visible').filter({hasText:'Subjects'}).count(),0,'Subjects is tucked away')
 await page.getByRole('checkbox',{name:/Simple view/}).uncheck()
})

test('a study note can be moved to Trash and restored',async({page})=>{
 await createPlan(page)
 await addFromMenu(page,'notes','Mitochondria facts (e2e)')
 await go(page,'Notes')
 const note=page.locator('article.kono-sticky').filter({hasText:'Mitochondria facts (e2e)'})
 await note.waitFor()
 // No "Are you sure?": it goes to Trash with an Undo bar, and Undo brings it straight back.
 await note.getByRole('button',{name:'Delete note'}).click()
 const toast=page.locator('.undo-toast').filter({hasText:'Moved “Mitochondria facts (e2e)” to Trash.'})
 await toast.getByRole('button',{name:'Undo'}).click()
 await note.waitFor()
 await note.getByRole('button',{name:'Delete note'}).click()
 await note.waitFor({state:'detached'})
 await headerMenu(page,'Trash')
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
 assert.equal(await choices.getByRole('button').count(),8)
 const opens={'My school schedule':'School calendar & rotation','My college classes':'College semester','A calendar link':'Or paste a calendar link','Photos or screenshots':null,'A PDF of dates':'Import PDF','A weekly activity':null,'My work schedule':'Add my shifts','A sports season':null}
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
 await page.locator('details.planner-more').waitFor()
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
 await page.getByRole('button',{name:/Clean/}).first().click()
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
 await page.getByRole('button',{name:/Clean/}).first().click()
 // Folded away until it's opened (most people never need it).
 await page.locator('summary').filter({hasText:'Team colors'}).click()
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
  assert.equal(await p.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'3 days'}).getAttribute('aria-pressed'),'true')
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
 // The fixture's parents also study, so the study pages and tools (Exams, Focus, the catch-up card) stay on;
 // the family-only Home has its own flow (familyStudyTabs=false).
 const named=(name,email)=>{const d=fixture();d.profiles[0].name=name;d.settings.familyStudyTabs=true;return {email,admin:false,plan:{revision:3,data:d}}}
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

test('K-Quiz Play: a study set as a game, right answers earn KONO coins, a wrong one costs a heart, and the round ends with a score',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.settings.familyStudyTabs=true
 const mcq=(id,prompt,choices,correctIndex)=>({id,type:'mcq',prompt,choices,correctIndex})
 plan.kquizSets=[{id:'set-play',profileId:pid,subjectId:'',title:'Cells (play)',createdAt:'2026-09-20T00:00:00Z',practiceTest:{questions:[mcq('p1','Powerhouse of the cell?',['Mitochondria','Nucleus','Ribosome','Golgi'],0),mcq('p2','Holds the DNA?',['Vacuole','Nucleus','Membrane','Cytoplasm'],1),mcq('p3','Makes proteins?',['Lysosome','Ribosome','Wall','Nucleolus'],1)]}}]
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await mainHeading(page).waitFor()
 await go(page,'K-Quiz')
 await page.getByRole('button',{name:/^Play \d+ questions/}).click()
 const game=page.getByRole('dialog',{name:'Play: Cells (play)'})
 await game.waitFor()
 const answer=async right=>{const prompt=await game.locator('.kq-play-prompt').innerText(),key={'Powerhouse of the cell?':'Mitochondria','Holds the DNA?':'Nucleus','Makes proteins?':'Ribosome'}[prompt]
  const tiles=game.getByRole('group',{name:'Answers'}).getByRole('button')
  if(right)await tiles.filter({hasText:key}).click();else await tiles.filter({hasNotText:key}).first().click()
  await game.getByRole('status').waitFor()
  return game.getByRole('status').innerText()}
 assert.match(await answer(true),/\+2 🪙/)
 await game.getByRole('button',{name:'Continue'}).click()
 assert.match(await answer(false),/Not quite[\s\S]*Answer:/)
 assert.equal(await game.getByLabel('2 hearts left').count(),1,'a wrong answer costs a heart')
 await game.getByRole('button',{name:'Continue'}).click()
 await answer(true);await game.getByRole('button',{name:'Continue'}).click()
 const end=game.getByRole('region',{name:'Round over'});await end.waitFor()
 assert.match(await end.innerText(),/2\/3[\s\S]*4[\s\S]*coins earned/)
 assert.match(await end.innerText(),/Look again at 1 question/)
 await waitFor(()=>(cloud.users.alice.plan.data.konoCare?.[pid]?.log??[]).filter(e=>e.item==='game:quiz').reduce((n,e)=>n+e.n,0)===4,'the coins reach the account')
 await end.getByRole('button',{name:'Done'}).click()
 await game.waitFor({state:'detached'})
})

test('keyboard: K-Quiz practice questions and flashcards keep focus inside, close with Escape, and return focus',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data
 plan.settings.familyStudyTabs=true // alice has kids: a family plan shows the study pages only when asked
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
 // Mid-September: each time of day has its own map (in October the island is one Halloween night picture).
 await page.clock.setFixedTime(new Date('2026-09-16T15:00:00'))
 await createPlan(page)
 // The island loads once it's on screen (for a new plan it's just below Getting started): islandLoaded
 // keeps it in view while it does.
 const ready=()=>islandLoaded(page)
 await ready()
 // The canvas has real artwork on it (a blank canvas encodes to a tiny image).
 await page.waitForFunction(()=>{const c=document.querySelector('.sanctuary-viewport canvas');return !!c&&c.width>100&&c.toDataURL('image/png').length>60000},null,{timeout:20000})
 assert.ok(loaded.some(([path,status])=>/terrace-23\.0\/((halloween-v2|winter|spring|semester)\/)?\w+\.webp$/.test(path)&&status===200),'the island map did not load (whatever the season)')
 assert.ok(loaded.every(([,status])=>status===200),'a Sanctuary image failed to load: '+JSON.stringify(loaded.filter(([,st])=>st!==200)))
 // A pinch (here a trackpad pinch: Ctrl + scroll) zooms in, Reset zoom puts it back, and pinching out past
 // the whole island pulls back to the world map.
 await page.locator('.wb-sanctuary-zoom-wrap').scrollIntoViewIfNeeded()
 const stage=await page.locator('.wb-sanctuary-zoom-wrap').boundingBox()
 await page.mouse.move(stage.x+stage.width/2,stage.y+Math.min(stage.height/2,120))
 await page.keyboard.down('Control');await page.mouse.wheel(0,-120);await page.keyboard.up('Control')
 await page.getByRole('button',{name:'Reset zoom'}).click()
 await page.getByRole('button',{name:'Reset zoom'}).waitFor({state:'detached'})
 await page.keyboard.down('Control');for(let k=0;k<4;k++)await page.mouse.wheel(0,80);await page.keyboard.up('Control')
 const world=page.getByRole('dialog',{name:'World map'})
 await world.waitFor()
 await world.getByRole('button',{name:'Close dialog'}).click()
 await page.locator('.wb-scene-expand').click()
 await page.locator('.wb-island.is-expanded').waitFor()
 await page.locator('.wb-scene-expand').click()
 await page.locator('.wb-island.is-expanded').waitFor({state:'detached'})
 const phase=await page.getByLabel('Sanctuary time').inputValue()
 // A time whose map isn't loaded yet: near dawn or dusk the island has already loaded the next phase's map
 // to blend into, so switching to it wouldn't fetch anything (which made this test depend on the clock).
 const map=p=>new RegExp(`/terrace-23\\.0/${p}\\.webp$`)
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

test('Welcome tour: a new plan gets three steps (the island, KONO, adding work), the last opens Add, and it stays done after a reload',async({page})=>{
 await createPlan(page)
 const tour=page.getByRole('region',{name:'Welcome to KONO'})
 await tour.getByText('This is your island').waitFor()
 await tour.getByRole('button',{name:'Okay'}).click()
 await tour.getByText('Meet KONO').waitFor()
 assert.equal(await page.locator('.kono-bar[data-tour-focus]').count(),1,'KONO’s bar is lit up on the KONO step')
 await tour.getByRole('button',{name:'Okay'}).click()
 await tour.getByRole('button',{name:'＋ Add my first assignment'}).click()
 await page.getByRole('dialog',{name:'Add to your plan'}).waitFor()
 assert.equal(await tour.count(),0,'the tour closes once it hands over to Add')
 await page.keyboard.press('Escape')
 await page.reload();await heading(page,'Sanctuary')
 await page.locator('.kono-bar').waitFor()
 assert.equal(await page.getByRole('region',{name:'Welcome to KONO'}).count(),0,'the tour doesn’t come back')
})

test('Getting started: a new plan shows a Set up KONO chip that opens three steps; each opens the right place, ticks off when done or skipped, and Hide keeps it hidden',async({page})=>{
 await createPlan(page)
 const card=page.getByRole('region',{name:'Getting started'})
 // Home shows a small chip with the progress; it opens the steps.
 await page.getByRole('button',{name:'Set up KONO · 0/3'}).waitFor()
 assert.equal(await card.count(),0,'the steps stay out of the way until asked for')
 const allSteps=async()=>{if(!await card.isVisible())await page.getByRole('button',{name:/^Set up KONO · \d\/3$/}).click();await card.getByRole('heading',{name:'Set up KONO in a few minutes'}).waitFor()}
 await allSteps()
 await card.getByText('0 of 3 done').waitFor()
 // Add my school opens Add to my calendar at the school setup.
 await card.getByRole('button',{name:'Add my school',exact:true}).click()
 await page.getByRole('region',{name:'Add to my calendar'}).getByRole('heading',{name:/My school schedule/}).waitFor()
 await go(page,'Sanctuary')
 await allSteps()
 await card.getByRole('button',{name:'Skip: Add your school or classes'}).click()
 await card.getByText('1 of 3 done').waitFor()
 // Linking a calendar ticks off step 2 by itself.
 await card.getByRole('button',{name:'Link a calendar',exact:true}).click()
 await page.getByLabel('Calendar file (.ics)').setInputFiles({name:'sam.ics',mimeType:'text/calendar',buffer:Buffer.from(sampleIcs())})
 await page.locator('.calendar-import-review').getByRole('button',{name:'Add 2 to my plan'}).click()
 await page.getByText(/^2 added\./).waitFor()
 await go(page,'Sanctuary')
 await allSteps()
 await card.getByText('2 of 3 done').waitFor()
 assert.match(await card.innerText(),/Link Canvas or your Google calendar\s*Done/)
 // Turn on reminders goes to Settings › Notifications.
 await card.getByRole('button',{name:'Turn on reminders',exact:true}).click()
 await heading(page,'Settings')
 await page.getByText('Get a notification even when KONO is closed',{exact:false}).waitFor()
 await go(page,'Sanctuary')
 await allSteps()
 await card.getByRole('button',{name:'Hide'}).click()
 await card.waitFor({state:'detached'})
 await page.reload();await heading(page,'Sanctuary')
 assert.equal(await page.getByRole('button',{name:/^Set up KONO/}).count(),0,'stays hidden after a reload')
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

test('Canvas two-way: connecting brings in the to-do list, a tick in KONO is sent to Canvas, and the token stays on this device',async({context,page})=>{
 const calls=[],at=n=>{const x=new Date();x.setDate(x.getDate()+n);x.setHours(15,0,0,0);return x.toISOString()}
 await context.route(BASE+'api/canvas',route=>{const body=route.request().postDataJSON();calls.push(body)
  if(body.action==='mark')return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({name:'Jo',items:[
   {type:'assignment',id:'11',title:'Lab report',at:at(-1),done:false,course:'BIOL 1100',url:'https://bc.instructure.com/courses/1/assignments/11'},
   {type:'quiz',id:'12',title:'Cell quiz',at:at(3),done:false,course:'BIOL 1100'},
   {type:'assignment',id:'13',title:'Reading notes',at:at(-2),done:true,course:'ENGL 1010'}]})})})
 await createPlan(page)
 await addToCalendar(page,'A calendar link')
 const panel=page.getByRole('region',{name:'Canvas, two-way'})
 await panel.getByLabel('Your school’s Canvas address').fill('bc.instructure.com')
 await panel.getByLabel('Canvas access token').fill('1234~abcdefghijklmnopqrstuvwxyz0123')
 await panel.getByRole('button',{name:'Connect Canvas'}).click()
 await panel.getByText('Connected as Jo',{exact:false}).waitFor()
 await panel.getByRole('status').getByText('3 new.',{exact:true}).waitFor()
 assert.equal(calls[0].base,'bc.instructure.com');assert.equal(calls[0].action,'items')
 await flushSave(page,'Cell quiz')
 const stored=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('kono-canvas:')).length)
 assert.equal(stored,1,'the connection is kept on this device')
 const saved=await page.evaluate(()=>new Promise(resolve=>{const request=indexedDB.open('kono-recovery-and-sync',1);request.onsuccess=()=>{const db=request.result,get=db.transaction('plans').objectStore('plans').get('device');get.onsuccess=()=>{db.close();resolve(JSON.stringify(get.result??null))}}}))
 assert.ok(!saved.includes('abcdefghijklmnopqrstuvwxyz'),'the token is never in the saved plan')
 assert.match(saved,/"canvasRef":"quiz:12"/)
 assert.match(saved,/"title":"Reading notes"[^}]*"done":true|"done":true[^}]*"title":"Reading notes"/,'done in Canvas comes in as done')
 // Ticking the overdue lab report here ticks it in Canvas.
 await go(page,'Sanctuary')
 await page.getByRole('region',{name:'Overdue'}).getByRole('button',{name:'Done: Lab report'}).click()
 for(let k=0;k<60&&!calls.some(c=>c.action==='mark');k++)await page.waitForTimeout(250)
 assert.ok(calls.some(c=>c.action==='mark'&&c.type==='assignment'&&c.id==='11'&&c.done===true),'the tick went to Canvas')
 assert.equal(calls.filter(c=>c.action==='mark').length,1,'only the changed item is sent')
})

test('Phone app: inside the iPhone/Android app the widgets get the plan, reminders are scheduled on the phone, and a focus session shows on the lock screen',async({context,page})=>{
 // A stand-in for the app's native layer (Capacitor): records every plugin call.
 await context.addInitScript(()=>{
  const calls=window.__native=[],plugin=name=>new Proxy({},{get:(_,method)=>async options=>{calls.push({plugin:name,method,options:options===undefined?undefined:JSON.parse(JSON.stringify(options))})
   if(method==='checkPermissions')return {display:'prompt'};if(method==='requestPermissions')return {display:'granted'};if(method==='getPending')return {notifications:[{id:7}]};return {}}})
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'ios',Plugins:{KonoWidget:plugin('KonoWidget'),LocalNotifications:plugin('LocalNotifications')}}
 })
 await createPlan(page)
 const calls=()=>page.evaluate(()=>window.__native)
 const until=async(check,message)=>{for(let k=0;k<80;k++){if(check(await calls()))return;await page.waitForTimeout(250)}assert.fail(message+': '+JSON.stringify(await calls()).slice(0,600))}
 await until(c=>c.some(x=>x.method==='setSnapshot'),'the widgets got the plan')
 const snap=JSON.parse((await calls()).find(x=>x.method==='setSnapshot').options.json)
 assert.ok(snap.updated&&snap.kono&&typeof snap.kono.full==='number'&&Array.isArray(snap.next)&&snap.today,'the widget data has next up, today and KONO')
 await until(c=>c.some(x=>x.method==='checkPermissions'),'reminders checked permission')
 // Turning on a timer shows it on the lock screen; pausing ends it.
 const outer=page.locator('details.sanctuary-focus')
 await outer.locator(':scope > summary').click()
 const focus=outer.locator('details.focus-session')
 await focus.locator(':scope > summary').click()
 await focus.getByLabel('Minutes').fill('25');await focus.getByLabel('Seconds').fill('0')
 await focus.getByRole('button',{name:'Start timer'}).click()
 await until(c=>c.some(x=>x.method==='startFocus'),'the focus session went to the lock screen')
 const start=(await calls()).find(x=>x.method==='startFocus').options
 assert.ok(start.endsAt>Date.now()+24*60*1000&&start.endsAt<Date.now()+26*60*1000,'it ends when the timer does');assert.ok(start.title)
 const before=(await calls()).filter(x=>x.method==='endFocus').length
 await focus.getByRole('button',{name:/^Pause/}).first().click()
 await until(c=>c.filter(x=>x.method==='endFocus').length>before,'pausing ended the lock-screen timer')
})

test('Phone app: on the web, KONO never touches the native bridge',async({page})=>{
 await createPlan(page)
 await page.waitForTimeout(2500)
 assert.equal(await page.evaluate(()=>typeof window.Capacitor),'undefined')
 const names=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/nativeBridge|pushReminders/.test(n)))
 assert.deepEqual(names,[],'the phone-app code isn’t downloaded on the web')
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
 await page.locator('summary').filter({hasText:'AI helper'}).click()
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

test('Round 62: KONO blast’s face blocks: choose a photo, drag and zoom it into the square, and the blocks show it (kept on this device); Remove goes back to plain blocks',async({context,page})=>{
 const cloud=fakeCloud()
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await page.getByRole('navigation',{name:'Sanctuary view'}).getByRole('button',{name:'Arcade'}).click()
 const town=page.getByRole('dialog',{name:'KONO Town'})
 await town.getByRole('button',{name:/KONO blast/}).click()
 const blast=page.getByRole('dialog',{name:'🧱 KONO blast'}),card=blast.getByRole('region',{name:'Start'})
 const faces=card.getByRole('group',{name:'Face blocks'})
 await faces.getByRole('button',{name:'🖼️ Choose a photo'}).waitFor()
 await faces.getByLabel('Photo for the blocks',{exact:true}).setInputFiles(path.join(ROOT,'public/garden/kono/happy.png'))
 await faces.getByText('Drag your face into the square and zoom to fit.').waitFor()
 // Drag it a little and zoom in.
 const crop=faces.locator('.blast-face-crop'),cb=await crop.boundingBox()
 await page.mouse.move(cb.x+100,cb.y+100);await page.mouse.down();await page.mouse.move(cb.x+120,cb.y+110,{steps:4});await page.mouse.up()
 await faces.getByLabel('Zoom').fill('1.6')
 if(process.env.KONO_SHOTS)await card.screenshot({path:process.env.KONO_SHOTS+'/blast-face-crop.png'})
 await faces.getByRole('button',{name:'Use this face'}).click()
 await faces.getByText('Face blocks on').waitFor()
 assert.match(await page.evaluate(()=>localStorage.getItem('kono-blast-face')??''),/^data:image\/jpeg;base64,/,'the cropped face is kept on this device')
 assert.ok(!JSON.stringify(cloud.users.alice.plan.data).includes('data:image/jpeg'),'the photo never goes to the account')
 await startGame(page,'🧱 KONO blast')
 await blast.locator('.blast.has-face').waitFor()
 const bg=await blast.locator('.blast-mini span').first().evaluate(el=>getComputedStyle(el).backgroundImage)
 assert.match(bg,/data:image\/jpeg/,'the pieces show the face')
 if(process.env.KONO_SHOTS)await blast.screenshot({path:process.env.KONO_SHOTS+'/blast-face.png'})
 // Leave, and Remove on the start card goes back to plain blocks.
 await blast.getByRole('button',{name:'✕ Leave'}).click();await blast.waitFor({state:'detached'})
 await town.getByRole('button',{name:/KONO blast/}).click()
 await page.getByRole('dialog',{name:'🧱 KONO blast'}).getByRole('group',{name:'Face blocks'}).getByRole('button',{name:'Remove'}).click()
 assert.equal(await page.evaluate(()=>localStorage.getItem('kono-blast-face')),null)
 await startGame(page,'🧱 KONO blast')
 assert.equal(await page.getByRole('dialog',{name:'🧱 KONO blast'}).locator('.blast.has-face').count(),0)
})

test('Round 61: Planner › Week: hold (or right-click) something for a small menu: Edit, Move (then tap the new time) and Delete; hold an empty time and drag to draw how long a new event runs',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.settings.parentMode=false
 plan.calendarEvents.push(
  {id:'m-dentist',profileId:pid,date:'2026-09-30',time:'09:00',endTime:'10:00',title:'Dentist appointment',kind:'appointment',notes:''},
  {id:'m-sports',profileId:pid,date:'2026-10-01',time:'17:00',endTime:'18:30',title:'Soccer practice',kind:'sports',notes:''})
 await page.clock.setFixedTime(new Date('2026-09-28T08:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await go(page,'Planner')
 const week=page.getByRole('region',{name:'Week'})
 const soccer=week.getByRole('button',{name:/^Soccer practice · 5:00 PM–6:30 PM/})
 await soccer.waitFor()
 // Right-click: the menu. Edit opens the editor.
 await soccer.click({button:'right'})
 let menu=page.getByRole('menu',{name:'Soccer practice'})
 if(process.env.KONO_SHOTS){await page.waitForTimeout(300);await page.screenshot({path:process.env.KONO_SHOTS+'/week-menu.png'})}
 await menu.getByRole('menuitem',{name:'✏️ Edit'}).click()
 const editor=page.getByRole('dialog',{name:'Edit event'})
 assert.equal(await editor.getByLabel('Title').inputValue(),'Soccer practice')
 await editor.getByRole('button',{name:'Close dialog'}).click();await editor.waitFor({state:'detached'})
 // A finger: hold and let go without moving, and the menu opens. Move, then tap the new time: 9:30 AM on Oct 2.
 const sb=await soccer.boundingBox()
 const at={clientX:sb.x+sb.width/2,clientY:sb.y+8,pointerId:7,pointerType:'touch',isPrimary:true,button:0,buttons:1}
 await soccer.dispatchEvent('pointerdown',at);await page.waitForTimeout(450);await soccer.dispatchEvent('pointerup',{...at,buttons:0})
 menu=page.getByRole('menu',{name:'Soccer practice'})
 // Its time nudges: 15 minutes later, then 15 longer (the menu stays open and follows it).
 await menu.getByRole('menuitem',{name:'15 minutes later'}).click()
 await week.getByRole('button',{name:/^Soccer practice · 5:15 PM–6:45 PM/}).waitFor()
 await menu.getByRole('menuitem',{name:'15 minutes longer'}).click()
 await week.getByRole('button',{name:/^Soccer practice · 5:15 PM–7:00 PM/}).waitFor()
 await waitFor(()=>{const e=cloud.users.alice.plan.data.calendarEvents.find(x=>x.id==='m-sports');return e?.time==='17:15'&&e.endTime==='19:00'},'the nudged time reaches the account')
 await menu.getByRole('menuitem',{name:/^↕️ Move/}).click()
 await week.getByRole('status').getByText('Tap a new time for “Soccer practice”').waitFor()
 const slot=week.getByRole('button',{name:'Move to 9:00 AM on Oct 2, 2026'})
 await slot.scrollIntoViewIfNeeded();await slot.click({position:{x:12,y:24}})
 await week.getByRole('button',{name:/^Soccer practice · 9:30 AM–11:15 AM · Oct 2, 2026/}).waitFor()
 await waitFor(()=>{const e=cloud.users.alice.plan.data.calendarEvents.find(x=>x.id==='m-sports');return e?.date==='2026-10-02'&&e.time==='09:30'&&e.endTime==='11:15'},'the moved event reaches the account')
 // A mouse held still opens the menu too. Delete sends it to Trash (with Undo).
 const dentist=week.getByRole('button',{name:/^Dentist appointment · 9:00 AM/})
 await dentist.scrollIntoViewIfNeeded()
 const db=await dentist.boundingBox()
 await page.mouse.move(db.x+db.width/2,db.y+8);await page.mouse.down();await page.waitForTimeout(650);await page.mouse.up()
 await page.getByRole('menu',{name:'Dentist appointment'}).getByRole('menuitem',{name:'🗑 Delete'}).click()
 await dentist.waitFor({state:'detached'})
 await page.getByText('Moved “Dentist appointment” to Trash.',{exact:false}).first().waitFor()
 await waitFor(()=>!cloud.users.alice.plan.data.calendarEvents.some(x=>x.id==='m-dentist'),'the deleted event leaves the calendar')
 // Draw: press on 1:00 PM and drag down to 3:30 PM; the new event runs that long.
 const one=week.getByRole('button',{name:'Add at 1:00 PM on Sep 30, 2026'}),three=week.getByRole('button',{name:'Add at 3:00 PM on Sep 30, 2026'})
 await three.scrollIntoViewIfNeeded()
 const ob=await one.boundingBox(),tb=await three.boundingBox()
 await page.mouse.move(ob.x+ob.width/2,ob.y+3);await page.mouse.down()
 for(let i=1;i<=8;i++)await page.mouse.move(ob.x+ob.width/2,ob.y+3+(tb.y+tb.height/2-ob.y-3)*i/8)
 if(process.env.KONO_SHOTS)await week.screenshot({path:process.env.KONO_SHOTS+'/week-draw.png'})
 await page.mouse.up()
 const added=page.getByRole('dialog',{name:'New event'})
 assert.equal(await added.getByLabel('Start time (optional)').inputValue(),'13:00')
 assert.equal(await added.getByLabel('End time (optional)').inputValue(),'15:30')
 assert.equal(await added.getByLabel('Date').inputValue(),'2026-09-30')
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
 assert.equal(await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Week',exact:true}).getAttribute('aria-pressed'),'true','Week is the default on a computer')
 const week=page.getByRole('region',{name:'Week'})
 await week.getByRole('button',{name:/^Quiz review session · 3:00 PM–4:00 PM/}).waitFor()
 await week.getByRole('button',{name:/^Soccer practice · 5:00 PM–6:30 PM/}).waitFor()
 // Source chips: hiding Canvas hides only what came from Canvas, and stays hidden after a reload.
 const chips=page.getByRole('group',{name:'Show on calendar'})
 assert.deepEqual(await chips.getByRole('button').allInnerTexts(),['Canvas','Google','Sports','Added here'])
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
 const editor=page.getByRole('dialog',{name:'New event'})
 assert.equal(await editor.getByLabel('Start time (optional)').inputValue(),'10:00')
 assert.equal(await editor.getByLabel('End time (optional)').inputValue(),'11:00')
 assert.equal(await editor.getByLabel('Date').inputValue(),'2026-10-02')
 await editor.getByLabel('Title').fill('Tutoring')
 await editor.getByRole('button',{name:'Save'}).click()
 await week.getByRole('button',{name:/^Tutoring · 10:00 AM–11:00 AM · Oct 2, 2026/}).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.calendarEvents.some(e=>e.title==='Tutoring'&&e.date==='2026-10-02'&&e.time==='10:00'),'the new event reaches the account')
 // Tapping an event opens its editor right on the calendar (no scrolling down to the daily page).
 await week.getByRole('button',{name:/^Tutoring · 10:00 AM/}).click()
 const tutoring=page.getByRole('dialog',{name:'Edit event'})
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
 const repeatEditor=page.getByRole('dialog',{name:'Edit event'})
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
 const seriesEditor=page.getByRole('dialog',{name:'Edit event'})
 await seriesEditor.getByText('This repeats (4 dates). Save changes to:').waitFor()
 assert.equal(await seriesEditor.getByLabel('Repeat').count(),0,'one already in a series has no Repeat picker')
 await seriesEditor.getByLabel('Title').fill('Math tutoring')
 await seriesEditor.getByLabel('This and the ones after it').check()
 if(process.env.KONO_SHOTS)await seriesEditor.screenshot({path:process.env.KONO_SHOTS+'/event-series.png'})
 await seriesEditor.getByRole('button',{name:'Save'}).click()
 await week.getByRole('button',{name:/^Math tutoring · 1:30 PM–4:00 PM · Oct 9, 2026/}).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.calendarEvents.filter(e=>e.recurringId).map(e=>e.date+' '+e.title).sort().join()==='2026-10-02 Tutoring,2026-10-09 Math tutoring,2026-10-16 Math tutoring,2026-10-23 Math tutoring','only this and the later ones changed')
 await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Month'}).click()
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
 // The source may be gone once dropped (it moved), so don't wait long for it.
 await source.dispatchEvent('dragend',{dataTransfer:data},{timeout:1000}).catch(()=>{})
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
/** KONO's corner: tap KONO's face in the KONO bar; it opens over the page. */
/** The top bar's ⋯ menu (Undo, Redo, voice, Trash) and the Planner's ⋯ menu (Plan my week, …). */
/** Every game opens on its start card (components/GameScreen): press Start (or Continue, Start level N). */
const startGame=async(page,title,label=/^(Start|Continue)/)=>{const d=page.getByRole('dialog',{name:title});await d.getByRole('region',{name:'Start'}).getByRole('button',{name:label}).click();return d}
const headerMenu=async(page,name)=>{const menu=page.locator('details.header-more');if(!await menu.evaluate(d=>d.open))await menu.locator(':scope > summary').click();await menu.getByRole('button',{name,exact:true}).click()}
const plannerMenu=async(page,name)=>{const menu=page.locator('details.planner-more');if(!await menu.evaluate(d=>d.open))await menu.locator(':scope > summary').click();await menu.getByRole('button',{name,exact:true}).click()}
const cornerOf=page=>page.getByRole('dialog',{name:'KONO’s corner'})
const openCorner=async page=>{const d=cornerOf(page);if(!await d.isVisible())await page.getByRole('region',{name:'KONO today'}).getByRole('button',{name:'Open KONO’s corner'}).click();await d.waitFor();return d}
const closeCorner=async page=>{const d=cornerOf(page);if(await d.isVisible()){await d.getByRole('button',{name:'Close dialog'}).click();await d.waitFor({state:'detached'})}}
const waitFor=async(check,message)=>{for(let i=0;i<60;i++){if(check())return;await new Promise(r=>setTimeout(r,250))}assert.fail(message)}
async function openWeekPlanner(page){
 await go(page,'Planner')
 await plannerMenu(page,'✨ Plan my week')
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
 await plannerMenu(page,'📊 Your week so far')
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

test('Duxbury’s elementary calendar with grade 6 offers Duxbury Middle School (14-day rotation, its bell times) in one tap, keeping the grade',async({context,page})=>{
 const cloud=fakeCloud()
 await page.clock.setFixedTime(new Date('2026-10-10T10:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await addToCalendar(page,'My school schedule')
 await page.getByRole('searchbox',{name:'Search for your school'}).fill('duxbury elementary')
 await page.getByRole('button',{name:'Duxbury elementary (Alden, Chandler) · 2026–27 · Monday–Friday'}).click()
 await page.getByRole('region',{name:'Your grade'}).getByRole('combobox').selectOption('6')
 const banner=page.getByRole('alert').filter({hasText:'Grade 6 goes to Duxbury Middle School'})
 await banner.waitFor()
 assert.ok(await page.getByRole('button',{name:'Next: your classes'}).isDisabled(),'not on the elementary calendar')
 await banner.getByRole('button',{name:'Switch to Duxbury Middle School'}).click()
 await page.getByRole('region',{name:'Rotation day'}).getByRole('heading',{name:'Which rotation day is it?'}).waitFor()
 assert.equal(await page.getByRole('region',{name:'Your grade'}).getByRole('combobox').inputValue(),'6')
 assert.equal(await page.getByRole('alert').filter({hasText:'goes to Duxbury'}).count(),0)
})

test('Monday–Friday school: a schedule read by the AI never puts classes on the weekend, and a period set to PM by mistake gets a check AM/PM warning',async({context,page})=>{
 const cloud=fakeCloud()
 await page.clock.setFixedTime(new Date('2026-10-10T10:00:00'))
 await signInAs(context,cloud,'alice')
 await context.route(BASE+'api/ai',route=>{
  if(route.request().method()==='GET')return route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true})})
  const classes=[{name:'Chorus 6',days:['Sunday','Monday'],start:null,end:null,period:'P1-Period 1',room:'PAC'},{name:'MATH 6',days:['Tuesday','Saturday'],start:null,end:null,period:'P2',room:'B146'}]
  return route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({text:JSON.stringify({classes}),used:1,limit:40})})
 })
 await page.goto(BASE);await heading(page,'Sanctuary')
 await addToCalendar(page,'My school schedule')
 await page.getByRole('searchbox',{name:'Search for your school'}).fill('duxbury elementary')
 await page.getByRole('button',{name:'Duxbury elementary (Alden, Chandler) · 2026–27 · Monday–Friday'}).click()
 await page.getByRole('region',{name:'Your grade'}).getByRole('combobox').selectOption('4')
 await page.getByRole('button',{name:'Next: your classes'}).click()
 const {jsPDF}=require('jspdf'),doc=new jsPDF();doc.setFontSize(8);doc.text(['Weekly schedule','P1-Period 1  Chorus 6  PAC'],40,60)
 await page.getByLabel('Upload my schedule').setInputFiles({name:'schedule.pdf',mimeType:'application/pdf',buffer:Buffer.from(doc.output('arraybuffer'))})
 await page.getByText(/Your AI helper found 2 classes\./).waitFor({timeout:90000})
 const found=page.getByRole('table',{name:'What KONO found'})
 assert.equal(await found.getByRole('row',{name:/^(Sunday|Saturday)/}).count(),0,'nothing on the weekend')
 const times=page.getByRole('group',{name:'Period times'})
 await times.getByLabel('Period 1 starts').fill('20:20');await times.getByLabel('Period 1 ends').fill('21:19')
 await page.getByText('Period 1 starts at 8:20 PM. School times are usually AM or early PM; check AM/PM.').waitFor()
 await times.getByLabel('Period 1 starts').fill('08:20');await times.getByLabel('Period 1 ends').fill('09:19')
 await page.getByText('Period 1 starts at',{exact:false}).waitFor({state:'detached'})
})

test('School setup guide: find the school, answer the grade, save, and land on the Planner (Duxbury Public Schools, Monday–Friday)',async({context,page})=>{
 const cloud=fakeCloud()
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await addToCalendar(page,'My school schedule')
 const find=page.getByRole('region',{name:'Find your school'})
 const search=find.getByRole('searchbox',{name:'Search for your school'})
 await search.fill('hanover')
 assert.equal(await find.getByRole('button',{name:'Duxbury elementary (Alden, Chandler) · 2026–27 · Monday–Friday'}).count(),0,'search narrows the list')
 await search.fill('duxbury elementary')
 await find.getByRole('button',{name:'My school isn’t listed'}).waitFor()
 await find.getByRole('button',{name:'Duxbury elementary (Alden, Chandler) · 2026–27 · Monday–Friday'}).click()
 const steps=page.getByRole('list',{name:'Setup steps'})
 assert.match(await steps.locator('[aria-current=step]').innerText(),/2 · Quick questions/)
 const grade=page.getByRole('region',{name:'Your grade'})
 await grade.getByRole('heading',{name:'What grade are you in?'}).waitFor()
 assert.equal(await page.getByRole('region',{name:'Rotation day'}).count(),0,'a Monday–Friday school has no rotation question')
 const next=page.getByRole('button',{name:'Next: your classes'})
 assert.ok(await next.isDisabled(),'the grade comes first')
 await grade.getByRole('combobox').selectOption('3')
 await next.click()
 assert.match(await steps.locator('[aria-current=step]').innerText(),/3 · Your classes/)
 await page.getByLabel('Upload my schedule').waitFor()
 await page.getByRole('button',{name:'Skip for now: save the school calendar'}).click()
 await page.getByRole('heading',{name:'Check your classes'}).waitFor()
 await page.getByRole('button',{name:'Save to my calendar'}).click()
 // Saved: the guide closes and the Planner is showing.
 await page.getByRole('region',{name:'Add to my calendar'}).waitFor({state:'detached'})
 await page.getByRole('button',{name:'＋ Add to my calendar'}).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.studySeasons?.some(x=>x.school?.name==='Duxbury Public Schools'&&x.school.grade==='3'),'the school reaches the account')
 // My schedules opens the full editor, with the grade in step 1 and no college fields.
 await plannerMenu(page,'My schedules')
 await page.getByRole('button',{name:/^Rotating school/}).click()
 const card=page.locator('.school-setup .wb-record').filter({hasText:'Duxbury Public Schools 2026–27'})
 await card.getByRole('button',{name:'Edit school calendar / classes'}).click()
 assert.equal(await page.getByLabel('Student grade').inputValue(),'3')
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

test('Phone music: the floating music button only shows while music plays; Play music is in the top bar’s ⋯ menu',async({context,page})=>{
 const cloud=fakeCloud();cloud.users.alice.plan.data.settings.ambient=true
 await page.setViewportSize({width:390,height:844})
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 assert.equal(await page.locator('.wb-music-bar').isVisible(),false,'no floating button while nothing plays')
 await page.locator('.header-more summary').click()
 await page.locator('.header-more-menu').getByRole('button',{name:'Play music'}).waitFor()
})

test('Home at a rotation school: Today shows the rotation day and the block now with what’s next, "Not Day 1?" fixes the day, a class’s name opens its page (homework, notes, next classes, ＋ Homework for it), and a parent sees the kid’s school day on Kids',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.settings.parentMode=true
 const cycle=Array.from({length:14},(_,i)=>'Day '+(i+1))
 const week=Object.fromEntries(cycle.map((d,i)=>[d,[{id:'bio-'+i,label:'Biology',slot:'Period 1',start:'08:20',end:'09:19',kind:'study',subjectId:'sub-bio',location:'B139',fullYear:true,occurrenceNotes:{},completedDates:[],skippedDates:[]},{id:'math-'+i,label:'Math 6',slot:'Period 2',start:'09:23',end:'10:22',kind:'study',fullYear:true,occurrenceNotes:{},completedDates:[],skippedDates:[]}]]))
 plan.studySeasons=[{id:'dms',profileId:pid,kidId:'kid-emma',name:'Duxbury Middle School 2026–27',start:'2026-09-02',end:'2027-06-24',active:true,week,school:{pattern:'rotation',name:'Duxbury Middle School',grade:'6',cycle,anchorDate:'2026-10-13',anchorDay:'Day 1',weekdays:[1,2,3,4,5],snowAdvances:true,lastClassDate:'2027-06-16',exceptions:[]}}]
 plan.tasks.push({id:'bio-hw',profileId:pid,subjectId:'sub-bio',title:'Cell diagram',due:'2026-10-14',done:false,notes:''})
 await page.clock.setFixedTime(new Date('2026-10-13T09:10:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const strip=page.getByRole('group',{name:'Today at school'})
 assert.match(await strip.innerText(),/🦄 Emma\s+Day 1/i)
 assert.match(await strip.innerText(),/Now Block 1 · Biology until 9:19 AM · then Block 2 · Math 6 at 9:23 AM/i)
 // The school counts today as Day 3: fix it here, and the account keeps the correction.
 await strip.getByRole('button',{name:'Not Day 1?'}).click()
 await strip.getByLabel('Rotation day today for 🦄 Emma').selectOption('Day 3')
 await strip.getByRole('button',{name:'Set'}).click()
 await strip.locator('.rotation-today-day strong',{hasText:'Day 3'}).waitFor();await strip.getByRole('button',{name:'Not Day 3?'}).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.studySeasons[0].school.exceptions.some(e=>e.cycleDay==='Day 3'&&e.start==='2026-10-13'),'the rotation fix never reached the account')
 // A class's page: what's due for it and when it meets next; ＋ Homework is already set to its subject.
 await strip.getByRole('button',{name:'Block 1 · Biology'}).click()
 const sheet=page.getByRole('dialog',{name:'Biology'})
 await sheet.getByRole('region',{name:'Due for this class'}).getByText('Cell diagram').waitFor()
 assert.match(await sheet.getByRole('region',{name:'Next classes'}).innerText(),/Today\s+8:20 AM · Period 1/)
 await sheet.getByRole('button',{name:'＋ Homework'}).click()
 const editor=page.getByRole('dialog').filter({has:page.getByLabel('Subject')}).first()
 assert.equal(await editor.getByLabel('Subject').locator('option:checked').innerText(),'Biology')
 await page.keyboard.press('Escape');await editor.waitFor({state:'detached'})
 // The same page opens from the class's card in Today.
 await page.getByRole('region',{name:'Your day'}).getByRole('region',{name:'Today',exact:true}).getByRole('button',{name:'Open Math 6'}).click()
 await page.getByRole('dialog',{name:'Math 6'}).getByText('Save this schedule to link the class',{exact:false}).waitFor()
 await page.keyboard.press('Escape')
 // Parent mode › Kids: Emma's school day.
 await go(page,'Kids')
 const kids=page.getByRole('region',{name:'Your kids'})
 assert.match(await kids.innerText(),/Emma\s+Duxbury Middle School · Day 3/)
 assert.match(await kids.innerText(),/Biology 8:20 AM, Math 6 9:23 AM/)
})

test('Duxbury Middle School from two cropped screenshots (Day 1, then Day 2, no day headings): the AI answers with just a grid, the second picture carries on from Day 2, and all 7 periods and ASP are found',async({context,page})=>{
 const cloud=fakeCloud(),posts=[]
 await page.clock.setFixedTime(new Date('2026-10-10T10:00:00'))
 await signInAs(context,cloud,'alice')
 const column=names=>({dayHeadings:[],grid:['1-P1','2-P2','3-P3','4-P4','5-ASP','6-P5'].map((period,i)=>({period,cells:[{name:names[i],code:null,room:null,teacher:null}]}))})
 const answers=[column(['French 7','English 7','Math 7 Accelerated','Orchestra 7','Academic Support Period Gr. 7','Critical Reading&Thinking']),column(['Geography and Ancient Civilizations II','Science 7','French 7','English 7','Academic Support Period Gr. 7','Math 7 Accelerated'])]
 await context.route(BASE+'api/ai',route=>{
  const request=route.request()
  if(request.method()==='GET')return route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true})})
  posts.push(request.postDataJSON())
  return route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({text:JSON.stringify(answers[posts.length-1]),used:posts.length,limit:40})})
 })
 await page.goto(BASE);await heading(page,'Sanctuary')
 await addToCalendar(page,'My school schedule')
 const search=page.getByRole('searchbox',{name:'Search for your school'})
 await search.fill('duxbury')
 assert.equal(await page.getByRole('button',{name:/Duxbury elementary/}).count(),0,'one Duxbury middle school, without the elementary calendar')
 await page.getByRole('button',{name:'Duxbury Middle School · 2026–27 · 14-day rotation'}).click()
 await page.getByRole('region',{name:'Your grade'}).getByRole('combobox').selectOption('7')
 const rotation=page.getByRole('region',{name:'Rotation day'})
 await rotation.getByLabel('School day').fill('2026-10-13')
 await rotation.getByRole('combobox').selectOption('Day 1')
 await rotation.getByRole('button',{name:'Set rotation'}).click()
 await page.getByRole('button',{name:'Next: your classes'}).click()
 const mine=page.getByRole('region',{name:'Your classes'})
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64')
 await mine.getByLabel('Upload my schedule').setInputFiles([{name:'day1.png',mimeType:'image/png',buffer:png},{name:'day2.png',mimeType:'image/png',buffer:png}])
 await mine.getByText('Found 7 of your 7 periods.',{exact:false}).waitFor({timeout:60000})
 assert.equal(posts.length,2);assert.match(posts[0].prompt,/the first column is "Day 1"/);assert.match(posts[1].prompt,/the first column is "Day 2"/)
 for(const [n,name] of [[1,'French 7'],[2,'English 7'],[3,'Math 7 Accelerated'],[4,'Orchestra 7'],[5,'Critical Reading&Thinking'],[6,'Geography and Ancient Civilizations II'],[7,'Science 7']])assert.equal(await mine.getByLabel('Period '+n+' name').inputValue(),name)
 assert.equal(await mine.getByLabel('ASP name').inputValue(),'Academic Support Period Gr. 7')
})
test('Duxbury Middle School: the school’s 14-day Rotation of Periods (1a–7b, five blocks a day) with its bell times, lunch waves and ASP; KONO’s AI reads a Grade 6 schedule into 7 periods (Period 2 and 6 alternate on b days), and all 14 days are saved',async({context,page})=>{
 const cloud=fakeCloud(),posts=[]
 await page.clock.setFixedTime(new Date('2026-10-10T10:00:00')) // a Saturday
 await signInAs(context,cloud,'alice')
 // The AI's answer for a Grade 6 schedule (D1–D14 columns, P1–P5 and ASP rows): one entry per class and period.
 const C={LW:['602-01','Literacy/Writing','B158'],CH:['657-01','Chorus 6','PAC'],GEO:['610-03','Geography and Ancient Civilizations I','B148'],PE:['690-01','Physical Education/Health 6','D178'],LR:['601-05','Literacy/Reading','B159'],MA:['621-01','MATH 6','B146'],SCI:['630-02','Science 6','B139'],ST:['786-10','STEM 6','B307'],FR:['662-02','French - Grade 6','B250']}
 const grid=['LW PE SCI GEO MA','CH LR LW FR SCI','GEO MA ST LR LW','PE SCI GEO MA CH','LR LW FR SCI GEO','MA ST LR LW PE','SCI GEO MA CH LR','LW FR SCI GEO MA','ST LR LW PE SCI','GEO MA CH LR LW','FR SCI GEO MA ST','LR LW PE SCI GEO','MA CH LR LW FR','SCI GEO MA ST LR'].map(r=>r.split(' '))
 const byClassPeriod=new Map()
 grid.forEach((row,d)=>row.forEach((k,p)=>{const key=k+' '+(p+1);byClassPeriod.set(key,[...(byClassPeriod.get(key)??[]),'D'+(d+1)])}))
 const classes=[...byClassPeriod].map(([key,days])=>{const [k,p]=key.split(' ');return {name:C[k][1],code:C[k][0],days,start:null,end:null,period:'P'+p+'-Period '+p,building:null,room:C[k][2],teacher:null}})
 classes.push({name:'Academic Support Period Gr. 6',code:'ASP6-01',days:grid.map((_,d)=>'D'+(d+1)),start:null,end:null,period:'ASP-Academic Support Period',building:null,room:'B159',teacher:'Burns, Deborah E'})
 await context.route(BASE+'api/ai',route=>{
  const request=route.request()
  if(request.method()==='GET')return route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true})})
  posts.push(request.postDataJSON())
  return route.fulfill({status:200,headers:{'content-type':'application/json'},body:JSON.stringify({text:JSON.stringify({classes}),used:1,limit:40})})
 })
 await page.goto(BASE);await heading(page,'Sanctuary')
 await addToCalendar(page,'My school schedule')
 await page.getByRole('searchbox',{name:'Search for your school'}).fill('duxbury middle')
 await page.getByRole('button',{name:'Duxbury Middle School · 2026–27 · 14-day rotation'}).click()
 await page.getByRole('region',{name:'Your grade'}).getByRole('combobox').selectOption('6')
 const rotation=page.getByRole('region',{name:'Rotation day'})
 await rotation.getByLabel('School day').fill('2026-10-13')
 await rotation.getByRole('combobox').selectOption('Day 1')
 await rotation.getByRole('button',{name:'Set rotation'}).click()
 await rotation.getByText('✓ Tuesday, October 13 is Day 1.').waitFor()
 await page.getByRole('button',{name:'Next: your classes'}).click()
 const mine=page.getByRole('region',{name:'Your classes'})
 await mine.getByRole('heading',{name:'Your 7 periods'}).waitFor()
 assert.match(await mine.innerText(),/Day 1 is 1a-2a-3a-4a-5a, Day 2 is 6a-7a-1b-2b-3b/)
 const {jsPDF}=require('jspdf'),doc=new jsPDF({orientation:'landscape',unit:'pt',format:'letter'})
 doc.setFontSize(8);doc.text(['D1 - Day 1   D2 - Day 2   D3 -   D4 -   …   D14 -','P1-Period1   602-01 Literacy/Writing   657-01 Chorus 6   610-03 Geography …','ASP-Academic Support Period   ASP6-01 Academic Support Period Gr. 6 …'],40,60)
 await mine.getByLabel('Upload my schedule').setInputFiles({name:'schedule.pdf',mimeType:'application/pdf',buffer:Buffer.from(doc.output('arraybuffer'))})
 await mine.getByText('Found 7 of your 7 periods.',{exact:false}).waitFor({timeout:90000})
 assert.equal(posts.length,1);assert.match(posts[0].prompt,/5 periods \(also called blocks\) every day/);assert.match(posts[0].prompt,/Each day also has "ASP"/)
 assert.equal(await mine.getByLabel('Period 1 name').inputValue(),'602-01 · Literacy/Writing')
 assert.equal(await mine.getByLabel('Different class on 1b days').isChecked(),false,'Literacy/Writing is the same on 1a and 1b')
 assert.equal(await mine.getByLabel('Different class on 6b days').isChecked(),true);assert.equal(await mine.getByLabel('Period 6b name').inputValue(),'786-10 · STEM 6')
 assert.equal(await mine.getByLabel('Period 2b name').inputValue(),'662-02 · French - Grade 6')
 assert.equal(await mine.getByLabel('ASP name').inputValue(),'ASP6-01 · Academic Support Period Gr. 6')
 await mine.getByLabel('Period 4 lunch').selectOption('2')
 const days=mine.getByRole('table',{name:'Your days'})
 assert.match(await days.locator('thead').innerText(),/Block 4\s+11:29 AM\s+ASP\s+1:02 PM\s+Block 5\s+1:46 PM/)
 assert.match(await days.getByRole('row',{name:/^Day 11/}).innerText(),/French - Grade 6[\s\S]+Science 6[\s\S]+Geography[\s\S]+MATH 6[\s\S]+ASP6-01[\s\S]+STEM 6/)
 if(process.env.KONO_SHOTS){await mine.screenshot({path:process.env.KONO_SHOTS+'/dms-periods.png'})}
 await mine.getByRole('button',{name:'Build all 14 days'}).click()
 await page.getByRole('button',{name:'Save to my calendar'}).click()
 await page.getByRole('region',{name:'Add to my calendar'}).waitFor({state:'detached'})
 await waitFor(()=>{const s=cloud.users.alice.plan.data.studySeasons?.find(x=>x.school?.name==='Duxbury Middle School');return s&&Object.values(s.week).flat().length===14*7},'all 14 days (5 blocks, lunch and ASP) reach the account')
 const saved=cloud.users.alice.plan.data.studySeasons.find(x=>x.school?.name==='Duxbury Middle School')
 assert.equal(saved.week['Day 1'].map(b=>b.start+' '+b.label).join(' | '),'08:20 602-01 · Literacy/Writing | 09:23 690-01 · Physical Education/Health 6 | 10:26 630-02 · Science 6 | 11:29 610-03 · Geography and Ancient Civilizations I | 12:00 Lunch 2 | 13:02 ASP6-01 · Academic Support Period Gr. 6 | 13:46 621-01 · MATH 6')
 assert.ok(saved.week['Day 4'].some(b=>b.label==='Lunch 1'),'Day 4 has Period 5a (MATH 6) in Block 4, whose lunch stays 1st: only Period 4’s was changed')
})

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
 await plannerMenu(page,'My schedules')
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
 cloud.users.alice.plan.data.settings.familyStudyTabs=cloud.users.carol.plan.data.settings.familyStudyTabs=true // both have kids: a family plan shows Exams only when asked
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

test('Overdue: past-due assignments show one card (at the top of Today) with Done, Move to today, Move all and Later; on phones setup is a chip that opens the steps',async({context,page})=>{
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
  await phone.page.getByRole('button',{name:/^Set up KONO · \d\/3$/}).click()
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
test('Weekend, quick add and swipe: Saturday leads with the week ahead (due, tests, work shifts); "bio worksheet due fri" becomes a Biology assignment; on a phone, swipe right finishes and left moves to tomorrow',async({context,page})=>{
 const SATURDAY='2026-10-03T10:00:00'
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.tasks.push({id:'mon-read',profileId:pid,subjectId:'sub-bio',title:'Monday reading',due:'2026-10-05',done:false,notes:''},{id:'mon-lab',profileId:pid,subjectId:'',title:'Lab sheet',due:'2026-10-05',done:false,notes:''})
 plan.exams.push({id:'wed-quiz',profileId:pid,subjectId:'sub-bio',title:'Unit quiz',due:'2026-10-07',done:false,notes:''})
 plan.studySeasons.push({id:'job',profileId:pid,name:'Cafe · work',start:'2026-09-01',end:'2026-12-20',active:true,week:{Sunday:[],Monday:[],Tuesday:[{id:'tue',label:'Cafe',start:'16:00',end:'20:00',kind:'routine'}],Wednesday:[],Thursday:[],Friday:[],Saturday:[]}})
 await page.clock.setFixedTime(new Date(SATURDAY))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 const weekend=page.getByRole('region',{name:'Your week ahead'})
 await weekend.getByText('Monday reading').first().waitFor()
 await weekend.getByText('Tests this week:').waitFor()
 assert.match(await weekend.locator('.weekend-tests').innerText(),/Unit quiz \(Wed\)/)
 // The week ahead, day by day: Monday's two, Wednesday's quiz, Tuesday's shift.
 await weekend.getByRole('button',{name:/^Mon 5: 2 due$/}).waitFor()
 await weekend.getByRole('button',{name:/^Tue 6: work 4:00 PM to 8:00 PM$/}).waitFor()
 await weekend.getByRole('button',{name:/^Wed 7: test: Unit quiz$/}).waitFor()

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
  const card=title=>phone.page.getByRole('region',{name:'Your week ahead'}).locator('.swipe-row').filter({hasText:title}).first()
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
 await (await openCorner(page)).getByRole('button',{name:'Your stickers: 2 of 12 earned'}).waitFor()
 await closeCorner(page)
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
 await (await openCorner(page)).getByRole('button',{name:'Your stickers: 3 of 12 earned'}).click()
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
 // The sleep picture, or the sleeping animation (KonoSprite) when KONO is tucked in.
 await today.locator('img[src$="sleep.webp"], .kono-sprite.is-sleep').first().waitFor()
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

test('Halloween island: all of October the island is the Halloween island, with its own picture for each time of day (and its own quick picture while it loads), and in November it is back to normal',async({context,page})=>{
 const cloud=fakeCloud(),maps=[]
 page.on('response',r=>{const u=new URL(r.url());if(/\/garden\/terrace-23\.0\//.test(u.pathname))maps.push([u.pathname,r.status()])})
 await page.clock.setFixedTime(new Date('2026-10-15T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await islandLoaded(page)
 assert.ok(maps.some(([p,st])=>p==='/garden/terrace-23.0/halloween-v2/afternoon.webp'&&st===200),'the Halloween afternoon island loads at 3 PM: '+JSON.stringify(maps))
 assert.ok(!maps.some(([p])=>/^\/garden\/terrace-23\.0\/(morning|afternoon|evening|night)\.webp$/.test(p)),'not the regular one: '+JSON.stringify(maps))
 if(process.env.KONO_SHOTS){await page.waitForTimeout(3000);await page.locator('.sanctuary-viewport').screenshot({path:process.env.KONO_SHOTS+'/halloween-island-afternoon.png'})}
 maps.length=0
 await page.getByLabel('Sanctuary time').selectOption('night')
 await waitFor(()=>maps.some(([p,st])=>p==='/garden/terrace-23.0/halloween-v2/night.webp'&&st===200),'the Halloween night island never loaded: '+JSON.stringify(maps))
 if(process.env.KONO_SHOTS){await page.waitForTimeout(6000);await page.locator('.sanctuary-viewport').screenshot({path:process.env.KONO_SHOTS+'/halloween-island-night.png'})}
 maps.length=0
 await page.clock.setFixedTime(new Date('2026-11-02T21:30:00'))
 await page.reload();await heading(page,'Sanctuary')
 await islandLoaded(page)
 assert.ok(maps.some(([p,st])=>p==='/garden/terrace-23.0/night.webp'&&st===200),'in November the regular island is back: '+JSON.stringify(maps))
 assert.ok(!maps.some(([p])=>p.includes('/halloween')))
})

test('Winter island: from December 1 the island is under snow (with its own quick picture), Valentine’s week keeps the snow and brings its own stickers, and KONO’s winter earmuffs and heart headband show in the wardrobe',async({context,page})=>{
 const cloud=fakeCloud(),maps=[]
 page.on('response',r=>{const u=new URL(r.url());if(/\/garden\/terrace-23\.0\//.test(u.pathname))maps.push([u.pathname,r.status()])})
 await page.clock.setFixedTime(new Date('2026-12-15T21:30:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await islandLoaded(page)
 assert.ok(maps.some(([p,st])=>p==='/garden/terrace-23.0/winter/night.webp'&&st===200),'the winter night island loads: '+JSON.stringify(maps))
 assert.ok(!maps.some(([p])=>p==='/garden/terrace-23.0/night.webp'),'not the regular one')
 if(process.env.KONO_SHOTS){await page.waitForTimeout(5000);await page.locator('.sanctuary-viewport').screenshot({path:process.env.KONO_SHOTS+'/winter-island-night.png'})}
 await page.getByRole('button',{name:'Decorate'}).click()
 await page.getByRole('navigation',{name:'Decoration categories'}).getByRole('button',{name:'Wardrobe',exact:true}).click()
 await page.getByLabel('Fluffy earmuffs, locked. Finish 3 assignments between December 1 and February 14.').waitFor()
 assert.equal(await page.getByLabel(/^Heart headband/).count(),0,'the heart headband waits for Valentine’s week')
 // Valentine's week: still the winter island, with Valentine's stickers.
 maps.length=0
 await page.clock.setFixedTime(new Date('2027-02-10T15:00:00'))
 await page.reload();await heading(page,'Sanctuary')
 await islandLoaded(page)
 assert.ok(maps.some(([p,st])=>p==='/garden/terrace-23.0/winter/afternoon.webp'&&st===200),'Valentine’s week keeps the snow: '+JSON.stringify(maps))
 await (await openCorner(page)).getByText(/Valentine’s week: 0\/4 special stickers until Feb 14/).waitFor()
 await closeCorner(page)
 if(process.env.KONO_SHOTS){await page.waitForTimeout(4000);await page.locator('.sanctuary-viewport').screenshot({path:process.env.KONO_SHOTS+'/valentine-island.png'})}
 await page.getByRole('button',{name:'Decorate'}).click()
 await page.getByRole('navigation',{name:'Decoration categories'}).getByRole('button',{name:'Wardrobe',exact:true}).click()
 await page.getByLabel('Heart headband, locked. Grant 2 of KONO’s wishes during Valentine’s week (February 1–14).').waitFor()
 // After February 14 it's the regular island again.
 maps.length=0
 await page.clock.setFixedTime(new Date('2027-02-20T15:00:00'))
 await page.reload();await heading(page,'Sanctuary')
 await islandLoaded(page)
 assert.ok(maps.some(([p,st])=>p==='/garden/terrace-23.0/afternoon.webp'&&st===200),'after Valentine’s week the regular island is back: '+JSON.stringify(maps))
 assert.ok(!maps.some(([p])=>p.includes('/winter/')))
})
test('Spring and the end of the semester: from March 20 the island blooms (Spring bloom stickers, bunny ears), from May 21 it’s the festive last stretch (Last stretch stickers, a party hat), and from June 21 it’s the regular island',async({context,page})=>{
 const cloud=fakeCloud(),maps=[]
 page.on('response',r=>{const u=new URL(r.url());if(/\/garden\/terrace-23\.0\//.test(u.pathname))maps.push([u.pathname,r.status()])})
 const visit=async(time,folder,banner,outfit)=>{
  maps.length=0
  await page.clock.setFixedTime(new Date(time))
  if(page.url().startsWith('http'))await page.reload();else await page.goto(BASE)
  await heading(page,'Sanctuary')
  await islandLoaded(page)
  assert.ok(maps.some(([p,st])=>p==='/garden/terrace-23.0/'+folder+'afternoon.webp'&&st===200),time+': '+JSON.stringify(maps))
  if(!banner)return
  await (await openCorner(page)).getByText(banner).waitFor()
  await closeCorner(page)
  if(process.env.KONO_SHOTS)await page.locator('.sanctuary-viewport').screenshot({path:process.env.KONO_SHOTS+'/'+folder.replace('/','')+'-island.png'})
  await page.getByRole('button',{name:'Decorate'}).click()
  await page.getByRole('navigation',{name:'Decoration categories'}).getByRole('button',{name:'Wardrobe',exact:true}).click()
  await page.getByLabel(outfit).waitFor()
 }
 await signInAs(context,cloud,'alice')
 await visit('2027-04-10T15:00:00','spring/',/Spring bloom: 0\/4 special stickers until May 20/,'Bunny ears, locked. Grant 3 of KONO’s wishes in spring (March 20 – May 20).')
 await visit('2027-06-01T15:00:00','semester/',/Last stretch: 0\/4 special stickers until Jun 20/,'Party hat, locked. Finish 5 assignments at the end of the semester (May 21 – June 20).')
 await visit('2027-07-01T15:00:00','',null,null)
 assert.ok(!maps.some(([p])=>/\/(spring|semester)\//.test(p)),'summer is the regular island')
})
test('Decorate › Halloween: all 16 pieces (a pumpkin house, an autumn tree, a writable sign and the rest), with art for every time of day, go on the island and stay; the sign takes text',async({context,page})=>{
 const cloud=fakeCloud(),pid=cloud.users.alice.plan.data.activeProfileId,art=[]
 page.on('response',r=>{const u=new URL(r.url());if(u.pathname.includes('/registered-22.8.6/halloween/'))art.push([u.pathname,r.status()])})
 await page.clock.setFixedTime(new Date('2026-10-02T21:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await page.getByRole('button',{name:'Decorate'}).click()
 await page.getByRole('navigation',{name:'Decoration categories'}).getByRole('button',{name:'Halloween',exact:true}).click()
 const palette=page.locator('.build-palette')
 const names=['Pumpkin House','Autumn Spooky Tree','Pumpkin Patch','Bubbling Cauldron','Scarecrow','Jack-o’-Lantern Lamp','Halloween Sign','Study Corner Treats','Jack-o’-Lantern Trio','Candy Basket','Mossy Gravestone','Bat Roost','Hay Bales & Pumpkins','Ghost Friend','Autumn Fence Garland','Spell Book & Candles']
 for(const name of names)await palette.getByRole('button',{name:'Add '+name,exact:true}).waitFor()
 assert.equal(await palette.getByRole('button',{name:/^Add /}).count(),names.length,'just the new Halloween set')
 await palette.getByRole('button',{name:'Add Pumpkin House'}).click()
 await palette.getByRole('button',{name:'Add Autumn Spooky Tree'}).click()
 await palette.getByRole('button',{name:'Add Halloween Sign'}).click()
 await page.getByLabel('Sign text').fill('Boo! 🎃')
 await waitFor(()=>{const ps=cloud.users.alice.plan.data.sanctuaryDecor?.[pid]?.placements??[];return ['halloween-pumpkin-house','halloween-spooky-tree'].every(id=>ps.some(p=>p.assetId===id))&&ps.some(p=>p.assetId==='halloween-sign'&&p.text==='Boo! 🎃')},'the Halloween pieces (and the sign’s text) never reached the island: '+JSON.stringify((cloud.users.alice.plan.data.sanctuaryDecor?.[pid]?.placements??[]).map(p=>[p.assetId,p.text])))
 await waitFor(()=>art.some(([p])=>p.endsWith('/pumpkin-house/night.webp')),'the night art for the pumpkin house never loaded: '+JSON.stringify(art))
 assert.ok(art.every(([,st])=>st===200),'a Halloween picture failed to load: '+JSON.stringify(art))
 if(process.env.KONO_SHOTS){await page.getByRole('button',{name:'Done decorating'}).click();await page.waitForTimeout(2500);await page.locator('.wb-island').screenshot({path:process.env.KONO_SHOTS+'/halloween-decor-island.png'})}
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
 assert.equal(await today.locator('.kono-mood-face').getAttribute('data-costume'),'🎃')
 const corner=await openCorner(page)
 await corner.getByText('Spooky season: 0/4 special stickers until Oct 31',{exact:false}).waitFor()
 await corner.getByRole('button',{name:'Your stickers: 2 of 16 earned'}).waitFor()
 await closeCorner(page)
 await page.waitForTimeout(900)
 await page.getByRole('region',{name:'Overdue'}).getByRole('button',{name:'Done: Read chapter 3'}).click()
 await page.getByRole('status').filter({hasText:'New sticker: 🎃 Pumpkin! Put it on your island in Decorate › Stickers.'}).waitFor()
 await (await openCorner(page)).getByText('Spooky season: 1/4 special stickers',{exact:false}).waitFor()
 await cornerOf(page).getByRole('button',{name:'Your stickers: 3 of 16 earned'}).click()
 const palette=page.locator('.build-palette')
 await palette.getByLabel('Friendly ghost, locked. Study 3 days in a row in October.').waitFor()
 await palette.getByRole('button',{name:'Add Pumpkin'}).click()
 await waitFor(()=>(cloud.users.alice.plan.data.sanctuaryDecor?.[pid]?.placements??[]).some(p=>p.assetId==='sticker-halloween-pumpkin'),'the pumpkin never reached the island')
 await page.clock.setFixedTime(new Date('2026-11-05T15:00:00'))
 await page.reload();await heading(page,'Sanctuary')
 await openCorner(page)
 assert.equal(await cornerOf(page).locator('.kono-season').count(),0,'the event is over')
 await cornerOf(page).getByRole('button',{name:'Your stickers: 3 of 13 earned'}).click()
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

test('Kids\' appearance: one kid at a time, a saved animated border becomes its closest simple style, and the emoji, color and border a parent picks reach the account and the Planner tile',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.calendarEvents.push({id:'leo-swim',profileId:pid,date:'2026-10-02',title:'Swim lesson',kind:'activity',notes:'',kidId:'kid-leo',time:'16:00'})
 await page.clock.setFixedTime(new Date('2026-10-02T09:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE)
 await heading(page,'Sanctuary')
 await go(page,'Kids')
 await page.getByRole('button',{name:'🎨 Appearance'}).click()
 const panel=page.getByRole('dialog',{name:'Kids\' appearance'})
 const tabs=panel.getByRole('tablist',{name:'Kids'})
 assert.equal(await tabs.getByRole('tab').count(),2)
 assert.equal(await tabs.getByRole('tab',{name:/Emma/}).getAttribute('aria-selected'),'true')
 // Emma was saved under the animated "ocean" border, which is now the calm Glow.
 assert.equal(await panel.getByRole('radiogroup',{name:'Emma\'s border style'}).getByRole('radio',{checked:true}).innerText(),'Glow')
 assert.equal(await panel.getByRole('radiogroup',{name:'Leo\'s border style'}).count(),0,'only the selected kid is shown')
 await tabs.getByRole('tab',{name:/Leo/}).click()
 await panel.getByRole('radiogroup',{name:'Leo\'s border style'}).getByRole('radio',{name:'Dotted'}).click()
 await panel.getByRole('radiogroup',{name:'Leo\'s color'}).getByRole('radio',{name:'#5da8a1'}).click()
 await panel.getByLabel('Leo\'s emoji').fill('🦁')
 await panel.getByRole('button',{name:'Use',exact:true}).click()
 await panel.getByRole('img',{name:'Leo\'s tile preview'}).getByText('🦁 Leo').waitFor()
 // Each change says it was saved, on top of the open dialog.
 assert.match(await page.locator('.save-toast').innerText(),/saved/i)
 await waitFor(()=>{const k=cloud.users.alice.plan.data.kids.find(x=>x.id==='kid-leo');return k.borderStyle==='dotted'&&k.color==='#5da8a1'&&k.emoji==='🦁'&&!('borderSpeed' in k)},'Leo\'s new look never reached the account')
 await panel.getByRole('button',{name:'Close dialog'}).click()
 await go(page,'Planner')
 await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Schedule'}).click()
 const tile=page.locator('.wb-family-event').filter({hasText:'Swim lesson'})
 await tile.waitFor()
 assert.match(await tile.getAttribute('class'),/kid-border-dotted/)
 assert.equal(await tile.evaluate(el=>getComputedStyle(el).borderTopStyle),'dotted')
 assert.equal(await tile.locator('.kid-border-fx').count(),0,'no animated layer on a kid\'s tile any more')
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

test('Sanctuary: KONO today is a slim bar right under the island window, inside the island card, with Focus session after it; Decorate opened from the sticker tile in KONO’s corner keeps the decorations on the island',async({context,page})=>{
 const cloud=fakeCloud()
 await page.clock.setFixedTime(new Date('2026-10-02T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const bar=page.getByRole('region',{name:'KONO today'}),island=page.locator('.wb-island')
 // Measured together, in one read, once the page has settled: late content above (the setup row,
 // KONO's line, lazily loaded cards) can still move both for a moment, and two separate reads can
 // straddle that move. Settled = the same positions on two polls in a row.
 const above=await page.waitForFunction(()=>{const b=document.querySelector('.kono-bar')?.getBoundingClientRect(),i=document.querySelector('.wb-island')?.getBoundingClientRect(),f=document.querySelector('.sanctuary-focus')?.getBoundingClientRect();if(!b||!i||!f)return false;const key=Math.round(b.top)+':'+Math.round(i.bottom)+':'+Math.round(f.top),w=window;const settled=w.__konoBarKey===key;w.__konoBarKey=key;return settled&&{gap:b.top-i.bottom,focusGap:f.top-b.bottom}},null,{timeout:10000,polling:250}).then(h=>h.jsonValue())
 const b=await bar.boundingBox(),i=await island.boundingBox(),docY=await page.evaluate(()=>scrollY)
 if(process.env.KONO_SHOTS){await page.screenshot({fullPage:true,path:process.env.KONO_SHOTS+'/kono-bar.png',clip:{x:b.x-10,y:b.y+docY-10,width:b.width+20,height:b.height+200}});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);const pb=await bar.evaluate(e=>{const r=e.getBoundingClientRect();return {y:r.top+scrollY,height:r.height}});await page.screenshot({fullPage:true,path:process.env.KONO_SHOTS+'/kono-bar-phone.png',clip:{x:0,y:Math.max(0,pb.y-10),width:390,height:pb.height+160}});await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(400)}
 assert.ok(b.height<160,'the KONO bar is slim (two short rows, even with a note from KONO): '+b.height+'px')
 assert.ok(Math.abs(above.gap)<=1,'the KONO bar sits right under the island window, in the same card: '+above.gap+'px')
 assert.ok(above.focusGap>=-1,'Focus session comes after the island card (its place on Home is yours to change): '+above.focusGap+'px')
 await page.getByRole('button',{name:'Decorate'}).click()
 const nav=page.getByRole('navigation',{name:'Decoration categories'})
 for(const cat of ['Homes','Trees','Ponds']){await nav.getByRole('button',{name:cat,exact:true}).click();await page.locator('.build-palette [role=button][aria-label^="Add "]').first().click()}
 await page.getByRole('button',{name:'Done decorating'}).click()
 await (await openCorner(page)).getByRole('button',{name:/^Your stickers/}).click()
 await page.getByText(/^Earn stickers by keeping up with your work/).waitFor()
 await page.waitForTimeout(600)
 const aligned=async why=>{const art=await page.locator('.wb-sanctuary-zoom-wrap').boundingBox(),layer=await page.locator('.build-hotspot-layer').boundingBox();assert.ok(Math.abs(art.y-layer.y)<2&&Math.abs(art.x-layer.x)<2&&Math.abs(art.height-layer.height)<8,why+': the decorations layer '+JSON.stringify(layer)+' left the island '+JSON.stringify(art))}
 await aligned('opened from the sticker button')
 await page.mouse.wheel(0,500);await page.waitForTimeout(300)
 await aligned('after scrolling down to the palette')
 if(process.env.KONO_SHOTS)await page.screenshot({path:process.env.KONO_SHOTS+'/decorate-stickers.png'})
})

test('Planner › ＋ Add to this date: Lesson and Work open a new event already set to that type, and save to the calendar',async({context,page})=>{
 const cloud=fakeCloud()
 await page.clock.setFixedTime(new Date('2026-09-28T08:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await go(page,'Planner')
 for(const [button,kind,title] of [['Lesson','lesson','Piano lesson'],['Work','work','Cafe shift']]){
  if(!await page.locator('details.planner-add-menu').evaluate(d=>d.open))await page.locator('details.planner-add-menu > summary').click()
  await page.locator('details.planner-add-menu').getByRole('button',{name:button,exact:true}).click()
  const editor=page.getByRole('dialog',{name:'New event'})
  assert.equal(await editor.getByRole('group',{name:'Event type'}).getByRole('button',{name:new RegExp(button)}).getAttribute('aria-pressed'),'true',kind+' is picked')
  await editor.getByLabel('Title').fill(title)
  await editor.getByRole('button',{name:'Save'}).click()
  await editor.waitFor({state:'detached'})
  await waitFor(()=>cloud.users.alice.plan.data.calendarEvents.some(e=>e.title===title&&e.kind===kind),title+' never reached the account as a '+kind)
 }
})
test('My work schedule: weekly shifts go on the calendar from the Planner’s ⋯ menu, Plan my week treats them as busy, and they can be removed',async({context,page})=>{
 const cloud=fakeCloud(),pid=cloud.users.alice.plan.data.activeProfileId
 await page.clock.setFixedTime(new Date('2026-09-28T08:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await go(page,'Planner')
 await plannerMenu(page,'💼 My work schedule')
 const setup=page.getByRole('region',{name:'My work schedule'})
 await setup.getByLabel('Job').fill('Cafe')
 const days=setup.getByRole('group',{name:'Shift days'})
 await days.getByLabel('Tuesday').check();await days.getByLabel('Thursday').check()
 await setup.getByLabel('Starts at').fill('16:00');await setup.getByLabel('Ends at').fill('20:00')
 await setup.getByRole('button',{name:'Add my shifts'}).click()
 await setup.getByRole('status').filter({hasText:'Your shifts are on the calendar'}).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.studySeasons.some(s=>s.profileId===pid&&s.name==='Cafe · work'&&s.week.Tuesday?.[0]?.start==='16:00'&&s.week.Thursday?.[0]?.end==='20:00'&&s.week.Tuesday[0].kind==='routine'),'the shifts never reached the account')
 await setup.getByRole('list',{name:'Your work shifts'}).getByText('Cafe').waitFor()
 await page.getByRole('region',{name:'Add to my calendar'}).getByRole('button',{name:'Done'}).click()
 // Tuesday's calendar shows the shift.
 await page.locator('.wb-week-grid, .week-grid, [class*=week]').filter({hasText:'Cafe'}).first().waitFor()
 // Remove it again.
 await plannerMenu(page,'💼 My work schedule')
 await page.getByRole('region',{name:'My work schedule'}).getByRole('button',{name:'Remove Cafe'}).click()
 await waitFor(()=>!cloud.users.alice.plan.data.studySeasons.some(s=>s.name==='Cafe · work'),'the shifts were never removed')
})
test('Sanctuary › Today’s and Tomorrow’s schedule: ＋ Add saves an assignment, test or lesson for that day right in the card (Type is a dropdown), and it shows on the Planner calendar',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data
 plan.settings.parentMode=false
 await page.clock.setFixedTime(new Date('2026-09-28T08:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const todayCard=page.getByRole('region',{name:'Your day'}),tomorrowCard=todayCard
 const dialogs=await page.getByRole('dialog').count()
 await todayCard.getByRole('button',{name:'Add for today'}).click()
 const todayForm=todayCard.getByRole('form',{name:'Add for today'})
 await todayForm.getByLabel('What to add for today').fill('Lab report')
 await todayForm.getByRole('button',{name:'Add',exact:true}).click()
 await todayCard.getByText('Lab report').first().waitFor()
 await todayForm.getByLabel('What to add for today').fill('Tutoring')
 await todayForm.getByLabel('Type').selectOption({label:'Lesson'})
 await todayForm.getByLabel('Time').fill('16:30')
 await todayForm.getByRole('button',{name:'Add',exact:true}).click()
 await todayCard.getByText('Tutoring').first().waitFor()
 if(process.env.KONO_SHOTS)await todayCard.screenshot({path:process.env.KONO_SHOTS+'/quick-day.png'})
 await todayForm.getByRole('button',{name:'Done'}).click()
 await tomorrowCard.getByRole('button',{name:'Add for tomorrow'}).click()
 const tomorrowForm=tomorrowCard.getByRole('form',{name:'Add for tomorrow'})
 await tomorrowForm.getByLabel('What to add for tomorrow').fill('Spanish quiz')
 assert.equal(await tomorrowForm.getByLabel('Type').evaluate(el=>el.options[el.selectedIndex].text),'Test','a quiz is a test')
 await tomorrowForm.getByRole('button',{name:'Add',exact:true}).click()
 await tomorrowCard.getByText('Spanish quiz').first().waitFor()
 assert.equal(await page.getByRole('dialog').count(),dialogs,'nothing pops up')
 await waitFor(()=>{const d=cloud.users.alice.plan.data;return d.tasks.some(t=>t.title==='Lab report'&&t.due==='2026-09-28')&&d.calendarEvents.some(e=>e.title==='Tutoring'&&e.kind==='lesson'&&e.date==='2026-09-28'&&e.time==='16:30'&&e.endTime==='17:30')&&d.exams.some(e=>e.title==='Spanish quiz'&&e.due==='2026-09-29')},'the three reach the account')
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
 const bar=page.getByRole('region',{name:'KONO today'}),face=cornerOf(page).getByRole('button',{name:'Pet KONO'})
 // Back after three hours: a wave hello.
 await bar.getByText('👋 Welcome back! KONO missed you.').waitFor()
 await bar.locator('.kono-react.is-wave').waitFor()
 await bar.getByText('👋 Welcome back! KONO missed you.').waitFor({state:'detached',timeout:8000})
 // Finish something, then tap KONO: a high five (once for it).
 await page.getByRole('region',{name:'Overdue'}).getByRole('button',{name:'Done: Read chapter 3'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.tasks.find(t=>t.title==='Read chapter 3')?.done===true,'finished')
 await page.waitForTimeout(600)
 // Pats happen in KONO's corner (tap KONO's face in the bar).
 await openCorner(page)
 await face.click()
 await bar.getByText('✋ High five! Nice work on Read chapter 3!').waitFor()
 await bar.locator('.kono-react.is-highfive').waitFor()
 // The Feed button says what this week's favorite is.
 await closeCorner(page)
 assert.match(await bar.locator('.kono-care .kono-feed').getAttribute('title'),/favorite this week/)
 await openCorner(page)
 await page.waitForTimeout(3800)
 // Three quick taps: a tickle. (force: each tap makes KONO hop, and waiting for the hop to settle can
 // stretch three taps past the 1.5 seconds a tickle needs on a busy machine.)
 for(let i=0;i<3;i++)await face.click({delay:20,force:true})
 await bar.getByText(/^(Hehe! That tickles!|Ahaha! Stop, stop!|KONO giggles and wiggles all over!)/).waitFor()
 await bar.locator('.kono-mood-face.is-tickle').waitFor()
 if(process.env.KONO_SHOTS)await bar.screenshot({path:process.env.KONO_SHOTS+'/kono-tickle.png'})
})

test('KONO on the island: when it is hungry and there is a snack it says so in a thought bubble, feeding it there (the snack drops in and gets eaten) clears it, and the meter shows +N',async({context,page})=>{
 const cloud=fakeCloud()
 await page.clock.setFixedTime(new Date('2026-09-30T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const care=page.getByRole('region',{name:'KONO today'}).getByRole('group',{name:'How KONO is doing'})
 await islandLoaded(page)
 await page.getByRole('region',{name:'Overdue'}).getByRole('button',{name:'Done: Read chapter 3'}).click()
 const full=Number(await care.getByRole('meter',{name:'Full'}).getAttribute('aria-valuenow'))
 assert.ok(full<40,'KONO starts out hungry here: '+full)
 const snack=await care.getByRole('button',{name:/^Feed KONO/}).locator('span[aria-hidden]').first().textContent()
 await page.locator(`.wb-island[data-kono-need="${snack}"]`).waitFor()
 if(process.env.KONO_SHOTS){await page.waitForTimeout(1500);await page.locator('.sanctuary-viewport').screenshot({path:process.env.KONO_SHOTS+'/kono-need.png'})}
 // (Phaser's tweens run on Date.now, so the clock has to move for the snack to drop.)
 if(process.env.KONO_SHOTS)await page.clock.setSystemTime(new Date('2026-09-30T15:00:05'))
 await care.getByRole('button',{name:/^Feed KONO/}).click()
 await care.locator('.kono-care-meter.is-full .kono-care-gain').waitFor({timeout:3000})
 if(process.env.KONO_SHOTS){await page.waitForTimeout(150);await page.locator('.sanctuary-viewport').screenshot({path:process.env.KONO_SHOTS+'/kono-feed-1.png'});await page.waitForTimeout(450);await page.locator('.sanctuary-viewport').screenshot({path:process.env.KONO_SHOTS+'/kono-feed-2.png'})}
 await page.locator(`.wb-island[data-kono-need="${snack}"]`).waitFor({state:'detached'})
})
test('Today view: the app’s Today shortcut opens just KONO and today’s list without loading the island, Open your island brings it back, and the Add shortcut opens ＋ Add',async({context,page})=>{
 const cloud=fakeCloud()
 await page.setViewportSize({width:390,height:844})
 await signInAs(context,cloud,'alice')
 await page.goto(BASE+'?view=today');await heading(page,'Sanctuary')
 await page.getByRole('region',{name:'Today view'}).waitFor()
 await page.getByRole('region',{name:'Your day'}).waitFor()
 await page.getByRole('region',{name:'KONO today'}).waitFor()
 assert.equal(await page.locator('.wb-island').count(),0,'no island in the Today view')
 assert.ok(!new URL(page.url()).searchParams.has('view'),'the shortcut flag is cleared from the address')
 await page.getByRole('button',{name:'Open your island'}).click()
 await page.locator('.wb-island').waitFor()
 assert.equal(await page.getByRole('region',{name:'Today view'}).count(),0)
 await page.goto(BASE+'?new=1');await heading(page,'Sanctuary')
 await page.getByRole('dialog',{name:'Add to your plan'}).waitFor()
})

test('Finishing something: the Done toast shows the snack it earned, and Feed KONO feeds that snack right away',async({context,page})=>{
 const cloud=fakeCloud(),pid=cloud.users.alice.plan.data.activeProfileId
 await page.clock.setFixedTime(new Date('2026-09-30T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await page.getByRole('region',{name:'Overdue'}).getByRole('button',{name:'Done: Read chapter 3'}).click()
 const toast=page.locator('.undo-toast')
 const id=cloud.users.alice.plan.data.tasks.find(t=>t.title==='Read chapter 3').id
 await toast.getByRole('button',{name:/^Feed KONO the .+ you earned$/}).click()
 await toast.waitFor({state:'detached'})
 await waitFor(()=>(cloud.users.alice.plan.data.konoCare?.[pid]?.log??[]).some(e=>e.kind==='feed'&&e.taskId===id),'the snack from that assignment was never eaten')
 await page.getByRole('region',{name:'KONO today'}).locator('p[aria-live]',{hasText:/^(Yum!|😍)/}).waitFor()
})

test('KONO’s corner: the snack tray feeds the snack you pick (a new kind goes in the snack book), Play with KONO opens a game, makes KONO happier and waits an hour, and KONO’s notes can be turned off',async({context,page})=>{
 const cloud=fakeCloud(),pid=cloud.users.alice.plan.data.activeProfileId
 await page.clock.setFixedTime(new Date('2026-09-30T15:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await page.getByRole('region',{name:'Overdue'}).getByRole('button',{name:'Done: Read chapter 3'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.tasks.find(t=>t.title==='Read chapter 3')?.done===true,'finished')
 const corner=await openCorner(page),tray=corner.getByRole('region',{name:'Snacks'})
 await tray.getByLabel('Snack book: 0 of 9 snacks tried').waitFor()
 const snack=tray.getByRole('button',{name:/^Feed KONO a /}).first()
 const name=(await snack.getAttribute('aria-label')).replace(/^Feed KONO a /,'').replace(/ \(its favorite this week\)|, \d+ left/g,'')
 await snack.click()
 await page.getByRole('region',{name:'KONO today'}).locator('p[aria-live]',{hasText:/^(Yum!|😍)/}).waitFor()
 await waitFor(()=>{const log=cloud.users.alice.plan.data.konoCare?.[pid]?.log??[];return log.some(e=>e.kind==='feed')&&log.some(e=>e.kind==='taste')},'the meal and the new snack never reached the account')
 await tray.getByLabel('Snack book: 1 of 9 snacks tried').waitFor()
 await page.getByRole('region',{name:'KONO today'}).locator('p[aria-live]',{hasText:'✨ New snack! '}).waitFor({timeout:12000})
 assert.ok(name.length>2,'picked '+name)
 // Play: once an hour.
 const happy=()=>corner.getByRole('meter',{name:'Happy'}).getAttribute('aria-valuenow').then(Number)
 const before=await happy()
 await corner.getByRole('button',{name:'Play with KONO'}).click()
 await corner.getByRole('region',{name:'Break games with KONO'}).waitFor()
 await waitFor(()=>(cloud.users.alice.plan.data.konoCare?.[pid]?.log??[]).some(e=>e.kind==='play'),'play time never reached the account')
 await page.waitForFunction(b=>Number(document.querySelector('.kono-corner [role=meter][aria-label=Happy]')?.getAttribute('aria-valuenow'))>b,before)
 await corner.getByRole('region',{name:'Break games with KONO'}).getByRole('button',{name:'Close'}).click()
 await corner.getByRole('button',{name:/^Play again at /}).waitFor()
 assert.equal(await corner.getByRole('button',{name:/Play again at/}).isDisabled(),true,'once an hour')
 if(process.env.KONO_SHOTS)await corner.screenshot({path:process.env.KONO_SHOTS+'/kono-corner-snacks.png'})
 await closeCorner(page)
 // KONO's notes: on by default, and can be turned off.
 await go(page,'Settings');await settingsTab(page,'Notifications')
 const notes=page.getByRole('checkbox',{name:/KONO’s notes/})
 assert.equal(await notes.isChecked(),true)
 await notes.uncheck()
 await waitFor(()=>cloud.users.alice.plan.data.settings.konoNotes===false,'the setting never reached the account')
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
 await care.locator('.kono-care-meter.is-full .kono-care-gain').filter({hasText:/^\+\d+$/}).waitFor({timeout:3000})
 await waitFor(()=>(cloud.users.alice.plan.data.konoCare?.[pid]?.log??[]).some(e=>e.kind==='feed'),'the feeding never reached the account')
 const fed=cloud.users.alice.plan.data.konoCare[pid].log.find(e=>e.kind==='feed')
 assert.equal(cloud.users.alice.plan.data.tasks.find(t=>t.id===fed.taskId)?.done,true,'KONO eats the snack from finished work')
 assert.ok(await value('Full')>fullBefore,'a snack fills KONO up')
 if(!snacksBefore)assert.equal(await feed.count(),0,'the one snack is eaten, so the chip goes away')
 await (await openCorner(page)).getByRole('button',{name:'Pet KONO'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.konoCare[pid].log.some(e=>e.kind==='pet'),'the pat never reached the account')
 // (Work was just finished, so this tap is a high five; it still counts as a pat.)
 await today.getByText(/KONO (giggles|leans|does a happy)|^✋ High five!/).waitFor()
 assert.ok(await value('Happy')>happyBefore,'pats and snacks make KONO happier')
 await cornerOf(page).getByRole('button',{name:'Pet KONO'}).click()
 await page.waitForTimeout(500)
 assert.equal(cloud.users.alice.plan.data.konoCare[pid].log.filter(e=>e.kind==='pet').length,1,'lots of taps still count as one pat for ten minutes')
 await closeCorner(page)
 assert.equal(await page.getByRole('dialog').count(),dialogsBefore,'caring for KONO never opens anything else')
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
 await (await openCorner(page)).getByRole('button',{name:'Pet KONO'}).click()
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
 // The fake clock runs every animation frame of those 25 minutes: keep the island (which pauses while
 // it's off screen) out of view, or the test spends minutes drawing it.
 await focus.evaluate(el=>el.scrollIntoView({block:'start'}))
 await page.waitForFunction(()=>(document.querySelector('.wb-island')?.getBoundingClientRect().bottom??0)<=0)
 await page.waitForTimeout(300)
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
test('Stamp card: a stamp for each day something gets finished; the 7th fills the card, KONO announces a present, and it can go on the island from Decorate › Presents',async({context,page})=>{
 const cloud=fakeCloud(),data=()=>cloud.users.alice.plan.data,pid=data().activeProfileId
 for(const e of data().exams)e.due='2026-10-20'
 Object.assign(data().sanctuaryProgress[pid].completionDates,{'2026-09-26':1,'2026-09-29':2,'2026-10-01':1,'2026-10-05':1,'2026-10-08':3})
 await page.clock.setFixedTime(new Date('2026-10-12T16:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const stampsButton=cornerOf(page).getByRole('button',{name:/^Stamp card: /})
 await openCorner(page)
 assert.equal(await stampsButton.getAttribute('aria-label'),'Stamp card: 6 of 7 stamps')
 await closeCorner(page)
 if(process.env.KONO_SHOTS){await page.getByRole('region',{name:'KONO today'}).screenshot({path:process.env.KONO_SHOTS+'/stamps-strip.png'});await page.setViewportSize({width:375,height:812});await page.waitForTimeout(400);await page.getByRole('region',{name:'KONO today'}).screenshot({path:process.env.KONO_SHOTS+'/stamps-strip-phone.png'});await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(300)}
 // Finishing something today is the 7th stamp: the card is full and KONO has a present.
 await page.getByRole('region',{name:'Overdue'}).getByRole('button',{name:'Done: Read chapter 3'}).click()
 const bar=page.getByRole('region',{name:'KONO today'})
 await bar.getByText('🎁 Your stamp card is full! KONO wrapped a present for you: a kite. It’s in Decorate › Presents.').waitFor({timeout:20000})
 await bar.locator('img.kono-find-icon').waitFor()
 await openCorner(page)
 assert.equal(await stampsButton.getAttribute('aria-label'),'Stamp card: 7 of 7 stamps')
 await stampsButton.click()
 const card=page.getByRole('group',{name:'Stamp card: 7 of 7 stamps'})
 await card.waitFor()
 assert.equal(await card.locator('li.is-stamped').count(),7)
 await page.getByText('(1 of 8 opened)',{exact:false}).waitFor()
 await page.locator('.build-palette').getByLabel('Balloons, locked. Opens with stamp card 2.').waitFor()
 if(process.env.KONO_SHOTS)await page.locator('.wb-island').screenshot({path:process.env.KONO_SHOTS+'/stamps-presents.png'})
 await page.locator('.build-palette').getByRole('button',{name:/^Add /}).first().click()
 await waitFor(()=>(data().sanctuaryDecor?.[pid]?.placements??[]).some(p=>p.assetId==='present-kite'),'the kite never went on the island')
 // Announced once: back again, no second announcement.
 await page.reload();await heading(page,'Sanctuary')
 await page.waitForTimeout(1500)
 assert.equal(await bar.getByText(/stamp card is full/).count(),0)
})
test('Bond hearts: KONO’s bond grows with what you do together; at 2 hearts a pat sends up a little heart, and reaching 3 brings a friendship gift for the island',async({context,page})=>{
 const cloud=fakeCloud(),data=()=>cloud.users.alice.plan.data,pid=data().activeProfileId
 for(const e of data().exams)e.due='2026-10-20'
 // 9 earlier days of caring for KONO (27) and one thing finished (1): 2 hearts, 2 short of the 3rd.
 data().konoCare={...data().konoCare,[pid]:{profileId:pid,log:Array.from({length:9},(_,i)=>({id:'bond-2026-09-1'+i,kind:'bond',at:'2026-09-1'+i+'T12:00:00.000Z'}))}}
 await page.clock.setFixedTime(new Date('2026-10-12T16:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const bar=page.getByRole('region',{name:'KONO today'})
 // Today's first pat marks a day of care (+3): the 3rd heart.
 await (await openCorner(page)).getByRole('button',{name:'Pet KONO'}).click()
 await bar.getByText(/^💗 (KONO snuggles closer|KONO beams at you|A happy little heart floats up)/).waitFor()
 await bar.locator('.kono-react.is-heart').waitFor()
 await bar.getByText('💗 You and KONO are now Pals! KONO made you a heart cushion. It’s in Decorate › Presents.').waitFor({timeout:20000})
 await waitFor(()=>(data().konoCare?.[pid]?.log??[]).some(e=>e.id==='bond-2026-10-12'),'the day of care never reached the account')
 if(process.env.KONO_SHOTS)await bar.screenshot({path:process.env.KONO_SHOTS+'/bond-bar.png'})
 await (await openCorner(page)).getByRole('button',{name:/^Stamp card: /}).click()
 await page.getByRole('group',{name:'Bond with KONO: 3 of 10 hearts, Pals'}).waitFor()
 await page.getByText('(1 of 8)',{exact:false}).waitFor()
 await page.locator('.build-palette').getByLabel('Heart lantern, locked. A friendship gift at 4 hearts.').waitFor()
 if(process.env.KONO_SHOTS)await page.locator('.build-palette').evaluate(e=>e.closest('.wb-island,.wb-sanctuary-stage')?.scrollIntoView()).then(()=>page.screenshot({path:process.env.KONO_SHOTS+'/bond-presents.png'}))
 await page.locator('.build-palette').getByRole('button',{name:'Add Heart cushion'}).click()
 await waitFor(()=>(data().sanctuaryDecor?.[pid]?.placements??[]).some(p=>p.assetId==='gift-cushion'),'the cushion never went on the island')
})
test('Break games: after a focus session KONO offers the arcade’s games for a break; one plays full screen and ends on its results, and the games stop when the five-minute break is over',async({context,page})=>{
 const cloud=fakeCloud()
 await page.clock.install({time:new Date('2026-09-15T15:00:00')})
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const outer=page.locator('details.sanctuary-focus')
 await outer.locator(':scope > summary').click()
 const focus=outer.locator('details.focus-session')
 await focus.locator(':scope > summary').click()
 assert.equal(await focus.getByRole('button',{name:/Break game with KONO/}).count(),0,'no games while studying')
 await focus.getByLabel('Minutes').fill('0');await focus.getByLabel('Seconds').fill('5')
 await focus.getByRole('button',{name:'Start timer'}).click()
 await page.clock.runFor(8000)
 await focus.getByText('Session complete. Take a short break.').waitFor()
 await focus.getByRole('button',{name:'🎮 Break game with KONO'}).click()
 const games=focus.getByRole('region',{name:'Break games with KONO'})
 await games.getByRole('timer',{name:'Break time left'}).filter({hasText:'Break: 5:00'}).waitFor()
 // The break offers the arcade's games (Snack catch and Peekaboo are gone): KONO blast plays full screen,
 // and ■ End shows its results card; Done slides it away.
 assert.equal(await games.getByRole('button',{name:/Snack catch|Peekaboo/}).count(),0)
 await games.getByRole('button',{name:/Candy crush/}).waitFor()
 await games.getByRole('button',{name:/KONO blast/}).click()
 await startGame(page,'🧱 KONO blast')
 await page.getByRole('dialog',{name:'🧱 KONO blast'}).getByRole('button',{name:'■ End'}).click()
 await page.getByRole('dialog',{name:'🧱 KONO blast'}).getByRole('region',{name:'Results'}).getByRole('button',{name:'Done'}).click()
 await page.getByRole('dialog',{name:'🧱 KONO blast'}).waitFor({state:'detached'})
 await games.getByText(/^KONO blast: \d+ points?! 🧱/).first().waitFor()
 if(process.env.KONO_SHOTS)await games.screenshot({path:process.env.KONO_SHOTS+'/break-games.png'})
 // The break ends after five minutes (jumped to, rather than stepped through frame by frame).
 await page.clock.fastForward(5*60_000);await page.clock.runFor(1500)
 await games.getByText('That was a nice reset! KONO’s ready for the next session when you are. 📚').waitFor()
 assert.equal(await games.getByRole('button',{name:/KONO blast/}).count(),0,'no more games after the break')
 await games.getByRole('button',{name:'Close'}).click()
 assert.equal(await focus.getByRole('region',{name:'Break games with KONO'}).count(),0)
})
test('Planner daily page matches Today’s schedule: the day’s classes as compact cards, the rest under "Also today", ‹ › to step days, and "Back to today" only once you’ve moved away',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.calendarEvents.push({id:'soccer',profileId:pid,title:'Soccer practice',date:'2026-09-28',time:'17:00',kind:'personal',done:false,notes:''})
 await page.clock.setFixedTime(new Date('2026-09-28T08:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const sanctuaryClass=await page.locator('.today-card .today-schedule-list > *').first().getAttribute('class')
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

test('Family plans: a parent makes a kid’s own plan from Kids, the kid’s plan has no parent tools, one tap locks the device to it (no Settings, no switching) and one tap unlocks it; an optional parent PIN makes unlocking need the PIN',async({context,page})=>{
 const cloud=fakeCloud()
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await go(page,'Kids')
 await page.getByRole('button',{name:'Make Emma’s plan'}).click()
 await heading(page,'Sanctuary')
 await waitFor(()=>cloud.users.alice.plan.data.profiles.some(p=>p.kidId==='kid-emma'&&p.label==='Emma’s plan'),'Emma’s plan never reached the account')
 const emmaPlan=()=>cloud.users.alice.plan.data.profiles.find(p=>p.kidId==='kid-emma')
 await page.getByRole('button',{name:'Whose plan?'}).first().waitFor()
 assert.equal(await page.locator('nav button:visible, nav a:visible').filter({hasText:'Kids'}).count(),0,'no Kids tab in a kid’s plan')
 // Whose plan?: the parent's plan and each kid's.
 await page.getByRole('button',{name:'Whose plan?'}).first().click()
 const sheet=page.getByRole('dialog',{name:'Whose plan?'})
 await sheet.getByRole('button',{name:/My study plan/}).waitFor()
 await sheet.getByRole('button',{name:/Leo’s plan/}).waitFor()
 // Hand it to Emma: one tap locks, one tap unlocks (no PIN set).
 await sheet.getByRole('button',{name:/^🔒 Lock to/}).click()
 await sheet.waitFor({state:'detached'})
 assert.equal(await page.locator('nav button:visible, nav a:visible').filter({hasText:'Settings'}).count(),0,'no Settings while locked')
 await page.getByRole('button',{name:'Whose plan?'}).first().click()
 await sheet.getByText('This device is set to',{exact:false}).waitFor()
 await sheet.getByRole('button',{name:'🔓 Unlock'}).click()
 await sheet.getByRole('button',{name:/My study plan/}).waitFor()
 // With a parent PIN, unlocking needs it.
 await sheet.getByRole('button',{name:'Add a parent PIN'}).click()
 await sheet.getByLabel('New parent PIN').fill('2468')
 await sheet.getByRole('button',{name:'Save PIN'}).click()
 await sheet.getByRole('button',{name:/^🔒 Lock to/}).click()
 await sheet.waitFor({state:'detached'})
 assert.equal(await page.locator('nav button:visible, nav a:visible').filter({hasText:'Settings'}).count(),0,'no Settings while locked')
 await page.getByRole('button',{name:'Whose plan?'}).first().click()
 await sheet.getByText('This device is set to',{exact:false}).waitFor()
 assert.equal(await sheet.getByRole('button',{name:/My study plan/}).count(),0,'no switching while locked')
 await sheet.getByLabel('Parent PIN').fill('1111');await sheet.getByRole('button',{name:'Unlock'}).click()
 await sheet.getByText('That PIN isn’t right.').waitFor()
 await sheet.getByLabel('Parent PIN').fill('2468');await sheet.getByRole('button',{name:'Unlock'}).click()
 await sheet.getByRole('button',{name:/My study plan/}).click()
 await page.locator('nav button:visible, nav a:visible').filter({hasText:'Kids'}).first().waitFor()
 assert.match(cloud.users.alice.plan.data.settings.parentPin,/^[0-9a-f]{64}$/,'only the PIN’s hash is saved')
})

test('Family plan: Emma’s own plan shows in the parent’s Home and Planner as hers, names tap on and off, Kids today sums each kid up, an event for Emma lands in her plan, “Who’s using KONO?” opens a shared device on the right plan, plans can be renamed and the family plan can be another plan; tapping a name shows only theirs; an event can be for two kids and shows in each kid’s plan',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 await page.clock.setFixedTime(new Date('2026-10-13T08:00:00')) // a Tuesday
 d.profiles.push({id:'plan-emma',name:'Emma',label:'Emma’s plan',kind:'school',start:'2026-09-01',end:'2027-06-30',kidId:'kid-emma'})
 d.profiles.push({id:'plan-work',name:'Alice',label:'Work',kind:'custom',start:'2026-09-01',end:'2027-06-30'})
 d.tasks.push({id:'emma-hw',profileId:'plan-emma',subjectId:'',title:'Spelling list',due:'2026-10-13',done:false,notes:''},{id:'leo-hw',profileId:pid,subjectId:'',kidId:'kid-leo',title:'Science poster',due:'2026-10-13',done:false,notes:''},{id:'mine',profileId:pid,subjectId:'',title:'Pay school fees',due:'2026-10-13',done:false,notes:''},{id:'emma-due',profileId:'plan-emma',subjectId:'',title:'Book report',due:'2026-10-14',done:false,notes:''})
 d.exams.push({id:'emma-test',profileId:'plan-emma',subjectId:'',title:'Fractions quiz',due:'2026-10-15',done:false,notes:''})
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 // Kids today (on the Kids page): each kid at a glance.
 await go(page,'Kids')
 const glance=page.getByRole('region',{name:'Your kids'})
 await glance.getByRole('button',{name:/Open Emma’s plan/}).waitFor()
 const emmaRow=glance.getByRole('listitem').filter({hasText:'Emma'})
 assert.match(await emmaRow.innerText(),/1 due:/i);assert.match(await emmaRow.innerText(),/Fractions quiz/)
 await go(page,'Sanctuary')
 // Home's day: Emma's homework (from her plan), Leo's and mine; names tap off and on.
 const day=page.getByRole('region',{name:'Your day'}),people=page.getByRole('region',{name:'Family schedule'}).getByRole('group',{name:'Whose things to show'}),also=day.locator('.tomorrow-extra-list').filter({hasText:'Also today'})
 for(const title of ['Spelling list','Science poster','Pay school fees'])await also.getByText(title,{exact:true}).waitFor()
 // Tap a name: only theirs. Tap it again: everyone. "Me" goes by the plan's name (Alice).
 await people.getByRole('button',{name:/Emma/}).click()
 await also.getByText('Pay school fees',{exact:true}).waitFor({state:'detached'})
 await also.getByText('Science poster',{exact:true}).waitFor({state:'detached'})
 await also.getByText('Spelling list',{exact:true}).waitFor()
 assert.equal(await people.getByRole('button',{name:'Alice'}).getAttribute('aria-pressed'),'false')
 await people.getByRole('button',{name:'Alice'}).click()
 await also.getByText('Spelling list',{exact:true}).waitFor({state:'detached'})
 await also.getByText('Pay school fees',{exact:true}).waitFor()
 await people.getByRole('button',{name:'Alice'}).click()
 await also.getByText('Spelling list',{exact:true}).waitFor()
 assert.equal(await people.getByRole('button',{name:'Everyone'}).getAttribute('aria-pressed'),'true')
 // Past events (the fixture's soccer game and dentist) aren't a backlog of things to complete.
 assert.equal(await day.locator('.today-card-reminders').count(),0,'no overdue events')
 // Planner: the same names; an event for Emma goes into her plan.
 await go(page,'Planner')
 await page.getByRole('group',{name:'Whose things to show'}).waitFor()
 await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Day',exact:true}).click()
 await page.getByRole('button',{name:/^Add at 4:00 PM on/}).click()
 const add=page.getByRole('dialog',{name:/^Add for/})
 const forWho=add.getByRole('group',{name:'Who’s it for?'})
 assert.equal(await forWho.getByRole('checkbox',{name:'🦄 Emma'}).isChecked(),true)
 await add.getByLabel('What is it?').fill('Dentist')
 await add.getByRole('button',{name:'Add'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.calendarEvents.some(e=>e.title==='Dentist'&&e.profileId==='plan-emma'&&!e.kidId),'Emma’s event never landed in her plan')
 // Two people on one event: it stays on the family calendar, tagged to both.
 await page.getByRole('button',{name:/^Add at 6:00 PM on/}).click()
 await forWho.getByRole('checkbox',{name:'Leo'}).check()
 await add.getByLabel('What is it?').fill('Movie night')
 await add.getByRole('button',{name:'Add'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.calendarEvents.some(e=>e.title==='Movie night'&&e.profileId===pid&&JSON.stringify(e.kidIds)==='["kid-emma","kid-leo"]'),'Movie night never got both names')
 assert.match(await page.locator('.wb-family-event').filter({hasText:'Movie night'}).first().innerText(),/Emma & Leo/i)
 // Who's using KONO: turned on for this device, then asked when KONO opens.
 await page.getByRole('button',{name:'Whose plan?'}).first().click()
 const sheet=page.getByRole('dialog',{name:'Whose plan?'})
 assert.match(await sheet.getByRole('button',{name:/My study plan/}).innerText(),/Family plan/)
 // Rename plans and pick the family plan, right in the sheet.
 await sheet.getByText(/^✎ Rename plans/).click()
 await sheet.getByLabel('Kid’s name · Emma’s plan').fill('Em')
 await sheet.getByRole('listitem').filter({has:page.getByLabel('Kid’s name · Emma’s plan')}).getByRole('button',{name:'Save'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.kids.find(k=>k.id==='kid-emma')?.name==='Em'&&cloud.users.alice.plan.data.profiles.find(p=>p.id==='plan-emma').label==='Em’s plan','renaming Emma never reached the account')
 await sheet.getByLabel('Whose plan · My study plan').fill('Mom')
 await sheet.getByLabel('Plan name · My study plan').fill('Our family')
 await sheet.getByRole('listitem').filter({has:page.getByLabel('Plan name · My study plan')}).getByRole('button',{name:'Save'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.profiles.find(p=>p.id===pid).label==='Our family','renaming my plan never reached the account')
 await sheet.getByLabel('Ask “Who’s using KONO?” when it opens on this device').check()
 await sheet.getByRole('button',{name:'Close'}).click()
 const fresh=await context.newPage();await fresh.clock.setFixedTime(new Date('2026-10-13T08:00:00'))
 await fresh.goto(BASE)
 const who=fresh.getByRole('dialog',{name:'Who’s using KONO?'})
 await who.getByRole('button',{name:/^Em\b/}).click()
 await fresh.getByRole('button',{name:'Whose plan?'}).first().waitFor()
 await fresh.locator('.tomorrow-extra-list').getByText('Spelling list',{exact:true}).waitFor()
 // Emma's plan also shows what the family plan has for her: Movie night (with Leo).
 await fresh.getByRole('region',{name:'Your day'}).getByText('Movie night').first().waitFor()
 assert.equal(await fresh.getByRole('region',{name:'Your kids'}).count(),0,'Emma’s plan has no parent tools')
 // The family plan can be another of my plans: the kids go with it.
 await page.getByRole('button',{name:'Whose plan?'}).first().click()
 await sheet.getByText(/^✎ Rename plans/).click()
 await sheet.getByRole('group',{name:/Family plan/}).getByLabel('⭐ Work').check()
 await waitFor(()=>cloud.users.alice.plan.data.kids.every(k=>k.profileId==='plan-work'),'the kids never moved to the Work plan')
 assert.match(await sheet.getByRole('button',{name:/^Work/}).innerText(),/Family plan/)
})

test('Plans & account: deleting the family plan keeps the kids (they move to the other plan), and Start over clears everything after typing START OVER',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 d.profiles.push({id:'plan-work',name:'Alice',label:'Work',kind:'custom',start:'2026-09-01',end:'2027-06-30'})
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await go(page,'Settings')
 await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Plans & account'}).click()
 await page.locator('summary').filter({hasText:'Delete a plan'}).click()
 await page.locator('.profile-delete-list .wb-toolbar').filter({hasText:'My study plan'}).getByRole('button',{name:'Delete plan'}).click()
 await page.getByRole('dialog',{name:'Confirm change'}).getByRole('button',{name:'Confirm'}).click()
 await waitFor(()=>{const p=cloud.users.alice.plan.data;return !p.profiles.some(x=>x.id===pid)&&p.kids.length===2&&p.kids.every(k=>k.profileId==='plan-work')},'deleting the family plan never reached the account, or the kids were lost')
 if(!await page.getByText('Start over (delete everything)').count()){await go(page,'Settings');await page.getByRole('navigation',{name:'Settings sections'}).getByRole('button',{name:'Plans & account'}).click()}
 await page.getByText('Start over (delete everything)').click()
 const start=page.locator('form.start-over')
 const button=start.getByRole('button',{name:'Delete everything and start over'})
 assert.equal(await button.isDisabled(),true,'not until START OVER is typed')
 await start.getByLabel('Type START OVER to confirm').fill('start over')
 await button.click()
 await waitFor(()=>{const p=cloud.users.alice.plan.data;return p.profiles.length===1&&p.kids.length===0&&p.tasks.length===0&&p.profiles[0].label==='My study plan'},'Start over never reached the account')
})

test('Family extras: a family to-do list, a snack with a note for a kid’s KONO, a practice every Tue & Thu with who’s driving, and Pickups for the week',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 await page.clock.setFixedTime(new Date('2026-10-13T08:00:00')) // a Tuesday
 d.profiles.push({id:'plan-emma',name:'Emma',label:'Emma’s plan',kind:'school',start:'2026-09-01',end:'2027-06-30',kidId:'kid-emma'})
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 // Family to-do: added for Leo, checked off.
 const todos=page.getByRole('region',{name:'Family to-do'})
 await todos.getByLabel('New family to-do').fill('Buy poster board')
 await todos.getByLabel('For').selectOption({label:'Leo'})
 await todos.getByRole('button',{name:'Add'}).click()
 await waitFor(()=>(cloud.users.alice.plan.data.familyTodos??[]).some(t=>t.title==='Buy poster board'&&t.forKidId==='kid-leo'),'the to-do never reached the account')
 await todos.getByRole('checkbox',{name:/Buy poster board/}).check()
 await waitFor(()=>cloud.users.alice.plan.data.familyTodos.find(t=>t.title==='Buy poster board').done,'checking it off never reached the account')
 // A snack with a note for Emma's KONO.
 await go(page,'Kids')
 await page.getByRole('region',{name:'Your kids'}).getByRole('button',{name:'Send Emma’s KONO a snack'}).click()
 const giftSheet=page.getByRole('dialog',{name:/A treat for Emma/})
 await giftSheet.getByLabel('Note for Emma').fill('So proud of you!')
 await giftSheet.getByRole('button',{name:/Send to Emma/}).click()
 await waitFor(()=>(cloud.users.alice.plan.data.konoCare?.['plan-emma']?.log??[]).some(e=>e.kind==='gift'&&e.note==='So proud of you!'&&e.from==='Alice'),'the gift never reached Emma’s plan')
 // Soccer for Leo every Tuesday and Thursday, Dad driving.
 await go(page,'Planner')
 await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Day',exact:true}).click()
 await page.getByRole('button',{name:/^Add at 4:00 PM on/}).click()
 const add=page.getByRole('dialog',{name:/^Add for/}),forWho=add.getByRole('group',{name:'Who’s it for?'})
 await forWho.getByRole('checkbox',{name:'🦄 Emma'}).uncheck();await forWho.getByRole('checkbox',{name:'Leo'}).check()
 await add.getByLabel('Type').selectOption('sports')
 await add.getByLabel('What is it?').fill('Soccer practice')
 await add.getByLabel('Who’s driving? (optional)').fill('Dad')
 const repeat=add.getByRole('group',{name:/Repeats every/})
 await repeat.getByText('Tue',{exact:true}).click();await repeat.getByText('Thu',{exact:true}).click()
 await repeat.getByLabel('Until').fill('2026-10-29')
 await add.getByRole('button',{name:'Add'}).click()
 await waitFor(()=>{const list=cloud.users.alice.plan.data.calendarEvents.filter(e=>e.title==='Soccer practice');return list.length===6&&list.every(e=>e.driver==='Dad'&&e.kidId==='kid-leo'&&e.recurringId===list[0].recurringId)},'the practices weren’t saved as a Tue/Thu series with Dad driving')
 // Pickups: the week, with who's driving.
 await plannerMenu(page,'🚗 Pickups & drop-offs')
 const pickups=page.getByRole('dialog',{name:'Pickups & drop-offs'})
 assert.match(await pickups.getByRole('region',{name:'Today'}).innerText(),/Soccer practice[\s\S]*Leo[\s\S]*🚗 Dad/)
 await pickups.getByRole('button',{name:'Close dialog'}).click()
 // On Emma's plan, KONO says who sent the snack and the note.
 await page.getByRole('button',{name:'Whose plan?'}).first().click()
 await page.getByRole('dialog',{name:'Whose plan?'}).getByRole('button',{name:/Emma’s plan/}).click()
 await page.getByText('Alice sent KONO',{exact:false}).first().waitFor()
 assert.match(await page.getByText('Alice sent KONO',{exact:false}).first().innerText(),/So proud of you!/)
})

test('Family wall calendar: Today sums up the day; Month shows each person’s things as pills in their color, a pill drags to another day with Undo; the wall display shows today and tomorrow; homework repeats every week and a change goes to the whole series; a kid gets an avatar from the grid',async()=>{
 const {context,page}=await freshPage()
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 d.calendarEvents.push({id:'e-soccer',profileId:pid,title:'Soccer practice',date:'2026-10-13',time:'16:00',endTime:'17:30',kind:'sports',done:false,notes:'',kidId:'kid-emma'})
 d.exams.push({id:'x-sci',profileId:pid,subjectId:'',title:'Science quiz',due:'2026-10-16',done:false,notes:'',kidId:'kid-emma'})
 // A clock that runs from 3:30 PM: a frozen one would end the Undo toast's timer at once.
 await page.clock.install({time:new Date('2026-10-13T15:30:00')});await signInAs(context,cloud,'alice')
 await page.setViewportSize({width:1280,height:900});await page.goto(BASE);await heading(page,'Sanctuary')
 // Today at a glance: the next test this week and the next thing on the clock.
 const glance=page.getByLabel('Today at a glance')
 await glance.getByText('Science quiz Friday').waitFor()
 await glance.getByText('Soccer practice at 4:00 PM').waitFor()
 // Month: Emma's practice is a pill on the 13th; dragged to the 15th it moves, and Undo puts it back.
 await go(page,'Planner')
 await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Month'}).click()
 const pill=page.getByRole('button',{name:'Soccer practice · 4p · Emma · Oct 13, 2026'})
 await pill.waitFor()
 await dragOnto(page,pill,page.getByRole('button',{name:/^Oct 15, 2026 · /}))
 await page.getByRole('button',{name:'Soccer practice · 4p · Emma · Oct 15, 2026'}).waitFor()
 const toast=page.locator('.undo-toast');await toast.getByText('Moved “Soccer practice” to Oct 15, 2026.').waitFor()
 await toast.getByRole('button',{name:'Undo'}).click()
 await pill.waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.calendarEvents.find(e=>e.id==='e-soccer')?.date==='2026-10-13','Undo never put the practice back')
 // Tapping a pill opens it.
 await pill.click();await page.getByRole('dialog',{name:'Edit event'}).getByRole('button',{name:'Cancel'}).click()
 // Wall display: big, today and tomorrow, with whose each thing is.
 await page.getByRole('button',{name:/Wall display/}).click()
 const wall=page.getByRole('dialog',{name:'Wall display'}),today=wall.getByRole('region',{name:'Today'})
 await today.getByText('Soccer practice').waitFor()
 assert.match(await today.locator('.wall-item').filter({hasText:'Soccer practice'}).innerText(),/4:00 PM[\s\S]*Emma/)
 await wall.getByRole('region',{name:'Tomorrow'}).waitFor()
 await page.keyboard.press('Escape');await wall.waitFor({state:'detached'})
 // Homework every week until Nov 3: one per week, linked; renaming one can rename them all.
 await addFromMenu(page,'tasks','Spelling words',async editor=>{
  await editor.getByLabel('Repeat').selectOption('weekly')
  await editor.getByLabel('Until').fill('2026-11-03')
  await editor.getByText('Adds 3 more, one per date').waitFor()
 })
 const spelling=()=>cloud.users.alice.plan.data.tasks.filter(t=>/^Spelling/.test(t.title))
 await waitFor(()=>spelling().length===4&&new Set(spelling().map(t=>t.recurringId)).size===1&&!!spelling()[0].recurringId,'the weekly homework never reached the account as one series')
 assert.deepEqual(spelling().map(t=>t.due).sort(),['2026-10-13','2026-10-20','2026-10-27','2026-11-03'])
 await go(page,'Planner');await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Month'}).click()
 await page.getByRole('button',{name:'Spelling words · Oct 20, 2026'}).click()
 const series=page.getByRole('dialog',{name:'Edit assignment'})
 await series.getByText('This repeats (4 dates). Save changes to:').waitFor()
 await series.getByLabel('Title').fill('Spelling test words')
 await series.getByLabel('All of them').check()
 await series.getByRole('button',{name:'Save',exact:true}).click()
 await waitFor(()=>spelling().every(t=>t.title==='Spelling test words'),'the change never reached the whole series')
 // Kids' appearance: Emma picks the panda from the avatar grid.
 await go(page,'Settings');await settingsTab(page,'Family')
 await page.getByRole('button',{name:/Kids' appearance/}).first().click()
 const look=page.getByRole('dialog',{name:"Kids' appearance"})
 await look.getByRole('tab',{name:/Emma/}).click()
 await look.getByRole('group',{name:"Emma's avatar"}).getByRole('button',{name:'Avatar 🐼'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.kids.find(k=>k.id==='kid-emma')?.emoji==='🐼','Emma’s avatar never reached the account')
 await context.close()
})

test('Family calendar extras: a birthday comes back every year and a countdown counts down (Planner, Home), one typed line makes a repeating event for a kid at a place, an event shows where it is and when to leave, and a view-only link for grandparents can be made and turned off',async()=>{
 const {context,page}=await freshPage()
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 d.calendarEvents.push({id:'e-soccer',profileId:pid,title:'Soccer practice',date:'2026-10-15',time:'16:00',endTime:'17:30',kind:'sports',done:false,notes:'',kidId:'kid-emma',location:'Riverside Park',travelMinutes:20})
 await page.clock.install({time:new Date('2026-10-15T15:00:00')});await signInAs(context,cloud,'alice')
 await page.setViewportSize({width:1280,height:900});await page.goto(BASE);await heading(page,'Sanctuary')
 // Birthdays & countdowns, from the Planner's ⋯ menu.
 await go(page,'Planner')
 await plannerMenu(page,'🎂 Birthdays & countdowns')
 const panel=page.getByRole('dialog',{name:'Birthdays & countdowns'})
 await panel.getByLabel('Whose (optional)').selectOption({label:'🦄 Emma'})
 assert.equal(await panel.getByLabel('Name').inputValue(),'Emma','picking a kid fills in their name')
 await panel.getByLabel('Birthday (with the year they were born)').fill('2017-10-18')
 await panel.getByRole('button',{name:'Add birthday'}).click()
 await panel.getByRole('list',{name:'Your birthdays and countdowns'}).getByText('Emma’s birthday').waitFor()
 await panel.getByRole('group',{name:'Kind'}).getByRole('button',{name:/Countdown/}).click()
 await panel.getByLabel('What’s coming').fill('Disney trip')
 await panel.getByLabel('Date').fill('2026-12-20')
 await panel.getByRole('button',{name:'Add countdown'}).click()
 await panel.getByText('Disney trip').waitFor()
 await waitFor(()=>{const x=cloud.users.alice.plan.data.specialDays??[];return x.length===2&&x.some(s=>s.kind==='birthday'&&s.kidId==='kid-emma'&&s.date==='2017-10-18')&&x.some(s=>s.kind==='countdown'&&s.title==='Disney trip')},'the birthday and countdown never reached the account')
 await panel.getByRole('button',{name:'Close dialog'}).click()
 await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Month'}).click()
 await page.getByRole('button',{name:'Emma’s birthday (9) · Oct 18, 2026'}).waitFor()
 // The event's place and when to leave, on its card.
 const soccer=page.locator('.wb-family-event').filter({hasText:'Soccer practice'}).first()
 await soccer.getByRole('link',{name:'Riverside Park'}).waitFor()
 assert.match(await soccer.getByRole('link',{name:'Riverside Park'}).getAttribute('href'),/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Riverside%20Park$/)
 await soccer.getByText('Leave by 3:40 PM').waitFor()
 // Home › Coming up.
 await go(page,'Sanctuary')
 const coming=page.getByRole('region',{name:'Coming up'})
 assert.match(await coming.innerText(),/Emma’s birthday \(9\)\s*3 days/)
 // One typed line: a practice for Leo every Mon and Wed at the Y.
 await page.getByRole('button',{name:'＋ Add',exact:true}).click()
 const add=page.getByRole('dialog',{name:'Add to your plan'})
 await add.getByLabel('Type it').fill('swim practice every Mon and Wed 5:30-6:30pm for Leo at the Y')
 await add.getByText(/Every Mon & Wed, from Mon, Oct 19/).waitFor()
 await add.getByRole('button',{name:'Add',exact:true}).click()
 await waitFor(()=>{const list=cloud.users.alice.plan.data.calendarEvents.filter(e=>e.title==='Swim practice');return list.length>4&&list.every(e=>e.kidId==='kid-leo'&&e.location==='The Y'&&e.time==='17:30'&&e.endTime==='18:30'&&e.recurringId===list[0].recurringId)&&list.map(e=>new Date(e.date+'T12:00:00').getDay()).every(x=>x===1||x===3)},'the typed practice never reached the account as a Mon & Wed series for Leo')
 // A view-only link for grandparents, which can be turned off.
 await go(page,'Settings');await settingsTab(page,'Family')
 const share=page.getByRole('region',{name:'Share with grandparents'})
 await share.getByRole('button',{name:'Make a view-only link'}).click()
 const link=share.getByLabel('View-only link');await link.waitFor()
 assert.match(await link.inputValue(),/\/api\/family\?t=(ab12){12}&tz=/)
 assert.equal(cloud.feeds.length,1);assert.equal(cloud.feeds[0].profile_id,pid+'#family','its own link, separate from the calendar app link')
 page.once('dialog',dialog=>void dialog.accept())
 await share.getByRole('button',{name:'Turn off link'}).click()
 await share.getByRole('button',{name:'Make a view-only link'}).waitFor()
 assert.equal(cloud.feeds.length,0)
 await context.close()
})

test('Family setup: a parent picks “My family” when starting, adds two kids and their weekly activities in a few lines, and KONO warns when something new clashes with them',async()=>{
 const {context,page}=await freshPage()
 const cloud=fakeCloud()
 await page.clock.install({time:new Date('2026-10-15T15:00:00')});await signInAs(context,cloud,'dave')
 await page.setViewportSize({width:1280,height:900});await page.goto(BASE)
 await page.getByLabel('Your name').fill('Dana')
 await page.getByRole('radio',{name:/My family/}).check()
 assert.equal(await page.getByLabel('Plan name').inputValue(),'Our family')
 await page.getByRole('checkbox',{name:/13 or older/}).check()
 await page.getByRole('button',{name:'Create our family plan'}).click()
 const setup=page.getByRole('dialog',{name:'Set up your family'})
 for(const kid of ['Emma','Leo']){await setup.getByLabel('Kid’s name').fill(kid);await setup.getByRole('button',{name:'Add',exact:true}).click()}
 await setup.getByRole('list',{name:'Kids'}).getByText('Leo').waitFor()
 await setup.getByRole('button',{name:'Next'}).click()
 await setup.getByLabel('Add an activity for Emma').fill('soccer every Tue and Thu 4-5:30pm at Riverside Park')
 await setup.getByRole('region',{name:'Emma’s activities'}).getByRole('button',{name:'Add',exact:true}).click()
 await setup.getByRole('region',{name:'Emma’s activities'}).getByText(/Soccer · Every Tue & Thu · 4:00 PM–5:30 PM · 📍 Riverside Park/).waitFor()
 await setup.getByLabel('Add an activity for Leo').fill('piano every Wed 4pm')
 await setup.getByRole('region',{name:'Leo’s activities'}).getByRole('button',{name:'Add',exact:true}).click()
 await setup.getByRole('button',{name:'Finish'}).click()
 await setup.getByRole('status').filter({hasText:/2 kids and 2 activities \(\d+ dates on the calendar\) added\./}).waitFor()
 await waitFor(()=>{const d=cloud.users.dave.plan.data;if(!d)return false;const emma=d.kids.find(k=>k.name==='Emma'),leo=d.kids.find(k=>k.name==='Leo');const soccer=d.calendarEvents.filter(e=>e.title==='Soccer'),piano=d.calendarEvents.filter(e=>e.title==='Piano');return d.settings.parentMode===true&&emma&&leo&&soccer.length>4&&soccer.every(e=>e.kidId===emma.id&&e.location==='Riverside Park'&&e.time==='16:00')&&piano.length>2&&piano.every(e=>e.kidId===leo.id)},'the kids and their activities never reached the account')
 await setup.getByRole('button',{name:'Done'}).click()
 // Something new that overlaps Emma's soccer gets a heads-up before it's added.
 await page.getByRole('button',{name:'＋ Add',exact:true}).click()
 const add=page.getByRole('dialog',{name:'Add to your plan'})
 await add.getByLabel('Type it').fill('dentist tuesday 4:30pm for Emma')
 await add.getByText('Emma already has Soccer at 4:00 PM–5:30 PM.').waitFor()
 await add.getByLabel('Type it').fill('dentist tuesday 9am for Emma')
 assert.equal(await add.locator('.clash-warning').count(),0,'no clash in the morning')
 await context.close()
})

test('Wall display at night: after 8 PM it dims and leads with tomorrow, the Day/Night button switches by hand and is remembered on that tablet, and a wide screen shows the rest of the week',async()=>{
 const {context,page}=await freshPage({viewport:{width:1440,height:900}})
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 d.calendarEvents.push({id:'e-tmw',profileId:pid,title:'Field trip',date:'2026-10-16',time:'08:00',kind:'activity',done:false,notes:'',kidId:'kid-emma'},{id:'e-sat',profileId:pid,title:'Pumpkin patch',date:'2026-10-17',time:'10:00',kind:'personal',done:false,notes:''})
 await page.clock.install({time:new Date('2026-10-15T21:30:00')});await signInAs(context,cloud,'alice')
 await page.goto(BASE+'?wall')
 const wall=page.getByRole('dialog',{name:'Wall display'});await wall.waitFor()
 assert.match(await wall.getAttribute('class'),/is-night/)
 assert.equal(await wall.locator('.wall-day').first().getAttribute('aria-label'),'Tomorrow','at night tomorrow comes first')
 await wall.getByRole('region',{name:'Tomorrow'}).getByText('Field trip').waitFor()
 await wall.getByRole('region',{name:'Rest of the week'}).getByText('Pumpkin patch').waitFor()
 const toggle=wall.getByRole('button',{name:/Day$/});assert.equal(await toggle.getAttribute('aria-pressed'),'true')
 await toggle.click()
 assert.doesNotMatch(await wall.getAttribute('class'),/is-night/)
 assert.equal(await wall.locator('.wall-day').first().getAttribute('aria-label'),'Today')
 await page.reload();await wall.waitFor()
 assert.doesNotMatch(await wall.getAttribute('class'),/is-night/,'the tablet remembers the day look')
 await wall.getByRole('button',{name:/Night$/}).click()
 assert.match(await wall.getAttribute('class'),/is-night/)
 await context.close()
})

test('Planner days: 1 day, 3 days or the whole week, remembered; on a phone a swipe goes to the next days and the whole week scrolls sideways',async({context,page})=>{
 const cloud=fakeCloud()
 await page.setViewportSize({width:390,height:844})
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await go(page,'Planner')
 const days=page.getByRole('group',{name:'Calendar view'}),week=page.getByRole('region',{name:'Week'})
 assert.equal(await days.getByRole('button',{name:'3 days'}).getAttribute('aria-pressed'),'true','phones start at 3')
 assert.equal(await week.locator('.week-grid-head button').count(),3)
 await days.getByRole('button',{name:'Day',exact:true}).click()
 assert.equal(await week.locator('.week-grid-head button').count(),1)
 // A quick sideways swipe goes to the next day (and back).
 const shown=()=>week.locator('.week-grid-head button').first().getAttribute('aria-label')
 const before=await shown()
 const swipe=dx=>page.locator('.week-grid-scroll').evaluate((el,dx)=>{const touch=x=>new Touch({identifier:1,target:el,clientX:x,clientY:400});el.dispatchEvent(new TouchEvent('touchstart',{touches:[touch(200)],changedTouches:[touch(200)],bubbles:true}));el.dispatchEvent(new TouchEvent('touchend',{touches:[],changedTouches:[touch(200+dx)],bubbles:true}))},dx)
 await swipe(-120)
 await page.waitForFunction(b=>document.querySelector('.week-grid-head button')?.getAttribute('aria-label')!==b,before)
 await swipe(120)
 await page.waitForFunction(b=>document.querySelector('.week-grid-head button')?.getAttribute('aria-label')===b,before)
 await days.getByRole('button',{name:'Week',exact:true}).click()
 assert.equal(await week.locator('.week-grid-head button').count(),7)
 const scroller=page.locator('.week-grid-scroll.is-wide')
 assert.ok(await scroller.evaluate(e=>e.scrollWidth>e.clientWidth+50),'the week is wider than the phone and scrolls sideways')
 await page.reload();await heading(page,'Planner')
 assert.equal(await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Week',exact:true}).getAttribute('aria-pressed'),'true','remembered on this device')
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
  // The how-to is behind the ? beside the dates (open by itself only the first time).
  const help=page.getByRole('button',{name:'How the calendar works'})
  if(await help.getAttribute('aria-expanded')!=='true')await help.click()
  await page.getByText('Hold something for Edit, Move or Delete',{exact:false}).waitFor()
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
  await page.getByRole('dialog',{name:'Edit event'}).getByLabel('Title').waitFor()
  assert.deepEqual(phone.errors,[])
 }finally{await phone.context.close()}
})

test('Event editor: a quick length sets the end time, Remind me is saved, and the Planner offers reminders on this phone',async({context,page})=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data,pid=plan.activeProfileId
 plan.settings.parentMode=false
 plan.calendarEvents.push({id:'ev-len',profileId:pid,date:'2026-09-29',time:'15:00',endTime:'15:20',title:'Piano lesson',kind:'activity',notes:''})
 await page.clock.setFixedTime(new Date('2026-09-28T08:00:00'))
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await go(page,'Planner')
 await page.getByRole('region',{name:'Reminders on this phone'}).waitFor()
 await page.getByRole('region',{name:'Week'}).getByRole('button',{name:/^Piano lesson · /}).click()
 const ed=page.getByRole('dialog',{name:'Edit event'})
 await ed.getByRole('group',{name:'How long'}).getByRole('button',{name:'1.5 hr'}).click()
 assert.equal(await ed.getByLabel('End time (optional)').inputValue(),'16:30')
 assert.equal(await ed.getByRole('group',{name:'How long'}).getByRole('button',{name:'1.5 hr'}).getAttribute('aria-pressed'),'true')
 await ed.getByLabel(/Remind me/).selectOption('60')
 await ed.getByRole('button',{name:'Save',exact:true}).click()
 await waitFor(()=>{const e=cloud.users.alice.plan.data.calendarEvents.find(x=>x.id==='ev-len');return e?.endTime==='16:30'&&e?.remind===60},'the length and reminder reach the account')
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

test('Two devices: each adds something while one is offline and nothing is lost or doubled; when one deletes an event the other edited, syncing pauses with a banner on every page, and “Keep this device’s version” resolves it',async()=>{
 const cloud=fakeCloud(),plan=cloud.users.alice.plan.data
 plan.calendarEvents.push({id:'e-shared',profileId:plan.activeProfileId,title:'Shared practice',date:'2026-10-16',time:'16:00',endTime:'17:00',kind:'sports',done:false,notes:''})
 const a=await freshPage(),b=await freshPage()
 const count=title=>JSON.stringify(cloud.users.alice.plan.data).split('"'+title+'"').length-1
 const waitLong=async(check,message)=>{for(let i=0;i<160;i++){if(check())return;await new Promise(r=>setTimeout(r,250))}assert.fail(message)}
 try{
  for(const d of [a,b]){await d.page.clock.install({time:new Date('2026-10-15T15:00:00')});await signInAs(d.context,cloud,'alice');await d.page.goto(BASE);await heading(d.page,'Sanctuary');await go(d.page,'Planner')}
  // Open the Add sheet, the editor and Schedule on B once while online (these test devices have no offline cache).
  await b.page.getByRole('button',{name:'＋ Add',exact:true}).click()
  await b.page.getByRole('dialog',{name:'Add to your plan'}).getByRole('group',{name:'Add type'}).getByRole('button',{name:'Homework'}).click()
  await b.page.locator('dialog[open]').getByRole('button',{name:'Cancel'}).click()
  await b.page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Schedule'}).click();await b.page.locator('.wb-agenda-day').first().waitFor()
  await b.page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Week',exact:true}).click()
  // B loses signal; both add homework.
  await b.context.setOffline(true)
  await addFromMenu(a.page,'tasks','From phone A')
  await addFromMenu(b.page,'tasks','From phone B')
  await waitFor(()=>count('From phone A')===1,'A’s homework never reached the account')
  assert.equal(count('From phone B'),0,'B is offline')
  await b.context.setOffline(false)
  await b.page.evaluate(()=>window.dispatchEvent(new Event('online')))
  await waitLong(()=>count('From phone B')===1&&count('From phone A')===1,'B’s homework never merged in (or something doubled)')
  await b.page.getByText('From phone A').filter({visible:true}).first().waitFor()
  await a.page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await a.page.getByText('From phone B').filter({visible:true}).first().waitFor({timeout:30000})
  for(const d of [a,b])assert.equal(await d.page.getByRole('alert',{name:'Syncing is paused'}).count(),0)
  // Now A deletes the practice while B (offline) adds a note to it.
  await b.context.setOffline(true)
  await b.page.getByRole('button',{name:/^Shared practice · 4:00 PM/}).first().click()
  const editor=b.page.locator('dialog[open]');await editor.getByLabel('Details').fill('Bring the orange cones')
  await editor.getByRole('button',{name:'Save',exact:true}).click();await editor.waitFor({state:'detached'})
  await a.page.locator('.planner-day-paper').getByRole('button',{name:'Next day'}).click()
  const onA=a.page.locator('.wb-family-event').filter({hasText:'Shared practice'}).first()
  await onA.locator('summary',{hasText:'More actions'}).click();await onA.getByRole('button',{name:'Move to Trash'}).click()
  await waitFor(()=>!cloud.users.alice.plan.data.calendarEvents.some(e=>e.id==='e-shared'),'A’s delete never reached the account')
  await b.context.setOffline(false)
  await b.page.evaluate(()=>window.dispatchEvent(new Event('online')))
  const banner=b.page.getByRole('alert',{name:'Syncing is paused'})
  await banner.waitFor({timeout:40000})
  await go(b.page,'Notes');await banner.waitFor()
  await banner.getByRole('button',{name:'Keep this device’s version'}).click()
  await banner.waitFor({state:'detached'})
  await waitLong(()=>cloud.users.alice.plan.data.calendarEvents.find(e=>e.id==='e-shared')?.notes==='Bring the orange cones','B’s version never reached the account')
  assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[])
 }finally{await a.context.close();await b.context.close()}
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
  // Screens that load on demand open with no signal too (Settings › Family and Kids, never opened before).
  await go(page,'Settings');await settingsTab(page,'Family');await page.getByRole('region',{name:'Share with grandparents'}).waitFor()
  await go(page,'Kids');await page.getByRole('heading',{name:'Kids'}).first().waitFor()
  assert.equal(await page.locator('.lazy-panel-error').count(),0,'a screen couldn’t load offline')
  assert.ok(!JSON.stringify(cloud.users.alice.plan.data).includes('Written with no signal (e2e)'))
  // Signal back: it reaches the account without doing anything.
  cloud.offline=false
  await context.setOffline(false)
  for(let i=0;i<80&&!JSON.stringify(cloud.users.alice.plan.data).includes('Written with no signal (e2e)');i++)await page.waitForTimeout(250)
  assert.ok(JSON.stringify(cloud.users.alice.plan.data).includes('Written with no signal (e2e)'),'the assignment written offline never reached the account')
  assert.deepEqual(errors,[])
 }finally{await context.close()}
})

test('Out sick and late nights: marking Emma out sick skips her class and shows her soccer as off on Home, the Planner and the wall, Take back undoes it; a sleepover past midnight shows the next morning',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 await page.clock.install({time:new Date('2026-10-19T07:30:00')}) // a Monday
 const week={Monday:[{id:'math',label:'Math',start:'09:00',end:'10:00',kind:'study'}],Sunday:[],Tuesday:[],Wednesday:[],Thursday:[],Friday:[],Saturday:[]}
 d.studySeasons.push({id:'emma-school',profileId:pid,name:'Emma’s school',start:'2026-09-01',end:'2026-12-20',active:true,week,kidId:'kid-emma'})
 d.calendarEvents.push({id:'soccer',profileId:pid,date:'2026-10-19',title:'Soccer practice',kind:'sports',notes:'',time:'16:00',kidId:'kid-emma'},{id:'sleep',profileId:pid,date:'2026-10-18',title:'Sleepover at Sam’s',kind:'activity',notes:'',time:'19:00',endTime:'09:00',kidId:'kid-leo'})
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await go(page,'Kids')
 const glance=page.getByRole('region',{name:'Your kids'})
 await glance.getByRole('button',{name:'🤒 Out sick or snow day?'}).click()
 const sheet=page.getByRole('dialog',{name:'Out sick or a snow day'})
 await sheet.getByRole('group',{name:'Who’s out'}).getByRole('button',{name:/Emma/}).click()
 await sheet.getByRole('button',{name:'Mark out sick'}).click()
 await sheet.waitFor({state:'detached'})
 await waitFor(()=>{const p=cloud.users.alice.plan.data;return p.daysOff?.length===1&&p.studySeasons.find(s=>s.id==='emma-school').week.Monday[0].skippedDates?.includes('2026-10-19')},'the sick day and the skipped class never reached the account')
 assert.match(await glance.innerText(),/Out sick/)
 await go(page,'Sanctuary')
 await page.getByLabel('Today at a glance').getByText('Emma is out sick').waitFor()
 // The wall: her soccer is off; Leo's sleepover is still going this morning.
 await page.goto(BASE+'?wall')
 const wall=page.getByRole('dialog',{name:'Wall display'}),today=wall.getByRole('region',{name:'Today'})
 await today.getByText('Emma is out sick').waitFor()
 assert.match(await today.locator('.wall-item.is-off').filter({hasText:'Soccer practice'}).innerText(),/Off/)
 assert.match(await today.locator('.wall-item').filter({hasText:'Sleepover at Sam’s'}).innerText(),/Until\s+9:00 AM/)
 // The Planner says so too, and Take back undoes it.
 await page.goto(BASE+'?page=planner');await heading(page,'Planner')
 const banner=page.locator('.special-day-banner.is-day-off').filter({hasText:'Emma is out sick'}).first()
 await banner.getByRole('button',{name:'Change'}).click()
 await page.getByRole('dialog',{name:'Out sick or a snow day'}).getByRole('button',{name:'Take back'}).click()
 await waitFor(()=>{const p=cloud.users.alice.plan.data;return p.daysOff?.length===0&&!p.studySeasons.find(s=>s.id==='emma-school').week.Monday[0].skippedDates?.includes('2026-10-19')},'Take back did not undo the sick day')
})
test('Family Home: one Today card says what is next for each kid, Kids today lives on Kids, late work opens from its pill, and a weekly to-do shows on its day this week and moves on when ticked',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 d.settings.familyStudyTabs=false
 await page.clock.install({time:new Date('2026-10-15T15:30:00')}) // a Thursday
 d.calendarEvents.push({id:'soccer',profileId:pid,date:'2026-10-15',title:'Soccer practice',kind:'sports',notes:'',time:'16:00',kidId:'kid-emma',location:'Riverside Park',travelMinutes:15})
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const day=page.getByRole('region',{name:'Family schedule'})
 await day.getByRole('list',{name:'What’s next for the kids'}).getByText(/Soccer practice 4:00 PM · leave 3:45 PM/).waitFor()
 assert.equal(await page.getByRole('region',{name:'Your kids'}).count(),0,'Kids today is on the Kids page')
 assert.equal(await page.locator('details.sanctuary-focus').count(),0,'no Focus session in a family plan')
 // Late work: once, behind its pill.
 assert.equal(await page.getByRole('region',{name:'Overdue'}).count(),0)
 await day.getByRole('button',{name:/1 late/}).click()
 await page.getByRole('region',{name:'Overdue'}).getByRole('heading',{name:'1 assignment is overdue'}).waitFor()
 // A weekly to-do for Saturday shows on Saturday this week.
 const todos=page.getByRole('region',{name:'Family to-do'})
 await todos.getByLabel('New family to-do').fill('Clean house')
 await todos.getByLabel('When').selectOption('2026-10-17')
 await todos.getByLabel('Repeat').selectOption('week')
 await todos.getByRole('button',{name:'Add',exact:true}).click()
 await todos.locator('.family-todo-day',{hasText:'Saturday'}).waitFor()
 const week=page.getByRole('region',{name:'Your week ahead'})
 await week.getByRole('button',{name:/Sat 17: .*to-do: Clean house/}).waitFor()
 await todos.getByRole('checkbox',{name:/Clean house/}).click()
 await waitFor(()=>{const t=cloud.users.alice.plan.data.familyTodos?.find(x=>x.title==='Clean house');return t&&t.repeat==='week'&&t.due==='2026-10-24'&&!t.done},'ticking the weekly to-do never moved it to next Saturday')
 // Each kid's whole day is on Kids.
 await go(page,'Kids')
 await page.getByRole('region',{name:'Your kids'}).getByText(/Soccer practice 4:00 PM/).waitFor()
})
test('Family to-dos everywhere: typed in one line in ＋ Add, every 2 weeks from another day, on the Planner’s week and Schedule (Done moves a repeat on); Kids shows one card per kid; a family Home loads the island once it is near',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 d.settings.familyStudyTabs=false
 await page.clock.install({time:new Date('2026-10-15T15:30:00')}) // a Thursday
 d.calendarEvents.push({id:'game',profileId:pid,date:'2026-10-17',title:'Soccer game',kind:'sports',notes:'',time:'09:00',kidId:'kid-emma'},{id:'piano',profileId:pid,date:'2026-10-16',title:'Piano',kind:'lesson',notes:'',time:'17:00',kidId:'kid-emma'})
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 // Typed: "clean house every sat" is a weekly family to-do from Saturday.
 await page.getByRole('button',{name:'＋ Add',exact:true}).click()
 const chooser=page.getByRole('dialog',{name:'Add to your plan'})
 await chooser.getByLabel('Type it').fill('clean house every sat')
 await chooser.getByText('To-do: Clean house').waitFor()
 assert.match(await chooser.locator('.quick-add-preview').innerText(),/Sat, Oct 17 · 🔁 every week/)
 await chooser.getByRole('button',{name:'Add',exact:true}).click()
 await waitFor(()=>{const t=cloud.users.alice.plan.data.familyTodos?.find(x=>x.title==='Clean house');return t&&t.repeat==='week'&&t.due==='2026-10-17'},'the typed to-do never reached the account')
 // Every 2 weeks, from a day further out.
 const todos=page.getByRole('region',{name:'Family to-do'})
 await todos.getByLabel('New family to-do').fill('Take out recycling')
 await todos.getByLabel('When').selectOption('other')
 await todos.getByLabel('When').fill('2026-10-20')
 await todos.getByLabel('Repeat').selectOption('2weeks')
 await todos.getByRole('button',{name:'Add',exact:true}).click()
 await waitFor(()=>{const t=cloud.users.alice.plan.data.familyTodos?.find(x=>x.title==='Take out recycling');return t&&t.repeat==='2weeks'&&t.due==='2026-10-20'},'the every-2-weeks to-do never reached the account')
 await todos.locator('.family-todo-day',{hasText:'every 2 weeks'}).waitFor()
 // Planner › Week: the to-do sits in Saturday's all-day row; Done there moves it to next Saturday.
 await go(page,'Planner')
 await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Week'}).click()
 await page.getByRole('region',{name:'Week'}).getByRole('button',{name:/Clean house/}).click()
 const sheet=page.getByRole('dialog',{name:'Clean house'})
 await sheet.getByRole('button',{name:'✔ Done'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.familyTodos.find(x=>x.title==='Clean house').due==='2026-10-24','Done never moved the to-do to next Saturday')
 // Schedule: next Tuesday's to-do is a checkbox; ticking it moves it two weeks on.
 await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Schedule'}).click()
 const tue=page.locator('.wb-agenda-day').filter({hasText:'Take out recycling'})
 await tue.locator('summary').click()
 await tue.getByRole('checkbox',{name:/Take out recycling/}).click()
 await waitFor(()=>cloud.users.alice.plan.data.familyTodos.find(x=>x.title==='Take out recycling').due==='2026-11-03','ticking it never moved it two weeks on')
 // Kids: one card per kid, with today, tomorrow and later this week.
 await go(page,'Kids')
 const emma=page.getByRole('region',{name:'Your kids'}).getByRole('listitem').filter({hasText:'Emma'})
 await emma.getByText('Later this week').waitFor()
 assert.match(await emma.innerText(),/Tomorrow\s+🗓️ Piano 5:00 PM/i)
 assert.match(await emma.innerText(),/Sat · Soccer game 9:00 AM/)
 await emma.getByRole('button',{name:'Edit Emma'}).waitFor()
 // A family Home, opened again on this device: the island shows its picture and loads the rest once near.
 const asked=[];page.on('request',r=>{if(/GardenCard|phaser/i.test(r.url()))asked.push(r.url())})
 await go(page,'Sanctuary')
 await page.setViewportSize({width:390,height:844}) // on a phone the island is well below the day
 asked.length=0
 await page.reload();await heading(page,'Sanctuary')
 await page.getByRole('region',{name:'Your day'}).waitFor()
 assert.equal(await page.locator('.wb-island canvas').count(),0)
 await page.locator('.wb-island [role=img][aria-label="Your island"]').waitFor()
 assert.deepEqual(asked,[],'nothing of the island engine is fetched while it is out of view')
 await page.locator('.wb-island').scrollIntoViewIfNeeded()
 await page.locator('.wb-island canvas').waitFor({timeout:20000})
 assert.ok(asked.length>0,'the island engine loaded once the island was near')
})
test('Family to-dos, part 2: a to-do’s words, day and repeat can be changed; ticking says what is next with Undo; one drags to another day on the Month; the To-dos chip hides them; the wall shows them; in the evening the kids line is tomorrow',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 d.settings.familyStudyTabs=false
 await page.clock.install({time:new Date('2026-10-15T18:30:00')}) // a Thursday evening
 d.calendarEvents.push({id:'soccer',profileId:pid,date:'2026-10-16',title:'Soccer practice',kind:'sports',notes:'',time:'16:00',kidId:'kid-emma',travelMinutes:15})
 d.familyTodos=[{id:'f1',profileId:pid,title:'Clean house',done:false,due:'2026-10-17',repeat:'week',weekly:true},{id:'f2',profileId:pid,title:'Buy poster board',done:false},{id:'f3',profileId:pid,title:'Sign permission slip',done:false,due:'2026-10-16',forKidId:'kid-leo'},{id:'f4',profileId:pid,title:'Groceries',done:false}]
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 // Evening: Emma's line is tomorrow's practice.
 await page.getByRole('list',{name:'What’s next for the kids'}).getByText('Tomorrow: Soccer practice 4:00 PM · leave 3:45 PM').waitFor()
 // Change a to-do: new words and a day.
 const todos=page.getByRole('region',{name:'Family to-do'})
 await todos.getByRole('button',{name:'Change Buy poster board'}).click()
 const editor=page.getByRole('dialog',{name:'Change to-do'})
 await editor.getByLabel('To-do').fill('Buy poster board and glue')
 await editor.getByLabel('Day').fill('2026-10-19')
 await editor.getByLabel('Repeat').selectOption('month')
 await editor.getByRole('button',{name:'Save'}).click()
 await waitFor(()=>{const t=cloud.users.alice.plan.data.familyTodos.find(x=>x.id==='f2');return t.title==='Buy poster board and glue'&&t.due==='2026-10-19'&&t.repeat==='month'&&t.monthDay===19},'the change never reached the account')
 // Ticking a weekly one says when it's next, and Undo puts it back.
 await todos.getByRole('checkbox',{name:'Clean house'}).click()
 const toast=page.locator('.undo-toast');await toast.getByText(/Done: “Clean house”\. Next: Oct 24/).waitFor()
 await waitFor(()=>cloud.users.alice.plan.data.familyTodos.find(x=>x.id==='f1').due==='2026-10-24','ticking never moved it on')
 await toast.getByRole('button',{name:'Undo'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.familyTodos.find(x=>x.id==='f1').due==='2026-10-17','Undo never put it back')
 // Month: drag Saturday's to-do to Sunday; the To-dos chip hides and shows them.
 await go(page,'Planner')
 await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Month'}).click()
 const pill=page.getByRole('button',{name:'To-do: Clean house · Oct 17, 2026'})
 await dragOnto(page,pill,page.getByRole('button',{name:/^Oct 18, 2026 · /}))
 await waitFor(()=>cloud.users.alice.plan.data.familyTodos.find(x=>x.id==='f1').due==='2026-10-18','the drag never moved the to-do')
 await page.getByRole('button',{name:'To-do: Clean house · Oct 18, 2026'}).waitFor()
 const chip=page.getByRole('group',{name:'Show on calendar'}).getByRole('button',{name:'✔ To-dos'})
 await chip.click()
 await page.getByRole('button',{name:'To-do: Clean house · Oct 18, 2026'}).waitFor({state:'detached'})
 await chip.click()
 await page.getByRole('button',{name:'To-do: Clean house · Oct 18, 2026'}).waitFor()
 // The wall: tomorrow's to-do under tomorrow, with whose it is.
 await page.getByRole('button',{name:/Wall display/}).click()
 const wall=page.getByRole('dialog',{name:'Wall display'})
 assert.match(await wall.getByRole('list',{name:'Tomorrow’s to-dos'}).innerText(),/Sign permission slip\s*Leo/)
 assert.match(await wall.getByRole('list',{name:'Today’s to-dos'}).innerText(),/Groceries/,'today also lists the any-day ones')
})
test('A repeating event from the Planner: a note on just one day stays on that day, a new time for all of them keeps each day’s note, and more dates can be added to the series',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 await page.clock.install({time:new Date('2026-10-15T09:00:00')})
 for(const date of ['2026-10-15','2026-10-22','2026-10-29'])d.calendarEvents.push({id:'soc-'+date,profileId:pid,date,title:'Soccer practice',kind:'sports',notes:'',time:'16:00',endTime:'17:00',kidId:'kid-emma',recurringId:'rec-soc'})
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await go(page,'Planner')
 await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Month'}).click()
 const editor=page.getByRole('dialog',{name:'Edit event'}),soc=list=>cloud.users.alice.plan.data.calendarEvents.filter(e=>e.recurringId==='rec-soc').sort((a,b)=>a.date.localeCompare(b.date)).map(list)
 // A note on Oct 22 only (Only this one is the choice to start with).
 await page.getByRole('button',{name:/^Soccer practice · 4p · Emma · Oct 22, 2026/}).click()
 await editor.getByText('This repeats (3 dates). Save changes to:').waitFor()
 assert.equal(await editor.getByLabel('Only this one').isChecked(),true)
 await editor.getByLabel('Details').fill('Bring shin guards')
 await editor.getByRole('button',{name:'Save'}).click()
 await waitFor(()=>soc(e=>e.notes).join('|')==='|Bring shin guards|','the note never reached just Oct 22')
 // A new time for all of them: Oct 22 keeps its note.
 await page.getByRole('button',{name:/^Soccer practice · 4p · Emma · Oct 15, 2026/}).click()
 await editor.getByLabel('Start time (optional)').fill('17:00');await editor.getByLabel('End time (optional)').fill('18:00')
 await editor.getByLabel('All of them').check()
 await editor.getByRole('button',{name:'Save'}).click()
 await waitFor(()=>soc(e=>e.time+' '+e.notes).join('|')==='17:00 |17:00 Bring shin guards|17:00 ','the new time never reached all of them, or the note was lost')
 // More dates: Nov 5 joins the series as a copy.
 await page.getByRole('button',{name:/^Soccer practice · 5p · Emma · Oct 29, 2026/}).click()
 await editor.locator('summary',{hasText:'Add more dates'}).click()
 await editor.getByRole('button',{name:'Next month'}).click()
 await editor.getByRole('button',{name:/^Nov 5, 2026/}).click()
 await editor.locator('summary',{hasText:'1 new'}).waitFor()
 await editor.getByRole('button',{name:'Save'}).click()
 await waitFor(()=>soc(e=>e.date+' '+e.time).join('|')==='2026-10-15 17:00|2026-10-22 17:00|2026-10-29 17:00|2026-11-05 17:00','Nov 5 never joined the series')
})
test('Round 55: the world map (its own button on the island): the beach is open (the forest opens with more hearts); KONO travels there, looks around once a day, and the market sells beach furniture',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 await page.clock.install({time:new Date('2026-10-15T15:00:00')})
 d.konoCare={...(d.konoCare??{}),[pid]:{profileId:pid,log:[{id:'bank-2026-01',kind:'bank',at:'2026-01-15T12:00:00.000Z',n:500}]}}
 const care=()=>cloud.users.alice.plan.data.konoCare?.[pid]??{log:[]}
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 // The island's own World map button (beside Decorate) opens it; so does KONO's corner.
 const mapButton=page.getByRole('navigation',{name:'Sanctuary view'}).getByRole('button',{name:'World map'})
 if(process.env.KONO_SHOTS){await mapButton.waitFor();await page.locator('.wb-scene-toolbar').screenshot({path:process.env.KONO_SHOTS+'/island-toolbar.png'})}
 // Beside Decorate, an Arcade button opens KONO Town's arcade.
 await page.getByRole('navigation',{name:'Sanctuary view'}).getByRole('button',{name:'Arcade'}).click()
 const town=page.getByRole('dialog',{name:'KONO Town'})
 await town.locator('.town-arcade').waitFor()
 await town.getByRole('button',{name:'Close dialog'}).click()
 await town.waitFor({state:'detached'})
 await mapButton.click()
 await page.getByRole('dialog',{name:'World map'}).getByRole('button',{name:'Go to Sandy Beach Cove'}).waitFor()
 // Full screen. The explorer's passport (its own panel): no land visited yet, and a treasure waits on the beach today.
 await page.getByRole('dialog',{name:'World map'}).getByRole('button',{name:/^🧭 Passport/}).click()
 await page.getByRole('region',{name:'Explorer’s passport'}).getByText('0 of 3 lands',{exact:false}).waitFor()
 await page.getByRole('button',{name:'Close passport'}).click()
 await page.getByRole('dialog',{name:'World map'}).getByRole('button',{name:'Go to Sandy Beach Cove'}).getByText('✨ Treasure today').waitFor()
 await page.getByRole('dialog',{name:'World map'}).getByRole('button',{name:'Close dialog'}).click()
 await page.getByRole('dialog',{name:'World map'}).waitFor({state:'detached'})
 await (await openCorner(page)).getByRole('button',{name:/^World map/}).click()
 const world=page.getByRole('dialog',{name:'World map'})
 await world.getByRole('button',{name:'Go to Sandy Beach Cove'}).waitFor()
 assert.equal(await world.getByRole('button',{name:/^Snowy Mountain Village, opens at 3 bond hearts$/}).isDisabled(),true,'the snowy village waits for more hearts')
 if(process.env.KONO_SHOTS)await world.screenshot({path:process.env.KONO_SHOTS+'/world-map.png'})
 await world.getByRole('button',{name:'Go to Sandy Beach Cove'}).click()
 const beach=page.getByRole('dialog',{name:'Sandy Beach Cove'})
 await beach.waitFor({timeout:8000})
 // One look around a day: a beach treasure, kept as a find.
 await beach.getByRole('button',{name:'🔍 Look around'}).click()
 await beach.getByText('KONO found',{exact:false}).waitFor()
 await waitFor(()=>care().log.some(e=>e.id==='land-beach-2026-10-15'&&e.kind==='find'&&['shell','seaglass','pebble','feather'].includes(e.item)),'the beach find never reached the account')
 await beach.getByRole('button',{name:'Looked around today ✓'}).waitFor()
 // The market: beach furniture, for KONO's house.
 await beach.getByRole('button',{name:'The Sandy Beach Cove market'}).click()
 await beach.getByRole('region',{name:'Market'}).getByRole('button',{name:/^Buy Beach hammock for /}).click()
 await waitFor(()=>care().log.some(e=>e.kind==='buy'&&e.item==='furn:hammock'),'the hammock never reached the account')
 if(process.env.KONO_SHOTS)await beach.screenshot({path:process.env.KONO_SHOTS+'/world-beach.png'})
 // Tap the sand and KONO walks there; say hello to the crab and it joins the passport.
 await beach.getByRole('button',{name:'Close market'}).click()
 const sand=beach.locator('.world-land'),box=await sand.boundingBox()
 const before=await beach.locator('.world-land .world-kono').evaluate(el=>el.style.left)
 await page.mouse.click(box.x+box.width*0.3,box.y+box.height*0.7)
 await page.waitForFunction(b=>document.querySelector('.world-land .world-kono')?.style.left!==b,before)
 await beach.getByRole('button',{name:'A crab! Say hello'}).click({force:true})
 await beach.getByText('New friend in your passport!',{exact:false}).waitFor()
 await beach.getByRole('button',{name:'← World map'}).click()
 await page.getByRole('dialog',{name:'World map'}).waitFor()
 await page.getByRole('dialog',{name:'World map'}).getByRole('button',{name:/^🧭 Passport/}).click()
 const passport=page.getByRole('region',{name:'Explorer’s passport'})
 await passport.getByText('1 of 3 lands · 1 of 7 friends',{exact:false}).waitFor()
 await passport.getByRole('list',{name:'Friends met'}).getByText('Crab').waitFor()
})

test('Round 59: the arcade’s new games: Meowdoku (solve the cat puzzle, get a results card and coins, and the next level is bigger), Gem blitz (a swap that lines up three scores) and Candy crush (moves and a target)',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 await page.clock.install({time:new Date('2026-10-15T15:00:00')})
 d.konoCare={...(d.konoCare??{}),[pid]:{profileId:pid,log:[{id:'bank-2026-01',kind:'bank',at:'2026-01-15T12:00:00.000Z',n:500}]}}
 const care=()=>cloud.users.alice.plan.data.konoCare?.[pid]??{log:[]}
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await page.getByRole('region',{name:'KONO today'}).getByRole('button',{name:/^KONO Town: /}).click()
 const town=page.getByRole('dialog',{name:'KONO Town'})
 await town.getByRole('navigation',{name:'KONO Town'}).getByRole('button',{name:'Arcade'}).click()
 // Meowdoku: read the patches off the board, solve it, and double-tap each answer square (a cat).
 await town.getByRole('button',{name:/Meowdoku/}).click()
 if(process.env.KONO_SHOTS){const d=page.getByRole('dialog',{name:'🐱 Meowdoku'});await d.getByRole('region',{name:'Start'}).waitFor();await page.waitForTimeout(600);await d.screenshot({path:process.env.KONO_SHOTS+'/game-start.png'})}
 await startGame(page,'🐱 Meowdoku',/^Start level 1$/)
 const meow=page.getByRole('dialog',{name:'🐱 Meowdoku'})
 const grid=meow.getByRole('grid',{name:/^Meowdoku, 5 by 5$/})
 await grid.waitFor()
 const answer=await grid.evaluate(el=>{
  const cells=[...el.querySelectorAll('[role=gridcell]')],n=Math.round(Math.sqrt(cells.length)),reg=cells.map(c=>[...c.classList].find(k=>/^is-c\d$/.test(k)))
  const out=[],cols=new Set(),regs=new Set()
  const go=r=>{if(r===n)return true;for(let c=0;c<n;c++){const i=r*n+c;if(cols.has(c)||regs.has(reg[i])||(r>0&&Math.abs(out[r-1]%n-c)<=1))continue;cols.add(c);regs.add(reg[i]);out.push(i);if(go(r+1))return true;out.pop();cols.delete(c);regs.delete(reg[i])}return false}
  go(0);return out.map(i=>({r:Math.floor(i/n)+1,c:i%n+1}))
 })
 assert.equal(answer.length,5)
 for(const {r,c} of answer)await grid.getByRole('gridcell',{name:new RegExp('^Row '+r+', column '+c+'(,|$)')}).dblclick()
 if(process.env.KONO_SHOTS){await page.waitForTimeout(300);await meow.screenshot({path:process.env.KONO_SHOTS+'/meowdoku.png'})}
 const results=meow.getByRole('region',{name:'Results'})
 await results.getByRole('heading',{name:'Purr-fect!'}).waitFor({timeout:8000})
 await results.getByText(/\+\d+ coins!/).waitFor()
 await waitFor(()=>care().log.some(e=>e.kind==='coin'&&e.item==='game:meow'),'the Meowdoku coins never reached the account')
 if(process.env.KONO_SHOTS)await meow.screenshot({path:process.env.KONO_SHOTS+'/game-results.png'})
 // Play again: the next puzzle (level 2).
 await results.getByRole('button',{name:'Play again'}).click()
 await meow.getByText(/^Level 2$/).waitFor()
 // ↻ Restart clears the board; ■ End gives the puzzle up (the level stays) and shows the results.
 const any=meow.getByRole('gridcell').first();await any.click()
 await meow.getByRole('gridcell',{name:/, marked$/}).first().waitFor()
 await meow.getByRole('button',{name:'↻ Restart'}).click()
 assert.equal(await meow.getByRole('gridcell',{name:/, (marked|cat)$/}).count(),0,'Restart clears the board')
 await meow.getByRole('button',{name:'■ End'}).click()
 await meow.getByRole('region',{name:'Results'}).getByRole('heading',{name:'Puzzle skipped'}).waitFor()
 await meow.getByRole('button',{name:'Done'}).click()
 await meow.waitFor({state:'detached'})
 // Gem blitz: find a swap that lines up three (from the board's pieces) and make it.
 await town.getByRole('button',{name:/Gem blitz/}).click()
 await startGame(page,'💎 Gem blitz')
 const gems=page.getByRole('dialog',{name:'💎 Gem blitz'}),board=gems.getByRole('grid',{name:'Gem board'})
 await board.getByRole('gridcell').first().waitFor()
 const swap=await board.evaluate(el=>{
  const k=Array(64);for(const p of el.querySelectorAll('[role=gridcell]'))k[Number(p.dataset.i)]=Number(p.dataset.kind)
  const line=b=>{for(let i=0;i<64;i++){const r=Math.floor(i/8),c=i%8;if(c<=5&&b[i]===b[i+1]&&b[i]===b[i+2])return true;if(r<=5&&b[i]===b[i+8]&&b[i]===b[i+16])return true}return false}
  for(let i=0;i<64;i++)for(const j of [i%8<7?i+1:-1,i<56?i+8:-1]){if(j<0)continue;const b=[...k];[b[i],b[j]]=[b[j],b[i]];if(line(b))return [i,j]}
  return null
 })
 assert.ok(swap,'a fresh board always has a move')
 await gems.evaluate(d=>Promise.all(d.getAnimations().map(x=>x.finished)))
 // The opening drop (every gem raining in) finishes before a move counts.
 await page.waitForFunction(()=>!document.querySelector('.match3 .is-intro'))
 const box=await board.boundingBox(),cell=box.width/8,centre=i=>({x:box.x+(i%8+0.5)*cell,y:box.y+(Math.floor(i/8)+0.5)*cell})
 const a=centre(swap[0]),b=centre(swap[1])
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move((a.x+b.x)/2,(a.y+b.y)/2,{steps:4});await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.up()
 // With KONO_SHOTS, a strip of frames through the move (swap, flash, burst, fall).
 if(process.env.KONO_SHOTS)for(let k=0;k<10;k++){await board.screenshot({path:process.env.KONO_SHOTS+'/gem-move-'+k+'.png'});await page.waitForTimeout(60)}
 await page.waitForFunction(()=>Number(document.querySelector('.match3 .blast-score')?.textContent?.replace(/,/g,''))>0,null,{timeout:5000})
 if(process.env.KONO_SHOTS)await gems.screenshot({path:process.env.KONO_SHOTS+'/gem-blitz.png'})
 await gems.getByRole('button',{name:'✕ Leave'}).click()
 await gems.waitFor({state:'detached'})
 // Candy crush: level 1, with its moves and target.
 await town.getByRole('button',{name:/Candy crush/}).click()
 // The start card has the level map: level 1 is next, the rest locked.
 await page.getByRole('dialog',{name:'🍬 Candy crush'}).getByRole('list',{name:'Level map'}).getByRole('button',{name:'Level 1, next'}).waitFor()
 if(process.env.KONO_SHOTS)await page.getByRole('dialog',{name:'🍬 Candy crush'}).screenshot({path:process.env.KONO_SHOTS+'/candy-map.png'})
 await startGame(page,'🍬 Candy crush',/^Start level 1$/)
 const candy=page.getByRole('dialog',{name:'🍬 Candy crush'})
 await candy.getByText('Level 1').waitFor();await candy.getByText(/^\d+ moves$/).waitFor()
 await candy.getByRole('progressbar',{name:/^Target \d+$/}).waitFor()
 // Boosters show with their prices.
 await candy.getByRole('group',{name:'Boosters'}).getByRole('button',{name:/Lollipop hammer/}).waitFor()
 // A swipe that lines up three scores and uses a move.
 {
  const cb=candy.getByRole('grid',{name:'Candy board'})
  await page.waitForFunction(()=>!document.querySelector('.match3 .is-intro'))
  const mv=await cb.evaluate(el=>{
   const k=Array(64);for(const p of el.querySelectorAll('[role=gridcell]'))k[Number(p.dataset.i)]=Number(p.dataset.kind)
   const line=b=>{for(let i=0;i<64;i++){const r=Math.floor(i/8),c=i%8;if(c<=5&&b[i]===b[i+1]&&b[i]===b[i+2])return true;if(r<=5&&b[i]===b[i+8]&&b[i]===b[i+16])return true}return false}
   for(let i=0;i<64;i++)for(const j of [i%8<7?i+1:-1,i<56?i+8:-1]){if(j<0)continue;const b=[...k];[b[i],b[j]]=[b[j],b[i]];if(line(b))return [i,j]}
   return null
  })
  const before=await candy.getByText(/^\d+ moves$/).innerText()
  const bx=await cb.boundingBox(),cl=bx.width/8,at=i=>({x:bx.x+(i%8+0.5)*cl,y:bx.y+(Math.floor(i/8)+0.5)*cl})
  const p0=at(mv[0]),p1=at(mv[1])
  await page.mouse.move(p0.x,p0.y);await page.mouse.down();await page.mouse.move(p1.x,p1.y,{steps:6});await page.mouse.up()
  await page.waitForFunction(()=>Number(document.querySelector('.match3 .blast-score')?.textContent?.replace(/,/g,''))>0,null,{timeout:5000})
  await candy.getByText(Number(before.split(' ')[0])-1+' moves').waitFor()
 }
 if(process.env.KONO_SHOTS)await candy.screenshot({path:process.env.KONO_SHOTS+'/candy.png'})
})

test('Round 60: more arcade: Flappy KONO (get ready, flap, a crash ends it with results), KONO.io (the map, a live leaderboard, steering, ■ End gives your share; team battle: Blue against Red on a clock) and Meowdoku’s Undo, Hint and Auto ✕',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 await page.clock.setFixedTime(new Date('2026-10-15T15:00:00'))
 d.konoCare={...(d.konoCare??{}),[pid]:{profileId:pid,log:[{id:'bank-2026-01',kind:'bank',at:'2026-01-15T12:00:00.000Z',n:500}]}}
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await page.getByRole('region',{name:'KONO today'}).getByRole('button',{name:/^KONO Town: /}).click()
 const town=page.getByRole('dialog',{name:'KONO Town'})
 await town.getByRole('navigation',{name:'KONO Town'}).getByRole('button',{name:'Arcade'}).click()
 // Flappy KONO: waits on "Get ready!", one flap starts it, and without more KONO falls and the run ends.
 await town.getByRole('button',{name:/Flappy KONO/}).click()
 await startGame(page,'🐤 Flappy KONO')
 const flappy=page.getByRole('dialog',{name:'🐤 Flappy KONO'})
 await flappy.getByText('Get ready!').waitFor()
 await page.waitForTimeout(500)
 if(process.env.KONO_SHOTS)await flappy.screenshot({path:process.env.KONO_SHOTS+'/flappy-ready.png'})
 await page.keyboard.press('Space')
 await flappy.getByText('Get ready!').waitFor({state:'detached'})
 if(process.env.KONO_SHOTS){await page.keyboard.press('Space');await page.waitForTimeout(250);await page.keyboard.press('Space');await page.waitForTimeout(150);await flappy.screenshot({path:process.env.KONO_SHOTS+'/flappy.png'})}
 const fr=flappy.getByRole('region',{name:'Results'})
 await fr.getByRole('heading',{name:/Bonk!|Nice flying!|medal!/}).waitFor({timeout:8000})
 await fr.getByText(/\d+ pipes?/).first().waitFor()
 await flappy.getByRole('button',{name:'Done'}).click();await flappy.waitFor({state:'detached'})
 // KONO Flow: pick a mode; shapes drop and score; hold takes one; ■ End shows the results.
 await town.getByRole('button',{name:/KONO Flow/}).click()
 const flow=await startGame(page,'🌌 KONO Flow')
 await flow.getByRole('img',{name:'KONO Flow well'}).waitFor()
 // Pick a mode first (Marathon, Sprint, Ultra or Zen).
 await flow.getByRole('group',{name:'Choose a mode'}).getByRole('button',{name:/^Marathon/}).click()
 await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowUp');await page.keyboard.press('Space')
 await page.waitForFunction(()=>Number(document.querySelector('.flow-game .blast-score')?.textContent?.replace(/,/g,''))>0)
 await flow.getByRole('button',{name:'Hold'}).click();await flow.getByRole('button',{name:'Drop'}).click()
 await flow.getByRole('meter',{name:'Flow'}).waitFor()
 // Touch: a sideways drag moves the shape between lanes; a flick down that drifts sideways never shifts it.
 const well=flow.getByRole('img',{name:'KONO Flow well'}),wb=await well.boundingBox(),cell=Math.min(wb.width/16.4,wb.height/20.8)
 const col=()=>well.evaluate(el=>Number(el.dataset.col))
 const cx=wb.x+wb.width/2,cy=wb.y+wb.height*0.3
 let start=await col()
 await page.mouse.move(cx,cy);await page.mouse.down()
 for(let i=1;i<=6;i++)await page.mouse.move(cx+i*cell*0.5,cy+i*0.1)
 await page.mouse.up();await page.waitForTimeout(150)
 assert.ok(await col()>start,'a sideways drag moves the shape to the right')
 await page.waitForTimeout(150);start=await col()
 await page.mouse.move(cx,cy);await page.mouse.down()
 for(let i=1;i<=6;i++){await page.mouse.move(cx+i*cell*0.35,cy+i*cell);await page.waitForTimeout(40);assert.equal(await col(),start,'a drag going down never shifts the lane')}
 await page.mouse.up()
 await flow.getByRole('button',{name:'■ End'}).click()
 await flow.getByRole('region',{name:'Results'}).getByText(/\d[\d,]* points/).first().waitFor()
 await flow.getByRole('button',{name:'Done'}).click();await flow.waitFor({state:'detached'})
 // KONO.io: the leaderboard lists you; steering works; ■ End shows your share of the map.
 await town.getByRole('button',{name:/KONO\.io/}).click()
 await startGame(page,'🟦 KONO.io',/^Solo$/)
 const io=page.getByRole('dialog',{name:'🟦 KONO.io'}),lb=io.getByRole('list',{name:'Leaderboard'})
 await lb.getByText(/\d+\. You/).waitFor()
 assert.ok(await lb.getByRole('listitem').count()>=5,'you and the bots on the leaderboard')
 await io.getByText(/^\d+\.\d%$/).first().waitFor()
 for(const k of ['ArrowUp','ArrowRight','ArrowDown']){await page.keyboard.press(k);await page.waitForTimeout(220)}
 if(process.env.KONO_SHOTS){await page.waitForTimeout(400);await io.screenshot({path:process.env.KONO_SHOTS+'/kono-io.png'})}
 await io.getByRole('button',{name:'■ End'}).click()
 const ir=io.getByRole('region',{name:'Results'})
 await ir.getByText(/You claimed [\d.]+% of the map/).waitFor()
 await io.getByRole('button',{name:'Done'}).click();await io.waitFor({state:'detached'})
 // KONO.io team battle: Blue against Red with the clock; ■ End shows which team was ahead.
 await town.getByRole('button',{name:/KONO\.io/}).click()
 await startGame(page,'🟦 KONO.io',/^Team battle$/)
 const tb=page.getByRole('dialog',{name:'🟦 KONO.io'})
 await tb.getByRole('group',{name:/^Blue [\d.]+%, Red [\d.]+%, \d:\d\d left$/}).waitFor()
 assert.equal(await tb.getByRole('list',{name:'Leaderboard'}).count(),0,'team battle shows the teams, not the solo leaderboard')
 await tb.getByRole('timer').filter({hasText:/^[12]:\d\d$/}).waitFor()
 await page.keyboard.press('ArrowUp');await page.waitForTimeout(700)
 if(process.env.KONO_SHOTS)await tb.screenshot({path:process.env.KONO_SHOTS+'/kono-io-team.png'})
 await tb.getByRole('button',{name:'■ End'}).click()
 const tr=tb.getByRole('region',{name:'Results'})
 await tr.getByRole('heading',{name:/Blue wins|Red wins|A tie/}).waitFor()
 await tr.getByText(/^Blue [\d.]+% · Red [\d.]+%/).first().waitFor()
 await tb.getByRole('button',{name:'Done'}).click();await tb.waitFor({state:'detached'})
 // Meowdoku: Hint places a right cat, Undo takes it back, Auto ✕ shades what a cat rules out.
 await town.getByRole('button',{name:/Meowdoku/}).click()
 await startGame(page,'🐱 Meowdoku')
 const meow=page.getByRole('dialog',{name:'🐱 Meowdoku'}),grid=meow.getByRole('grid',{name:/^Meowdoku, \d by \d$/})
 await grid.waitFor()
 await meow.getByRole('button',{name:'💡 Hint'}).click()
 await grid.getByRole('gridcell',{name:/, cat$/}).first().waitFor()
 await meow.getByRole('button',{name:'Auto ✕'}).click()
 assert.equal(await meow.getByRole('button',{name:'Auto ✕'}).getAttribute('aria-pressed'),'true')
 assert.ok(await grid.getByRole('gridcell',{name:/, ruled out$/}).count()>=8,'a cat rules out its row, column, patch and neighbors')
 if(process.env.KONO_SHOTS)await meow.screenshot({path:process.env.KONO_SHOTS+'/meow-tools.png'})
 await meow.getByRole('button',{name:'↶ Undo'}).click()
 assert.equal(await grid.getByRole('gridcell',{name:/, (cat|ruled out)$/}).count(),0,'Undo takes the cat back')
 // Drag across a row: the empty squares become ✕.
 const a=await grid.getByRole('gridcell',{name:/^Row 1, column 1(,|$)/}).boundingBox(),b=await grid.getByRole('gridcell',{name:/^Row 1, column 3(,|$)/}).boundingBox()
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:6});await page.mouse.up()
 assert.equal(await grid.getByRole('gridcell',{name:/^Row 1, column [123], marked$/}).count(),3,'a drag marks each square it crosses')
 await meow.getByRole('button',{name:'Auto ✕'}).click()
 // As in the Meowdoku app: a double-tap places a cat, and a cat that isn't in the answer costs a heart.
 await meow.getByRole('group',{name:'3 hearts left'}).or(meow.getByLabel('3 hearts left')).first().waitFor()
 const wrong=await grid.evaluate(el=>{
  const cells=[...el.querySelectorAll('[role=gridcell]')],n=Math.round(Math.sqrt(cells.length)),reg=cells.map(c=>[...c.classList].find(k=>/^is-c\d$/.test(k)))
  const out=[],cols=new Set(),regs=new Set()
  const go=r=>{if(r===n)return true;for(let c=0;c<n;c++){const i=r*n+c;if(cols.has(c)||regs.has(reg[i])||(r>0&&Math.abs(out[r-1]%n-c)<=1))continue;cols.add(c);regs.add(reg[i]);out.push(i);if(go(r+1))return true;out.pop();cols.delete(c);regs.delete(reg[i])}return false}
  go(0);const i=[...Array(n*n).keys()].find(k=>!out.includes(k)&&k>=n*2);return {r:Math.floor(i/n)+1,c:i%n+1}
 })
 await grid.getByRole('gridcell',{name:new RegExp('^Row '+wrong.r+', column '+wrong.c+'(,|$)')}).dblclick()
 await meow.getByLabel('2 hearts left').waitFor()
 await grid.getByRole('gridcell',{name:new RegExp('^Row '+wrong.r+', column '+wrong.c+', marked$')}).waitFor()
})

test('Round 58: your own Home: the week strip, Sanctuary, the family schedule, then the schedule (today and tomorrow together), the next 7 days and pinned notes; Customize Home hides and reorders, and it stays after a reload',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 await page.clock.setFixedTime(new Date('2026-10-15T15:00:00'))
 d.notes.push({id:'n-pin',profileId:pid,subjectId:'',title:'Bring cleats',body:'Soccer Saturday',created:'2026-10-10T12:00:00.000Z',pinned:true})
 d.calendarEvents.push({id:'e-rem',profileId:pid,subjectId:'',title:'Reminder: dentist form',date:'2026-10-17',kind:'personal',done:false})
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const order=()=>page.evaluate(()=>[...document.querySelectorAll('.home-widgets>section,.home-widgets>details')].map(el=>el.getAttribute('aria-label')||el.className.split(' ').find(c=>c.startsWith('wb-island')||c.startsWith('kono-bar'))||el.tagName))
 await page.getByRole('region',{name:'This week at a glance'}).waitFor()
 await page.getByRole('region',{name:'Notes & reminders'}).getByText('Bring cleats').waitFor()
 await page.getByRole('region',{name:'Notes & reminders'}).getByText('Reminder: dentist form').waitFor()
 const day=page.getByRole('region',{name:'Your day'})
 await day.getByRole('region',{name:'Today'}).waitFor();await day.getByRole('region',{name:'Tomorrow'}).waitFor()
 assert.equal(await page.getByRole('tab',{name:/^Tomorrow/}).count(),0,'no Today / Tomorrow tabs any more')
 const first=await order()
 assert.ok(first.indexOf('This week at a glance')<first.indexOf('wb-island'),'the week strip sits above Sanctuary: '+first.join(' | '))
 assert.ok(first.indexOf('wb-island')<first.indexOf('Your day')&&first.indexOf('Your day')<first.indexOf('Notes & reminders'),first.join(' | '))
 if(process.env.KONO_SHOTS){await page.screenshot({path:process.env.KONO_SHOTS+'/home-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.screenshot({path:process.env.KONO_SHOTS+'/home-phone.png',fullPage:true});await page.setViewportSize({width:1280,height:900})}
 // Customize: hide Sanctuary and move Notes & reminders to the top (⠿ with the arrow keys).
 await page.getByRole('button',{name:'✏️ Customize Home'}).click()
 const dialog=page.getByRole('dialog',{name:'Customize Home'})
 await dialog.getByRole('checkbox',{name:/Sanctuary/}).uncheck()
 const handle=dialog.getByRole('button',{name:/^Reorder Notes & reminders/})
 for(let k=0;k<6;k++){await handle.focus();await page.keyboard.press('ArrowUp')}
 if(process.env.KONO_SHOTS)await dialog.screenshot({path:process.env.KONO_SHOTS+'/home-customize.png'})
 await dialog.getByRole('button',{name:'Done'}).click()
 await page.locator('.wb-island').waitFor({state:'detached'})
 let now=await order()
 assert.equal(now[0],'Notes & reminders',now.join(' | '))
 await page.reload();await heading(page,'Sanctuary')
 await page.getByRole('region',{name:'Notes & reminders'}).waitFor()
 now=await order()
 assert.equal(now[0],'Notes & reminders','the order stays after a reload');assert.ok(!now.includes('wb-island'),'Sanctuary stays hidden')
 // Back to the default.
 await page.getByRole('button',{name:'✏️ Customize Home'}).click()
 await page.getByRole('dialog',{name:'Customize Home'}).getByRole('button',{name:'Back to the default'}).click()
 await page.getByRole('dialog',{name:'Customize Home'}).getByRole('button',{name:'Done'}).click()
 await page.locator('.wb-island').waitFor()
})

test('Round 57: KONO blast clears a full row (the squares empty and the score jumps)',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 await page.clock.install({time:new Date('2026-10-15T15:00:00')})
 d.konoCare={...(d.konoCare??{}),[pid]:{profileId:pid,log:[{id:'bank-2026-01',kind:'bank',at:'2026-01-15T12:00:00.000Z',n:500}]}}
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await page.getByRole('region',{name:'KONO today'}).getByRole('button',{name:/^KONO Town: /}).click()
 const town=page.getByRole('dialog',{name:'KONO Town'})
 await town.getByRole('navigation',{name:'KONO Town'}).getByRole('button',{name:'Arcade'}).click()
 // Every piece is a single square from here on, so eight in a row fill it.
 await page.evaluate(()=>{Math.random=()=>0})
 await town.getByRole('button',{name:/KONO blast/}).click()
 await startGame(page,'🧱 KONO blast')
 const board=page.getByRole('grid',{name:'KONO blast board'})
 for(let c=1;c<=8;c++){
  await page.getByRole('group',{name:'Pieces'}).getByRole('button').first().click()
  await board.getByRole('gridcell',{name:new RegExp('^Row 1, column '+c+'(,|$)')}).click()
 }
 await page.waitForFunction(()=>Number(document.querySelector('.blast-score')?.textContent)>=18,null,{timeout:5000})
 assert.equal(await board.getByRole('gridcell',{name:/filled$/}).count(),0,'the full row cleared')
 if(process.env.KONO_SHOTS){await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:process.env.KONO_SHOTS+'/blast-fullscreen.png'});await page.setViewportSize({width:1280,height:900})}
 // The same by dragging: eight squares dragged into row 3 clear it too.
 const before=await page.evaluate(()=>Number(document.querySelector('.blast-score')?.textContent))
 for(let c=1;c<=8;c++){
  const from=await page.getByRole('group',{name:'Pieces'}).getByRole('button').first().boundingBox(),to=await board.getByRole('gridcell',{name:new RegExp('^Row 3, column '+c+'(,|$)')}).boundingBox()
  await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down()
  for(let k=1;k<=6;k++)await page.mouse.move(from.x+from.width/2+(to.x+to.width/2-from.x-from.width/2)*k/6,from.y+from.height/2+(to.y+to.height/2+56-from.y-from.height/2)*k/6)
  await page.mouse.up()
  if(c<8)await board.getByRole('gridcell',{name:'Row 3, column '+c+', filled'}).waitFor({timeout:3000})
 }
 await page.waitForFunction(n=>Number(document.querySelector('.blast-score')?.textContent)>=n+18,before,{timeout:5000})
 assert.equal(await board.getByRole('gridcell',{name:/filled$/}).count(),0,'the dragged row cleared')
 // Each clear paid a coin straight away (one line, then the second clear came after a non-clearing move).
 const care=()=>cloud.users.alice.plan.data.konoCare?.[pid]??{log:[]}
 await waitFor(()=>care().log.filter(e=>e.kind==='coin'&&e.item==='game:blast').length===2,'the clears’ coins never reached the account')
 // Leave mid-game (it plays full screen), and it carries on where it was.
 await page.getByRole('group',{name:'Pieces'}).getByRole('button').first().click()
 await board.getByRole('gridcell',{name:'Row 5, column 5'}).click()
 const kept=await page.evaluate(()=>Number(document.querySelector('.blast-score')?.textContent))
 await page.getByRole('dialog',{name:'🧱 KONO blast'}).getByRole('button',{name:'✕ Leave'}).click()
 await town.getByRole('button',{name:new RegExp('KONO blast.*Carry on your game \\('+kept+' points so far\\)')}).click()
 await startGame(page,'🧱 KONO blast',new RegExp('^Continue \\('+kept+' points\\)$'))
 await board.getByRole('gridcell',{name:'Row 5, column 5, filled'}).waitFor()
 assert.equal(await page.evaluate(()=>Number(document.querySelector('.blast-score')?.textContent)),kept)
 // End game finishes it (the best score is kept) and the next game starts fresh.
 await page.getByRole('dialog',{name:'🧱 KONO blast'}).getByRole('button',{name:'■ End'}).click()
 await town.getByText(/^KONO blast: \d+ points! 🧱/).first().waitFor()
 await town.getByRole('button',{name:/KONO blast.*Fit the pieces/}).waitFor()
})

test('Round 56: each land has its own game: Shell chase on the beach, Acorn tumble in the forest (a cleared group scores and wins coins) and Sled dash in the snowy village; the arcade has KONO blast (tap or drag pieces on)',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 await page.clock.install({time:new Date('2026-10-15T15:00:00')})
 // 20 days of care is 3 bond hearts: every land is open.
 const cared=Array.from({length:20},(_,i)=>({id:'bond-2026-09-'+String(i+1).padStart(2,'0'),kind:'bond',at:'2026-09-'+String(i+1).padStart(2,'0')+'T12:00:00.000Z'}))
 d.konoCare={...(d.konoCare??{}),[pid]:{profileId:pid,log:[{id:'bank-2026-01',kind:'bank',at:'2026-01-15T12:00:00.000Z',n:500},...cared]}}
 const care=()=>cloud.users.alice.plan.data.konoCare?.[pid]??{log:[]}
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 await (await openCorner(page)).getByRole('button',{name:/^World map/}).click()
 const world=page.getByRole('dialog',{name:'World map'})
 await world.getByRole('button',{name:'Go to Mossy Forest Glade'}).getByText('Acorn tumble').waitFor()
 // The beach: Shell chase. KONO walks right into the edge (no shells, so no coins and no coin round used).
 await world.getByRole('button',{name:'Go to Sandy Beach Cove'}).click()
 const beach=page.getByRole('dialog',{name:'Sandy Beach Cove'})
 await beach.getByRole('button',{name:'The Shell chase booth'}).click()
 await beach.getByRole('button',{name:'Play Shell chase'}).click()
 await startGame(page,'🐚 Shell chase')
 await beach.getByRole('application',{name:/^Shell chase/}).waitFor()
 if(process.env.KONO_SHOTS){await page.waitForTimeout(1200);await beach.getByRole('application',{name:/^Shell chase/}).screenshot({path:process.env.KONO_SHOTS+'/land-chase.png'})}
 await beach.getByRole('region',{name:'Results'}).getByText('KONO collected 0 shells',{exact:false}).waitFor({timeout:10000})
 await beach.getByRole('dialog',{name:'🐚 Shell chase'}).getByRole('button',{name:'Done'}).click()
 await beach.getByRole('dialog',{name:'🐚 Shell chase'}).waitFor({state:'detached'})
 await beach.getByRole('button',{name:'Play again'}).waitFor()
 await beach.getByRole('button',{name:'← World map'}).click()
 // The forest: Acorn tumble. Tap a piece with a matching neighbor, then finish for coins.
 await page.getByRole('dialog',{name:'World map'}).getByRole('button',{name:'Go to Mossy Forest Glade'}).click()
 const forest=page.getByRole('dialog',{name:'Mossy Forest Glade'})
 await forest.getByRole('button',{name:'The Acorn tumble booth'}).click()
 await forest.getByRole('button',{name:'Play Acorn tumble'}).click()
 await startGame(page,'🌰 Acorn tumble')
 const board=forest.getByRole('group',{name:'Acorn tumble'})
 await board.locator('.tumble-tile').first().waitFor()
 const pair=await board.evaluate(el=>{const at=new Map([...el.querySelectorAll('.tumble-tile')].map(b=>[b.dataset.c+','+b.dataset.r,b.dataset.kind]));for(const [k,kind] of at){const [c,r]=k.split(',').map(Number);if(at.get(c+','+(r+1))===kind||at.get((c+1)+','+r)===kind)return k}return null})
 assert.ok(pair,'a fresh board always has a pair somewhere')
 const [c,r]=pair.split(',')
 await board.locator('.tumble-tile[data-c="'+c+'"][data-r="'+r+'"]').click()
 await forest.getByText(/^Pieces left: (5[0-4]|[1-4]\d)$/).waitFor()
 if(process.env.KONO_SHOTS)await forest.screenshot({path:process.env.KONO_SHOTS+'/land-tumble.png'})
 await forest.getByRole('dialog',{name:'🌰 Acorn tumble'}).getByRole('button',{name:'■ End'}).click()
 await forest.getByRole('region',{name:'Results'}).getByText(/\+\d+ coins!/).waitFor()
 await forest.getByRole('dialog',{name:'🌰 Acorn tumble'}).getByRole('button',{name:'Done'}).click()
 await forest.getByRole('status').filter({hasText:/That’s \d+ points! 🌰.*\+\d+ coins!/}).waitFor()
 await waitFor(()=>care().log.some(e=>e.id==='game-2026-10-15-1'&&e.item==='game:tumble'&&e.n>=5),'the tumble coins never reached the account')
 await forest.getByRole('button',{name:'← World map'}).click()
 // The snowy village: Sled dash runs, and KONO steers between the lanes.
 await page.getByRole('dialog',{name:'World map'}).getByRole('button',{name:'Go to Snowy Mountain Village'}).click()
 const snow=page.getByRole('dialog',{name:'Snowy Mountain Village'})
 await snow.getByRole('button',{name:'The Sled dash booth'}).click()
 await snow.getByRole('button',{name:'Play Sled dash'}).click()
 await startGame(page,'🛷 Sled dash')
 await snow.getByRole('application',{name:/^Sled dash/}).waitFor()
 const lane=()=>snow.locator('.sled-kono').evaluate(el=>el.style.left)
 const middle=await lane()
 await snow.getByRole('button',{name:'Steer left'}).click()
 await page.waitForFunction(m=>document.querySelector('.sled-kono')?.style.left!==m,middle,{timeout:5000})
 if(process.env.KONO_SHOTS){await page.waitForTimeout(2500);await snow.getByRole('application',{name:/^Sled dash/}).screenshot({path:process.env.KONO_SHOTS+'/land-sled.png'})}
 // The arcade (here and in KONO Town) has KONO blast, the block puzzle: tap a piece, then a square; or drag one on.
 await snow.getByRole('dialog',{name:'🛷 Sled dash'}).getByRole('button',{name:'✕ Leave'}).click()
 await snow.getByRole('dialog',{name:'🛷 Sled dash'}).waitFor({state:'detached'})
 await snow.getByRole('button',{name:'🎮 Arcade'}).click()
 await snow.getByRole('region',{name:'Arcade'}).getByRole('button',{name:/KONO blast/}).click()
 await startGame(page,'🧱 KONO blast')
 const blast=snow.getByRole('grid',{name:'KONO blast board'})
 const score=async()=>Number((await snow.locator('.blast-score').textContent()))
 const pieces=snow.getByRole('group',{name:'Pieces'})
 await pieces.getByRole('button').first().click()
 await snow.getByText('Now tap the square for the piece’s top-left corner.').waitFor()
 await blast.getByRole('gridcell',{name:'Row 1, column 1'}).click()
 await page.waitForFunction(()=>Number(document.querySelector('.blast-score')?.textContent)>0,null,{timeout:5000})
 const first=await score()
 const piece=await pieces.getByRole("button").first().boundingBox(),area=await blast.boundingBox()
 await page.mouse.move(piece.x+piece.width/2,piece.y+piece.height/2);await page.mouse.down()
 for(let k=1;k<=8;k++)await page.mouse.move(piece.x+piece.width/2+(area.x+area.width*0.6-piece.x-piece.width/2)*k/8,piece.y+piece.height/2+(area.y+area.height*0.6+56-piece.y-piece.height/2)*k/8)
 if(process.env.KONO_SHOTS)await snow.getByRole('region',{name:'Arcade'}).screenshot({path:process.env.KONO_SHOTS+'/arcade-blast-drag.png'})
 await page.mouse.up()
 await page.waitForFunction(n=>Number(document.querySelector('.blast-score')?.textContent)>n,first,{timeout:5000})
 if(process.env.KONO_SHOTS)await snow.getByRole('region',{name:'Arcade'}).screenshot({path:process.env.KONO_SHOTS+'/arcade-blast.png'})
})

test('Round 54: KONO uses the furniture; visit Emma’s KONO and leave a snack; Undo after Add all; skip one turn of a repeating to-do',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 await page.clock.install({time:new Date('2026-10-15T15:00:00')}) // a Thursday afternoon
 d.profiles.push({id:'plan-emma',name:'Emma',label:'Emma’s plan',kind:'school',start:'2026-09-01',end:'2027-06-30',kidId:'kid-emma'})
 d.konoCare={...(d.konoCare??{}),[pid]:{profileId:pid,log:[{id:'bank-2026-01',kind:'bank',at:'2026-01-15T12:00:00.000Z',n:500},{id:'b-bed',kind:'buy',at:'2026-10-01T12:00:00.000Z',item:'furn:bed',n:120}],house:[{id:'h-bed',item:'bed',x:0.4,y:0.7}]},'plan-emma':{profileId:'plan-emma',log:[],house:[{id:'e-rug',item:'round-rug',x:0.5,y:0.7}]}}
 d.familyTodos=[{id:'t-trash',profileId:pid,title:'Trash out',done:false,due:'2026-10-16',repeat:'week',weekly:true}]
 const care=id=>cloud.users.alice.plan.data.konoCare?.[id]??{log:[]}
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 // KONO's house: now and then KONO goes off to use a piece, here the bed.
 await (await openCorner(page)).getByRole('button',{name:/^KONO’s house/}).click()
 const house=page.getByRole('dialog',{name:'KONO’s house'})
 const napping=house.getByText('KONO is napping in the cozy bed.')
 for(let i=0;i<12&&!await napping.isVisible();i++)await page.clock.runFor(3500)
 await napping.waitFor()
 await house.getByRole('button',{name:'Close dialog'}).click()
 // Visit family: Emma's KONO, and a snack left for it with a note.
 const corner=await openCorner(page)
 await corner.getByRole('button',{name:/^Visit family/}).click()
 await page.getByRole('dialog',{name:'Visit family'}).getByRole('button',{name:/Emma’s KONO/}).click()
 const visit=page.getByRole('dialog',{name:'Emma’s KONO'})
 await visit.getByRole('region',{name:'Leave a gift'}).getByLabel('Snack').selectOption('cookie')
 await visit.getByRole('region',{name:'Leave a gift'}).getByLabel('Note').fill('From Mom!')
 await visit.getByRole('button',{name:/^Give/}).click()
 await visit.getByText('Sent!',{exact:false}).waitFor()
 await waitFor(()=>care('plan-emma').log.some(e=>e.kind==='gift'&&e.item==='cookie'&&e.from==='Alice'&&e.note==='From Mom!')&&care(pid).log.some(e=>e.kind==='buy'&&e.item==='gift:cookie'&&e.n===12),'the gift never reached Emma’s KONO')
 assert.equal(await visit.getByRole('button',{name:'🪑 Arrange'}).count(),0,'nothing to arrange in someone else’s house')
 await visit.getByRole('button',{name:'Close dialog'}).click()
 // Add all, then Undo takes the whole batch back.
 const tasksBefore=cloud.users.alice.plan.data.tasks.length,examsBefore=cloud.users.alice.plan.data.exams.length
 await page.locator('.wb-header').getByRole('button',{name:'＋ Add'}).click()
 const box=page.locator('.quick-add-box textarea')
 await box.fill('bio worksheet due fri\nmath quiz monday')
 await page.getByRole('button',{name:'Add all 2'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.tasks.length===tasksBefore+1&&cloud.users.alice.plan.data.exams.length===examsBefore+1,'the batch never reached the account')
 await page.getByRole('button',{name:'Undo'}).first().click()
 await waitFor(()=>cloud.users.alice.plan.data.tasks.length===tasksBefore&&cloud.users.alice.plan.data.exams.length===examsBefore,'Undo never took the batch back')
 // Skip this one: the weekly to-do moves to next week, not ticked.
 await go(page,'Planner')
 await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Week'}).click()
 await page.getByRole('region',{name:'Week'}).getByRole('button',{name:/Trash out/}).click()
 await page.getByRole('dialog',{name:'Trash out'}).getByRole('button',{name:'⏭ Skip this one'}).click()
 await waitFor(()=>{const t=cloud.users.alice.plan.data.familyTodos.find(x=>x.id==='t-trash');return t.due==='2026-10-23'&&!t.done&&!t.doneAt},'Skip never moved the to-do to next week')
})

test('Round 53: tap a house on the island and KONO walks in, the island zooms into the door and KONO’s house opens; with two houses you pick KONO’s home',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 await page.clock.install({time:new Date('2026-10-02T15:00:00')})
 const place=(id,assetId,x,y)=>({id,assetId,x,y,rotation:0,scale:1,skewX:0,flipX:false})
 d.sanctuaryDecor={...(d.sanctuaryDecor??{}),[pid]:{profileId:pid,placements:[place('h-mush','home-mushroom-house',0.3,0.5),place('h-tea','home-tea-house',0.68,0.56)]}}
 const care=()=>cloud.users.alice.plan.data.konoCare?.[pid]??{}
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary');await islandLoaded(page)
 // The second house isn't KONO's home yet: tapping it asks first.
 await page.getByRole('button',{name:'The tea house: go in'}).click()
 const confirm=page.getByRole('dialog',{name:'Confirm change'})
 await confirm.getByText('Make the tea house KONO’s home?',{exact:false}).waitFor()
 await confirm.getByRole('button',{name:'Confirm'}).click()
 await waitFor(()=>care().home==='h-tea','KONO’s home never reached the account')
 // KONO walks over and in; the island zooms into the doorway; the house opens.
 await page.locator('.wb-sanctuary-zoom-wrap.is-entering').waitFor({timeout:12000})
 if(process.env.KONO_SHOTS){await page.waitForTimeout(400);await page.locator('.wb-island').screenshot({path:process.env.KONO_SHOTS+'/house-door-zoom.png'})}
 const house=page.getByRole('dialog',{name:'KONO’s house'})
 await house.waitFor({timeout:8000})
 await page.locator('.kono-house.is-entering').waitFor()
 // Two houses: KONO's home can be changed here too.
 await house.getByLabel('KONO lives in').selectOption('h-mush')
 await waitFor(()=>care().home==='h-mush','changing KONO’s home never reached the account')
 await house.getByRole('button',{name:'Close dialog'}).click()
 await page.getByRole('button',{name:'Go into KONO’s house'}).waitFor()
 // The island's tab goes in through KONO's home as well.
 await (await openCorner(page)).getByRole('button',{name:/^KONO’s house/}).click()
 await page.getByRole('dialog',{name:'KONO’s house'}).waitFor({timeout:15000})
})

test('Round 52: Paint KONO in the paint shop (it shows in the KONO bar), buy furniture, and arrange it in KONO’s house',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 await page.clock.install({time:new Date('2026-10-02T15:00:00')})
 d.konoCare={...(d.konoCare??{}),[pid]:{profileId:pid,log:[{id:'bank-2026-01',kind:'bank',at:'2026-01-15T12:00:00.000Z',n:2000}]}}
 const care=()=>cloud.users.alice.plan.data.konoCare[pid]
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const bar=page.getByRole('region',{name:'KONO today'})
 await bar.getByRole('button',{name:/^KONO Town: /}).click()
 const town=page.getByRole('dialog',{name:'KONO Town'})
 await town.getByRole('navigation',{name:'KONO Town'}).getByRole('button',{name:'Paint & home'}).click()
 // Paint: buy Starry, and KONO wears it straight away.
 await town.getByRole('region',{name:'Paint shop'}).getByRole('button',{name:/^Buy Starry for /}).click()
 await waitFor(()=>care().log.some(e=>e.kind==='buy'&&e.item==='paint:starry'),'the color bought never reached the account')
 await town.getByRole('region',{name:'Paint shop'}).getByRole('button',{name:'Paint KONO Starry'}).click()
 await waitFor(()=>care().log.some(e=>e.kind==='paint'&&e.item==='starry'),'the color picked never reached the account')
 await town.getByRole('region',{name:'Paint shop'}).getByRole('button',{name:'Take off Starry'}).waitFor()
 // Furniture: the rug is free; a bed costs coins.
 const shop=town.getByRole('region',{name:'Furniture shop'})
 await shop.getByRole('button',{name:'Buy Round rug for free'}).click()
 await shop.getByRole('button',{name:/^Buy Cozy bed for /}).click()
 await waitFor(()=>care().log.filter(e=>e.kind==='buy'&&e.item.startsWith('furn:')).length===2,'the furniture bought never reached the account')
 if(process.env.KONO_SHOTS)await town.screenshot({path:process.env.KONO_SHOTS+'/town-paint-home.png'})
 // Walls & floors: Mint cottage goes straight into the house.
 await town.getByRole('region',{name:'Walls & floors'}).getByRole('button',{name:/^Buy Mint cottage for /}).click()
 await waitFor(()=>care().room==='mint'&&care().log.some(e=>e.kind==='buy'&&e.item==='room:mint'),'the room style never reached the account')
 await town.getByRole('region',{name:'Walls & floors'}).getByRole('button',{name:'Mint cottage is in KONO’s house'}).waitFor()
 await shop.getByRole('button',{name:'🏠 Go to KONO’s house'}).click()
 const house=page.getByRole('dialog',{name:'KONO’s house'})
 await house.getByText('KONO’s house is empty!',{exact:false}).waitFor()
 assert.ok((await house.locator('.house-room').getAttribute('style')).includes('room-mint.webp'),'the house has its new walls and floor')
 await house.getByLabel('Walls & floor').selectOption('classic')
 await waitFor(()=>care().room==='classic','switching back never reached the account')
 await house.getByRole('button',{name:'🪑 Arrange'}).click()
 await house.getByRole('region',{name:'Storage'}).getByRole('button',{name:'Place the round rug'}).click()
 await house.getByRole('region',{name:'Storage'}).getByRole('button',{name:'Place the cozy bed'}).click()
 await waitFor(()=>(care().house??[]).length===2,'the placed furniture never reached the account')
 // Drag the bed to the left, then make it bigger.
 const bed=house.getByRole('button',{name:'Cozy bed, drag to move'});await page.waitForFunction(()=>[...document.querySelectorAll('.house-piece img')].every(i=>i.complete&&i.naturalWidth));const box=await bed.boundingBox()
 await page.mouse.move(box.x+box.width/2,box.y+box.height*0.6);await page.mouse.down();await page.mouse.move(box.x+box.width/2-120,box.y+box.height*0.6-20,{steps:6});await page.mouse.up()
 await waitFor(()=>{const b=(care().house??[]).find(h=>h.item==='bed');return b&&b.x<0.45},'the bed never moved')
 await house.getByRole('group',{name:'Change the cozy bed'}).getByRole('button',{name:'Bigger'}).click()
 await waitFor(()=>(care().house??[]).find(h=>h.item==='bed')?.size>1,'the bed never grew')
 await house.getByRole('button',{name:'Done arranging'}).click()
 // KONO, in its new color, can be patted in the house.
 const kono=house.getByRole('button',{name:'Pet KONO'})
 assert.ok((await kono.locator('img').first().getAttribute('src')).includes('/garden/kono/colors/starry/'),'KONO wears its color in the house')
 await kono.click()
 if(process.env.KONO_SHOTS)await house.screenshot({path:process.env.KONO_SHOTS+'/house.png'})
 await house.getByRole('button',{name:'Close dialog'}).click()
 if(process.env.KONO_SHOTS){await islandLoaded(page);await page.waitForTimeout(3000);await page.locator('.wb-island').screenshot({path:process.env.KONO_SHOTS+'/island-starry.png'})}
 // KONO's face in the KONO bar is Starry too.
 assert.ok((await bar.locator('.kono-mood-face img').first().getAttribute('src')).includes('/garden/kono/colors/starry/'),'the KONO bar shows the color')
 // KONO's corner opens the house; the album counts colors and furniture.
 const corner=await openCorner(page)
 await corner.getByRole('button',{name:/^KONO’s house/}).waitFor()
 await corner.getByRole('button',{name:/^Album/}).click()
 await page.getByRole('dialog',{name:'KONO Town'}).getByRole('region',{name:'Colors'}).getByRole('listitem',{name:'Starry',exact:true}).waitFor()
 await page.getByRole('dialog',{name:'KONO Town'}).getByRole('region',{name:'Furniture'}).getByRole('listitem',{name:'Cozy bed',exact:true}).waitFor()
})

test('Round 51: KONO Town: a surprise to collect, coins in the KONO bar, the food shop, the boutique, today’s quest, the prize wheel, the arcade and the album',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId,day='2026-10-01'
 await page.clock.install({time:new Date(day+'T15:00:00')})
 // The quest's snack (the same pick as store/konoCoins), waiting as a gift, and some coins from an old month.
 const hash=t=>{let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
 const TREATS=[['onigiri','rice ball'],['dumpling','dumpling'],['dango','dango'],['strawberry','strawberry'],['cookie','cookie'],['peach','peach'],['bento','bento box'],['cake','slice of cake'],['boba','boba tea']]
 const [questId,questName]=TREATS[hash(pid+day+'quest')%TREATS.length]
 d.konoCare={...(d.konoCare??{}),[pid]:{profileId:pid,log:[{id:'bank-2026-01',kind:'bank',at:'2026-01-15T12:00:00.000Z',n:500},{id:'gift-1',kind:'gift',at:day+'T10:00:00.000Z',item:questId,from:'Mom'}]}}
 const log=()=>cloud.users.alice.plan.data.konoCare[pid].log
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 const bar=page.getByRole('region',{name:'KONO today'})
 await bar.getByRole('button',{name:/^KONO Town: 510 coins$/}).waitFor()
 // Something has happened! (a few seconds into the visit)
 await bar.getByText('Something has happened!').waitFor({timeout:15000})
 await bar.getByRole('button',{name:'Collect'}).click()
 await waitFor(()=>log().some(e=>e.id==='event-'+day&&e.n>0),'the surprise never reached the account')
 const surprise=log().find(e=>e.id==='event-'+day).n
 if(process.env.KONO_SHOTS)await bar.screenshot({path:process.env.KONO_SHOTS+'/town-bar.png'})
 await bar.getByRole('button',{name:'KONO Town: '+(510+surprise)+' coins'}).click()
 const town=page.getByRole('dialog',{name:'KONO Town'})
 await town.getByText((510+surprise)+' coins',{exact:true}).waitFor()
 if(process.env.KONO_SHOTS)await town.screenshot({path:process.env.KONO_SHOTS+'/town-shops.png'})
 // The quest: KONO wants the snack Mom sent.
 const quest=town.getByRole('region',{name:'KONO’s quest'})
 await quest.getByText('KONO is craving a '+questName,{exact:false}).waitFor()
 await quest.getByRole('button',{name:'Give the '+questName}).click()
 await quest.getByText('Quest done!').waitFor()
 await waitFor(()=>log().some(e=>e.id==='quest-'+day&&e.n>0)&&log().some(e=>e.kind==='feed'&&e.taskId==='gift-1'),'the quest never reached the account')
 // Food shop: a snack for KONO; Boutique: the cozy beanie.
 const food=town.getByRole('region',{name:'Food shop'})
 await food.getByRole('button',{name:/^Buy /}).first().click()
 await town.getByText('It’s with KONO’s snacks.',{exact:false}).waitFor()
 await waitFor(()=>log().some(e=>e.kind==='buy'&&e.item.startsWith('food:')),'the snack bought never reached the account')
 await town.getByRole('region',{name:'Boutique'}).getByRole('button',{name:/^Buy Cozy beanie for /}).click()
 await waitFor(()=>log().some(e=>e.kind==='buy'&&e.item==='outfit:beanie'),'the outfit bought never reached the account')
 await town.getByRole('region',{name:'Boutique'}).getByRole('button',{name:/^Buy Cozy beanie/}).waitFor({state:'detached'})
 // Prize wheel: one spin a day.
 await town.getByRole('navigation',{name:'KONO Town'}).getByRole('button',{name:'Prize wheel'}).click()
 await town.getByRole('button',{name:'Spin the wheel'}).click()
 await town.getByText(/^🎉 You won \d+ coins!$/).waitFor({timeout:10000})
 await waitFor(()=>log().some(e=>e.id==='spin-'+day),'the spin never reached the account')
 assert.equal(await town.getByRole('button',{name:'Spun today'}).isDisabled(),true)
 if(process.env.KONO_SHOTS)await town.screenshot({path:process.env.KONO_SHOTS+'/town-wheel.png'})
 await town.getByRole('navigation',{name:'KONO Town'}).getByRole('button',{name:'Arcade'}).click()
 await town.getByText('3 of 3',{exact:true}).waitFor()
 // The arcade has KONO blast (Memory match, Bubble pop, Snack catch and Peekaboo are gone).
 await town.getByRole('button',{name:/KONO blast/}).waitFor()
 assert.equal(await town.getByRole('button',{name:/Memory match|Bubble pop|Snack catch|Peekaboo/}).count(),0)
 // Album: the beanie is in, with how far along the whole collection is.
 await town.getByRole('navigation',{name:'KONO Town'}).getByRole('button',{name:'Album'}).click()
 await town.getByRole('region',{name:'Outfits'}).getByRole('listitem',{name:'Cozy beanie',exact:true}).waitFor()
 await town.getByText(/^\d+ of \d+ collected$/).first().waitFor()
 if(process.env.KONO_SHOTS)await town.screenshot({path:process.env.KONO_SHOTS+'/town-album.png'})
 if(process.env.KONO_SHOTS){await page.setViewportSize({width:390,height:844});await town.getByRole('navigation',{name:'KONO Town'}).getByRole('button',{name:'Shops'}).click();await page.waitForTimeout(400);await page.screenshot({path:process.env.KONO_SHOTS+'/town-phone.png'});await town.getByRole('button',{name:'Close dialog'}).click();await bar.scrollIntoViewIfNeeded();await bar.screenshot({path:process.env.KONO_SHOTS+'/town-bar-phone.png'});await bar.getByRole('button',{name:/^KONO Town/}).click();await page.setViewportSize({width:1280,height:900})}
 await town.getByRole('button',{name:'Close dialog'}).click()
 // KONO's corner has KONO Town and the album too.
 const corner=await openCorner(page)
 await corner.getByRole('button',{name:/^KONO Town: shops, prize wheel and arcade/}).waitFor()
 await corner.getByRole('button',{name:/^Album/}).waitFor()
})

test('Round 50: several lines in ＋ Add at once; an event typed again takes last time’s details; a repeat can be moved a day or deleted from a date on; search finds a to-do; a kid’s own plan shows their to-dos',async({context,page})=>{
 const cloud=fakeCloud(),d=cloud.users.alice.plan.data,pid=d.activeProfileId
 await page.clock.install({time:new Date('2026-10-15T09:00:00')}) // a Thursday
 d.calendarEvents.push({id:'soc-old',profileId:pid,date:'2026-10-08',title:'Soccer practice',kind:'sports',notes:'',time:'16:00',endTime:'17:30',kidId:'kid-emma',location:'Riverside Park',driver:'Mom'})
 for(const date of ['2026-10-15','2026-10-16','2026-10-17','2026-10-18'])d.calendarEvents.push({id:'swim-'+date,profileId:pid,date,title:'Swim lesson',kind:'lesson',notes:'',time:'18:00',kidId:'kid-leo',recurringId:'rec-swim'})
 d.familyTodos=[{id:'t-clean',profileId:pid,title:'Clean house',done:false,due:'2026-10-17',repeat:'week',weekly:true},{id:'t-slip',profileId:pid,title:'Sign permission slip',done:false,forKidId:'kid-emma'}]
 d.profiles.push({id:'plan-emma',name:'Emma',label:'Emma’s plan',kind:'school',start:'2026-09-01',end:'2027-06-30',kidId:'kid-emma'})
 await signInAs(context,cloud,'alice')
 await page.goto(BASE);await heading(page,'Sanctuary')
 // Several at once, and "soccer practice" remembers its time, place, driver and kid.
 await page.getByRole('button',{name:'＋ Add',exact:true}).click()
 const chooser=page.getByRole('dialog',{name:'Add to your plan'})
 await chooser.getByLabel('Type it').fill('soccer practice sat\ndentist fri 3pm for Leo\ngroceries')
 await chooser.getByText('3 things to add').waitFor()
 assert.match(await chooser.locator('.quick-add-many').innerText(),/Event: Soccer practice\s+Sat, Oct 17 · 4:00 PM–5:30 PM · For Emma · 📍 Riverside Park · 🚗 Mom · like last time/)
 await chooser.getByRole('button',{name:'Add all 3'}).click()
 await waitFor(()=>{const p=cloud.users.alice.plan.data,s=p.calendarEvents.find(e=>e.date==='2026-10-17'&&e.title==='Soccer practice');return s&&s.time==='16:00'&&s.location==='Riverside Park'&&s.driver==='Mom'&&(s.kidId==='kid-emma'||s.profileId==='plan-emma')&&p.calendarEvents.some(e=>e.title==='Dentist'&&e.time==='15:00')&&p.familyTodos.some(t=>t.title==='Groceries')},'the three never reached the account as read')
 // Search finds a to-do and opens it.
 await page.getByRole('button',{name:'Search'}).first().click()
 const search=page.getByRole('dialog',{name:'Search your work'})
 await search.getByRole('combobox').fill('clean house')
 await search.getByRole('group',{name:'To-dos'}).getByText('Clean house').click()
 await page.getByRole('dialog',{name:'Change to-do'}).getByLabel('To-do').waitFor()
 await page.getByRole('dialog',{name:'Change to-do'}).getByRole('button',{name:'Cancel'}).click()
 // Swim lesson every day Thu–Sun: moved a day later for all of them, then deleted from Sat on.
 await go(page,'Planner')
 await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Month'}).click()
 await page.getByRole('button',{name:/^Swim lesson · 6p · Leo · Oct 15, 2026/}).click()
 const editor=page.getByRole('dialog',{name:'Edit event'})
 await editor.getByLabel('Date').fill('2026-10-16')
 await editor.getByLabel('All of them').check()
 await editor.getByRole('button',{name:'Save'}).click()
 const swim=()=>cloud.users.alice.plan.data.calendarEvents.filter(e=>e.recurringId==='rec-swim').map(e=>e.date).sort().join()
 await waitFor(()=>swim()==='2026-10-16,2026-10-17,2026-10-18,2026-10-19','moving one a day later never moved the rest')
 await page.getByRole('group',{name:'Calendar view'}).getByRole('button',{name:'Schedule'}).click()
 const sat=page.locator('.wb-agenda-day').filter({hasText:'Oct 18, 2026'}).filter({hasText:'Swim lesson'})
 await sat.locator('summary').first().click()
 const tile=sat.locator('article, .wb-family-event').filter({hasText:'Swim lesson'}).first()
 await tile.getByText('More actions').click()
 await tile.getByRole('button',{name:'Delete this and the ones after'}).click()
 await page.getByRole('dialog',{name:'Confirm change'}).getByRole('button',{name:'Confirm'}).click()
 await waitFor(()=>swim()==='2026-10-16,2026-10-17','deleting from Oct 18 on kept the wrong dates')
 // Emma’s own plan: the to-do her parent made for her, to tick off.
 await go(page,'Sanctuary')
 await page.getByRole('button',{name:'Whose plan?'}).first().click()
 await page.getByRole('dialog',{name:'Whose plan?'}).getByRole('button',{name:/Emma’s plan/}).click()
 await heading(page,'Sanctuary')
 const mine=page.getByRole('region',{name:'Your to-dos'})
 await mine.getByRole('checkbox',{name:'Sign permission slip'}).click()
 await waitFor(()=>cloud.users.alice.plan.data.familyTodos.find(t=>t.id==='t-slip').done,'Emma ticking her to-do never reached the account')
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
