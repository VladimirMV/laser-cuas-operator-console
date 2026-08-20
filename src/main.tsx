import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode disabled for demo: it double-invokes effects in dev and can flash media
createRoot(document.getElementById('root')!).render(<App />)
