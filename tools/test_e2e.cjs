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
 return new Promise((resolve,reject)=>{
  const proc=spawn(process.execPath,[path.join(ROOT,'node_modules','vite','bin','vite.js'),'preview','--port',String(PORT),'--strictPort'],{cwd:ROOT,stdio:'pipe'})
  let done=false
  const onData=data=>{if(!done&&/Local:/.test(data.toString())){done=true;resolve(proc)}}
  proc.stdout.on('data',onData);proc.stderr.on('data',onData)
  proc.on('error',reject)
  proc.on('exit',code=>{if(!done)reject(new Error(`vite preview exited early (${code})`))})
  setTimeout(()=>{if(!done)reject(new Error('vite preview did not start within 30s'))},30000)
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
async function createPlan(page){
 await page.goto(BASE)
 await page.getByLabel('Your name').fill('Sam')
 await page.getByLabel('Plan name').fill('Fall term')
 await page.getByRole('button',{name:'Create my study plan'}).click()
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

test('a new visitor can create a plan and lands in their Sanctuary',async({page})=>{
 await page.goto(BASE)
 await page.getByRole('heading',{name:'A little space for steady progress.'}).waitFor()
 await createPlan(page)
 for(const name of ['Planner','Notes','Exams','Settings','Sanctuary'])await go(page,name)
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
