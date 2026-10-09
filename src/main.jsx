import React from 'react'
import { createRoot } from 'react-dom/client'
// Shared stylesheets must be evaluated BEFORE App so that per-section CSS (imported inside components) wins the cascade.
import './styles/global.css'
import './styles/components.css'
import './styles/sections.css'
import './styles/shell.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
