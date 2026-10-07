import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App.tsx'
import { registerSW } from './lib/registerSW.ts'

registerSW()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
