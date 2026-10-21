import { defineConfig } from '@playwright/test'
import { execSync } from 'node:child_process'

// Keys of the *local* Supabase stack (npx supabase start), read at run time, never committed.
const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }).match(/\{[\s\S]*\}/)[0])
process.env.SUPABASE_URL = status.API_URL
process.env.SUPABASE_ANON_KEY = status.ANON_KEY
process.env.SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY
process.env.MAILPIT_URL = status.MAILPIT_URL

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 }, // 5 s default was flaky with 2 workers on the 3000-food base
  retries: 0,
  workers: 2,
  use: {
    baseURL: 'http://localhost:5174',
    viewport: { width: 390, height: 844 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
  webServer: { command: 'npx vite --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: true },
})
