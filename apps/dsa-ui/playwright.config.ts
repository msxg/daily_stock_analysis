import { defineConfig, devices } from '@playwright/test'

const localNoProxy = '127.0.0.1,localhost'
const mergedNoProxy = [process.env.NO_PROXY, process.env.no_proxy, localNoProxy]
  .filter(Boolean)
  .join(',')

process.env.NO_PROXY = mergedNoProxy
process.env.no_proxy = mergedNoProxy
process.env.HTTP_PROXY = ''
process.env.HTTPS_PROXY = ''
process.env.http_proxy = ''
process.env.https_proxy = ''

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    cwd: '.',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
