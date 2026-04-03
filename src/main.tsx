import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './context/ThemeContext'
import { OwnerProvider } from './context/OwnerContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // cache for 5 minutes
      gcTime: 1000 * 60 * 10,     // keep in memory for 10 minutes
      retry: 1,
    },
  },
})
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
      // Check for updates when user returns to the tab instead of polling
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') r.update();
      });
    }
  }
})

window.__updateSW = updateSW

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <OwnerProvider>
            <App />
          </OwnerProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
