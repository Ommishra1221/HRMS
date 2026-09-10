import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite = the build tool + dev server.
// `npm run dev` starts it on http://localhost:5173
export default defineConfig({
  plugins: [react()],
})
