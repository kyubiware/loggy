import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Popup from './Popup'
import './index.css'

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <Popup />
    </StrictMode>,
  )
}
