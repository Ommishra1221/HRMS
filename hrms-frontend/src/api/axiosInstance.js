import axios from 'axios'

// axiosInstance = the ONE door through which every request leaves the app.
//
// Why centralize?
// - The gateway URL is defined exactly once (from the .env file).
// - Every component gets identical error handling for free.
// - If we later add auth headers or logging, we change ONE file.
//
// Data flow:  component -> xxxApi.js -> axiosInstance -> API Gateway -> microservice
const axiosInstance = axios.create({
  // Vite exposes variables starting with VITE_ to frontend code.
  // Value: http://localhost:8080 (the gateway - never 8081/8082 directly!)
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
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
      // Use the backend's real message (e.g. "Employee not found with id: 99")
      status = error.response.status
      message = error.response.data?.message || `Request failed with status ${status}`
    }
    // else: no response = network error - keep the friendly default above.

    return Promise.reject({ status, message })
  },
)

export default axiosInstance
