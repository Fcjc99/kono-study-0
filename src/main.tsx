import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SanctuaryQA from './SanctuaryQA'
import SanctuaryBuildStudio from './components/SanctuaryBuildStudio'
import ErrorBoundary from './components/ErrorBoundary'

const params = new URLSearchParams(window.location.search)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>{params.get('page') === 'build' ? <SanctuaryBuildStudio /> : import.meta.env.DEV && params.has('sanctuaryQA') ? <SanctuaryQA /> : <App />}</ErrorBoundary>
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
