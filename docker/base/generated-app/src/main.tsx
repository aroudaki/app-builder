import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

/**
 * MAIN ENTRY POINT
 * 
 * CODER AGENT INSTRUCTIONS:
 * - This is the application entry point - usually doesn't need modification
 * - The App component is rendered here
 * - Global CSS (index.css) is imported here
 * - If you need to add global providers (Context, Redux, etc.), add them here
 * - React StrictMode is enabled for development warnings
 * 
 * CURRENT STATE: Standard React 18 setup with StrictMode
 */

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
