import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { RouteError } from '@/components/extras'
import { Toaster } from '@/components/ui/sonner'
import { leaveOn401, queryRetry, queryRetryDelay } from '@/lib/api'
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

const signedOut = (error: unknown) => leaveOn401(error, queryClient, router)

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error, query) => query.queryKey[0] !== 'me' && signedOut(error) }),
  mutationCache: new MutationCache({ onError: signedOut }),
  defaultOptions: {
    queries: {
      retry: queryRetry,
      retryDelay: queryRetryDelay,
      refetchOnWindowFocus: false,
    },
  },
})

const router = createBrowserRouter([{ path: '*', element: <App />, errorElement: <RouteError /> }])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors />
    </QueryClientProvider>
  </StrictMode>,
)
