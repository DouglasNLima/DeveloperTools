import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  webServer: {
    command: 'node ./tests/support/static-server.js',
    url: 'http://127.0.0.1:42891',
    reuseExistingServer: false,
    timeout: 10000
  },
  use: {
    baseURL: 'http://127.0.0.1:42891',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
