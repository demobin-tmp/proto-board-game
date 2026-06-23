import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // e2e/ holds Playwright specs (run via `npm run test:e2e`), not Vitest tests.
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
})
