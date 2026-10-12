const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/ui', timeout: 30000, fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:8091', channel: 'chrome', headless: true },
  webServer: { command: 'node tests/ui/serve.cjs', url: 'http://127.0.0.1:8091/phone', reuseExistingServer: false },
});
