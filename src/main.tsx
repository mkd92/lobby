import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { OwnerProvider } from './context/OwnerContext'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Expose so Settings page can trigger updates
declare global { interface Window { __updateSW?: (reloadPage?: boolean) => Promise<void> } }

// Lock to portrait on mobile PWA
if (screen?.orientation && typeof (screen.orientation as any).lock === 'function') {
  (screen.orientation as any).lock('portrait').catch(() => {/* not supported in all contexts */});
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (confirm('A new update is available. Refresh to apply?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
  onRegisteredSW(_swUrl, r) {
    if (r) {
      // Periodic update check every 30 mins
      setInterval(() => {
        console.log('Checking for updates...');
        r.update();
      }, 30 * 60 * 1000);
    }
  }
})

window.__updateSW = updateSW

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <OwnerProvider>
          <App />
        </OwnerProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
