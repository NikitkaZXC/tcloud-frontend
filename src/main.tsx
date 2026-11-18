import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { ApiError } from '@/lib/api'
import { resolveLang, setLang } from '@/lib/i18n'
import { getSettings, subscribeSettings } from '@/lib/settings'
import { applyTheme } from '@/lib/theme'
import App from './App'
import './index.css'

function applySettings() {
  const ui = getSettings().interface
  applyTheme(ui.theme)
  document.documentElement.classList.toggle('still', !ui.animations)
  const lang = resolveLang(ui.language, navigator.language)
  document.documentElement.lang = lang
  setLang(lang)
}

applySettings()
subscribeSettings(applySettings)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster richColors />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
