import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// main.jsx = the entry point. It mounts <App /> into index.html's <div id="root">.
//
// BrowserRouter enables client-side routing: when you click "Employees",
// React changes the URL (e.g. /employees) and swaps pages WITHOUT a full
// browser reload. That is what makes it feel like a single-page app.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
