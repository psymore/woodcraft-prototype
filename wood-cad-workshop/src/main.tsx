import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted (was a render-blocking Google Fonts stylesheet): only the
// weights index.css actually uses. Each weight's CSS covers every subset
// via unicode-range, so browsers still fetch just the subset they need.
import '@fontsource/archivo/500.css'
import '@fontsource/archivo/600.css'
import '@fontsource/archivo/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
