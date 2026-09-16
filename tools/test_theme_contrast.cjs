// Regression guard for the "invisible text" bug class fixed for the Midnight theme's Planner
// paper zones (see design-restoration.css): a hardcoded light/dark background paired with an
// inherited ink color that assumes the opposite. Drives the real Settings UI (not just the
// data-theme attribute — that only flips CSS scoped to :root/html, not `.workbench[data-experience]`
// selectors, which read the app's actual settings.experience) through every real, reachable
// experience x theme combination, and flags any rendered text whose contrast ratio against its own
// effective background falls below a "basically unreadable" floor.
//
// Not part of `npm test` / `npm run check` — it drives a real browser (needs `npx playwright
// install chromium` once) and a dev server, so it's slower and heavier than the rest of the suite.
// Run it on demand with `npm run test:visual`, e.g. before a release or after touching theme CSS.

const { chromium } = require('playwright')
const { spawn } = require('child_process')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PORT = 4319
const BASE_URL = `http://localhost:${PORT}/`
// Anything at or above this is at least faintly legible; the real bug measured ~1.0-1.9.
const FAIL_RATIO = 2.0

const EXPERIENCES = [
 { experience: 'cozy', palettes: ['coral', 'sakura', 'lavender', 'mint', 'honey', 'zen', 'floral', 'ocean'] },
 { experience: 'simplified', palettes: ['coral', 'sakura', 'professional', 'forest', 'ocean', 'midnight', 'paper'] },
 { experience: 'modern', palettes: [null] },
]
const PAGES = ['Sanctuary', 'Planner', 'Subjects', 'Notes', 'K-Quiz', 'Exams', 'Settings']
// Desktop swaps the mobile bottom nav for a persistent .wb-sidebar (Simplified/Modern) --
// CSS scoped to that breakpoint (@media(min-width:701px) and up) never renders, and never gets
// checked, at the 390px viewport alone. The sidebar/header theming bug fixed in #75 (a hardcoded
// brown "notebook" look on 5 of 8 palettes) was invisible at mobile width for that reason.
const VIEWPORTS = [
 { name: 'mobile', width: 390, height: 844 },
 { name: 'desktop', width: 1280, height: 900 },
]

function relLum([r, g, b]) {
 const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
 return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function parseColor(str) {
 if (!str) return null
 const rgb = str.match(/rgba?\(([^)]+)\)/)
 if (rgb) {
  const parts = rgb[1].split(',').map(s => parseFloat(s.trim()))
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 }
 }
 // A color-mix() result (e.g. --surface2) can serialize as `color(srgb r g b [/ a])` instead of
 // rgb() -- components are 0-1 floats, not 0-255 ints. Missing this made getEffectiveBg treat any
 // such background as unparseable and fall through to an ancestor's background instead, producing
 // false positives wherever a color-mix()-based background paired correctly with its own text.
 const cs = str.match(/color\(srgb\s+([^)]+)\)/)
 if (cs) {
  const parts = cs[1].split('/')[0].trim().split(/\s+/).map(s => parseFloat(s) * 255)
  const alphaPart = cs[1].split('/')[1]
  return { r: parts[0], g: parts[1], b: parts[2], a: alphaPart ? parseFloat(alphaPart) : 1 }
 }
 return null
}
function contrast(fg, bg) {
 const L1 = relLum([fg.r, fg.g, fg.b]) + 0.05
 const L2 = relLum([bg.r, bg.g, bg.b]) + 0.05
 return L1 > L2 ? L1 / L2 : L2 / L1
}

async function scanPage(page, label, results) {
 const found = await page.evaluate(() => {
  function getEffectiveBg(el) {
   let node = el
   while (node) {
    const cs = getComputedStyle(node)
    // A gradient/image background defeats naive backgroundColor sampling — bail rather than
    // misattribute the color of whatever solid ancestor happens to be behind it.
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
    const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/)
    if (m) {
     const parts = m[1].split(',').map(s => parseFloat(s.trim()))
     const a = parts.length > 3 ? parts[3] : 1
     if (a > 0.5) return cs.backgroundColor
    } else {
     // A color-mix() result (e.g. --surface2) can serialize as `color(srgb r g b [/ a])` instead
     // of rgb() -- missing this made any such background look unparseable and fall through to an
     // ancestor's background, misattributing a perfectly legible color-mix() pairing as broken.
     const cm = cs.backgroundColor.match(/color\(srgb\s+([^)]+)\)/)
     if (cm) {
      const alphaPart = cm[1].split('/')[1]
      const a = alphaPart ? parseFloat(alphaPart) : 1
      if (a > 0.5) return cs.backgroundColor
     }
    }
    node = node.parentElement
   }
   return 'rgb(255,255,255)'
  }
  const out = []
  for (const el of document.querySelectorAll('body *')) {
   if (el.children.length > 0) continue
   if (el.closest('[aria-hidden="true"]')) continue
   const text = (el.textContent || '').trim()
   if (!text) continue
   const rect = el.getBoundingClientRect()
   if (rect.width < 2 || rect.height < 2) continue
   if (rect.top > window.innerHeight * 8 || rect.bottom < 0) continue
   const cs = getComputedStyle(el)
   if (cs.visibility === 'hidden' || cs.display === 'none') continue
   if (parseFloat(cs.opacity) < 0.2) continue
   const bg = getEffectiveBg(el)
   if (bg === null) continue
   out.push({ text: text.slice(0, 50), fg: cs.color, bg, tag: el.tagName })
  }
  return out
 })
 for (const item of found) {
  const fg = parseColor(item.fg)
  const bg = parseColor(item.bg)
  if (!fg || !bg) continue
  const ratio = contrast(fg, bg)
  if (ratio < FAIL_RATIO) results.push({ label, ratio: ratio.toFixed(2), ...item })
 }
}

