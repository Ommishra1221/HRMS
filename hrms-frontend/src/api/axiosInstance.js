import axios from 'axios'

// axiosInstance = the ONE door through which every request leaves the app.
//
// Why centralize?
// - The gateway URL is defined exactly once (from the .env file).
// - Every component gets identical error handling for free.
// - Auth: the JWT is attached HERE, in one place - no page ever handles it.
//
// Data flow:  component -> xxxApi.js -> axiosInstance -> API Gateway -> microservice
const axiosInstance = axios.create({
  // Vite exposes variables starting with VITE_ to frontend code.
  // Value: http://localhost:8080 (the gateway - never 8081/8082 directly!)
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ---- Attach the JWT to every outgoing request ----
// AuthContext stores the token in localStorage under 'hrms_token' at login.
// This interceptor copies it into the Authorization header automatically:
//     Authorization: Bearer eyJhbGciOi...
// auth-service's JwtAuthenticationFilter reads exactly that header.
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('hrms_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ---- One error translator for the whole app ----
// The backend always answers errors as { status, error, message }.
// But network failures (gateway down) produce NO response at all, and
// axios wraps everything in its own error object. We normalize all cases
// into one simple shape: { status, message }.
axiosInstance.interceptors.response.use(
  (response) => response, // success: pass through untouched
  (error) => {
    let status = null
    let message = 'Unable to connect to server. Is the API Gateway running?'

    if (error.response) {
      // The gateway/backend DID answer, with an error status.
      // Use the backend's real message (e.g. "Invalid username or password")
      status = error.response.status
      message = error.response.data?.message || `Request failed with status ${status}`

      // ---- Global "session expired" handling ----
      // A 401 from a PROTECTED endpoint means our token is bad/expired.
      // Careful: POST /api/auth/login ALSO answers 401 on wrong credentials -
      // that one must stay on the form so the user sees the message instead of
      // being redirected to the page they are already looking at.
      // (401 is the only status that triggers this. A 403 - right token, wrong
      //  role - deliberately does NOT log you out: your session is fine.)
      const url = error.config?.url || ''
      const isAuthAttempt = url.includes('/api/auth/login')
      if (status === 401 && !isAuthAttempt) {
        localStorage.removeItem('hrms_token')
        // Full page load (not navigate()) so ALL state resets cleanly.
        if (window.location.pathname !== '/login') {
          window.location.assign('/login')
        }
      }
    }
    // else: no response = network error - keep the friendly default above.

    return Promise.reject({ status, message })
  },
)

export default axiosInstance
