const { defineConfig } = require('@playwright/test');
// Explicit opt-in production smoke checks use protocol doubles, not real bands.
const remote = process.env.PULSEBAND_UI_BASE_URL;
module.exports = defineConfig({
  testDir: './tests/ui', timeout: 30000, fullyParallel: false,
  use: { baseURL: remote || 'http://127.0.0.1:8091', channel: 'chrome', headless: true },
  webServer: remote ? undefined : { command: 'node tests/ui/serve.cjs', url: 'http://127.0.0.1:8091/phone', reuseExistingServer: false },
});
