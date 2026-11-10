import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { MarketProvider } from './store'
import './styles.css'

document.documentElement.dataset.theme = window.location.hash.includes('/buyer') ? 'light' : 'dark'

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing')

createRoot(root).render(
  <StrictMode>
    <MarketProvider>
      <App />
    </MarketProvider>
  </StrictMode>,
)
