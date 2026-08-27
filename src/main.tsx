import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/tokens.css'
import './ui/fonts.css'
import './ui/reset.css'
import { App } from './App.js'
import { registerServiceWorker } from './pwa/register.js'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
