import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './components/common/Toast.jsx'
import { ConfirmProvider } from './components/common/ConfirmProvider.jsx'
import './index.css'

// main.jsx = the entry point. It mounts <App /> into index.html's <div id="root">.
//
// BrowserRouter enables client-side routing: when you click "Employees",
// React changes the URL (e.g. /employees) and swaps pages WITHOUT a full
// browser reload. That is what makes it feel like a single-page app.
//
// PROVIDER ORDER MATTERS - each one may use the ones above it:
//
//   BrowserRouter   gives every provider access to the current route
//   AuthProvider    who is logged in (needed by the protected layout)
//   ToastProvider   app-wide notifications (pages call useToast)
//   ConfirmProvider app-wide confirmation dialogs (pages call useConfirm)
//   App             routes + pages
//
// Toast and Confirm live here rather than per-page so the whole app shares a
// single toast stack and one dialog instance.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
