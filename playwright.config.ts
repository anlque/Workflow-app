import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] === undefined ? 0 : 2,
  reporter:
    process.env['CI'] === undefined ? 'list' : [['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: { trace: 'retain-on-failure' },
});
