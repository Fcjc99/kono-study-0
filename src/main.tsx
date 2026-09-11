import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SanctuaryQA from './SanctuaryQA'
import ErrorBoundary from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>{import.meta.env.DEV && new URLSearchParams(window.location.search).has('sanctuaryQA') ? <SanctuaryQA /> : <App />}</ErrorBoundary>
  </StrictMode>,
)
