import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/base.css'
import './styles/home.css'
import './styles/workout.css'
import './styles/stats.css'
import './styles/plan.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { installAudioUnlock } from './lib/alert.ts'
import { registerSW } from './lib/registerSW.ts'

installAudioUnlock()
registerSW()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary standalone>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