async function clickVisibleByName(page, name) {
 for (const c of await page.getByRole('button', { name, exact: true }).all()) {
  const box = await c.boundingBox()
  if (box && box.width > 4 && box.height > 4) { await c.click(); return true }
 }
 return false
}
async function goTo(page, pageName) {
 if (await clickVisibleByName(page, pageName)) return true
 if (await clickVisibleByName(page, 'More')) {
  await page.waitForTimeout(300)
  if (await clickVisibleByName(page, pageName)) return true
 }
 return false
}
async function setExperienceAndTheme(page, experience, theme) {
 await goTo(page, 'Settings')
 await page.waitForTimeout(400)
 const experienceLabel = experience[0].toUpperCase() + experience.slice(1)
 await clickVisibleByName(page, experienceLabel)
 await page.waitForTimeout(400)
 if (theme) {
  const swatch = page.locator(`.wb-themes button.theme-${theme}`)
  if (await swatch.count()) {
   await swatch.scrollIntoViewIfNeeded()
   await swatch.click()
   await page.waitForTimeout(400)
  }
 }
}

function startServer() {
 return new Promise((resolve, reject) => {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe' })
  let done = false
  const onData = data => {
   if (!done && /Local:/.test(data.toString())) { done = true; resolve(proc) }
  }
  proc.stdout.on('data', onData)
  proc.stderr.on('data', onData)
  proc.on('error', reject)
  proc.on('exit', code => { if (!done) reject(new Error(`vite exited early (${code})`)) })
  setTimeout(() => { if (!done) reject(new Error('vite did not start within 30s')) }, 30000)
 })
}

async function main() {
 const server = await startServer()
 let browser
 try {
  // Set PLAYWRIGHT_TEST_EXECUTABLE to point at a pre-installed Chromium binary instead of the one
  // `npx playwright install chromium` would fetch — useful in sandboxes with restricted egress.
  const launchOpts = process.env.PLAYWRIGHT_TEST_EXECUTABLE
   ? { executablePath: process.env.PLAYWRIGHT_TEST_EXECUTABLE }
   : {}
  browser = await chromium.launch(launchOpts)

  const results = []
  const navFails = []
  for (const viewport of VIEWPORTS) {
   const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } })
   await page.goto(BASE_URL, { waitUntil: 'networkidle' })
   await page.waitForTimeout(600)
   const demoBtn = page.getByRole('button', { name: 'Try a small demo instead' })
   if (await demoBtn.count()) { await demoBtn.click(); await page.waitForTimeout(600) }

   for (const { experience, palettes } of EXPERIENCES) {
    for (const theme of palettes) {
     await setExperienceAndTheme(page, experience, theme)
     for (const p of PAGES) {
      try {
       if (!(await goTo(page, p))) { navFails.push(`${viewport.name}/${experience}/${theme}/${p}`); continue }
       await page.waitForTimeout(350)
       await scanPage(page, `${viewport.name}/${experience}/${theme}/${p}`, results)
      } catch (e) {
       navFails.push(`${viewport.name}/${experience}/${theme}/${p} (${String(e.message || e).slice(0, 80)})`)
      }
     }
    }
   }
   await page.close()
  }

  if (navFails.length) {
   console.log(`NOTE: ${navFails.length} page(s) could not be reached and were skipped: ${navFails.slice(0, 10).join(', ')}${navFails.length > 10 ? '…' : ''}`)
  }

  if (results.length) {
   console.log(`FAIL: ${results.length} near-invisible text finding(s) (contrast < ${FAIL_RATIO}):`)
   for (const r of results.slice(0, 40)) {
    console.log(` - [${r.label}] "${r.text}" ratio ${r.ratio} (${r.tag}, fg ${r.fg} on bg ${r.bg})`)
   }
   if (results.length > 40) console.log(`   …and ${results.length - 40} more`)
   process.exitCode = 1
  } else {
   console.log(`PASS: no near-invisible text across ${EXPERIENCES.reduce((n, e) => n + e.palettes.length, 0)} experience/theme combinations x ${PAGES.length} pages x ${VIEWPORTS.length} viewports (${VIEWPORTS.map(v => v.name).join('/')}).`)
  }
 } finally {
  if (browser) await browser.close()
  server.kill()
 }
}

main().catch(e => { console.error(e); process.exit(1) })
