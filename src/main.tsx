import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { captureInstallPrompt } from './store/installPrompt'

/** The decorating studio (?page=build) is a separate tool, so its code only downloads there. */
// eslint-disable-next-line react-refresh/only-export-components -- the entry file has no exports to refresh
const SanctuaryBuildStudio = lazy(() => import('./components/SanctuaryBuildStudio'))
/** The island test page (dev only, ?sanctuaryQA). */
// eslint-disable-next-line react-refresh/only-export-components -- the entry file has no exports to refresh
const SanctuaryQA = lazy(() => import('./SanctuaryQA'))
/** kono.shop: the polo collection and try-on, at /shop (or ?page=shop); its code and pose model only load there. */
// eslint-disable-next-line react-refresh/only-export-components -- the entry file has no exports to refresh
const KonoShop = lazy(() => import('./shop/KonoShop'))
const params = new URLSearchParams(window.location.search)
const isShop = window.location.pathname.replace(/\/+$/, '') === '/shop' || params.get('page') === 'shop'
captureInstallPrompt()

/** KONO's Google Fonts (DM Sans, Newsreader, Caveat; the Zen pair only once Zen Ink is picked). Added from
 * here rather than a CSS @import so they never hold up the first paint: the page shows in the system font
 * and swaps when they arrive. */
const addFont = (href: string) => { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; document.head.append(link) }
addFont('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,600&family=Caveat:wght@600;700&display=swap')
const zenFont = () => { if (document.documentElement.dataset.experience !== 'sumi') return; addFont('https://fonts.googleapis.com/css2?family=Zen+Old+Mincho:wght@500;600&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap'); zenWatch.disconnect() }
const zenWatch = new MutationObserver(zenFont)
zenWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-experience'] })
zenFont()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>{isShop ? <Suspense fallback={null}><KonoShop /></Suspense> : params.get('page') === 'build' ? <Suspense fallback={null}><SanctuaryBuildStudio /></Suspense> : import.meta.env.DEV && params.has('sanctuaryQA') ? <Suspense fallback={null}><SanctuaryQA /></Suspense> : <App />}</ErrorBoundary>
  </StrictMode>,
)

/** Lets KONO open and keep working with no connection, once loaded here at least once. */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
  /** The service worker activates a new version immediately (skipWaiting + clients.claim), but an
   * already-open tab keeps running the JS it already loaded into memory until reloaded — without this,
   * a shipped fix can silently never reach a student who just leaves the tab open. Skip the very first
   * controllerchange (no prior controller means this is the first-ever install, not an update). */
  let announced = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || announced) return
    announced = true
    const bar = document.createElement('div')
    bar.setAttribute('role', 'status')
    bar.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:9999;display:flex;gap:10px;align-items:center;justify-content:center;padding:10px 14px;background:#1f2937;color:#fff;font:600 .85rem system-ui,sans-serif'
    const text = document.createElement('span')
    text.textContent = 'KONO has an update ready.'
    const button = document.createElement('button')
    button.textContent = 'Refresh now'
    button.style.cssText = 'background:#fff;color:#1f2937;border:0;border-radius:999px;padding:6px 14px;font-weight:700;cursor:pointer'
    button.onclick = () => window.location.reload()
    bar.append(text, button)
    document.body.appendChild(bar)
  })
}

/** Vercel Web Analytics: counts visits with no cookies and nothing that identifies a person. The script
 * only exists where Vercel serves it with analytics turned on, so check before loading it. */
if (import.meta.env.PROD) {
  // After load and once the phone is idle, so it never competes with the first screen.
  const idle = (run: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(run, { timeout: 6000 }) : setTimeout(run, 3000))
  window.addEventListener('load', () => idle(() => {
    fetch('/_vercel/insights/script.js', { method: 'HEAD' }).then(response => {
      if (!response.ok || !/javascript/i.test(response.headers.get('content-type') ?? '')) return
      const script = document.createElement('script')
      script.defer = true
      script.src = '/_vercel/insights/script.js'
      document.head.appendChild(script)
    }).catch(() => undefined)
  }))
}
