const { test, expect } = require('@playwright/test');

// Browser UI contract doubles. These tests do not claim live ESP32 validation.
async function installBand(page) {
  await page.addInitScript(() => {
    const handlers = new Map();
    const deviceHandlers = new Map();
    let input = '';
    const owner = 'nayaka';
    const commands = [];
    const band = { owner, peer: 'syifa', peerConnected: true, messages: [{ id: 'gate', text: 'Meet at Gate 2' }], unread: false,
      location: { valid: true, timestamp: Date.now(), simulated: false }, peerLocation: { valid: true, timestamp: Date.now(), simulated: false },
      guidance: { available: true, usable: true, northReferenced: true, metres: 100, bearing: 90, accuracy: 20, bearingUncertaintyDegrees: 11.5 } };
    const notify = message => {
      const bytes = new TextEncoder().encode(`${JSON.stringify(message)}\n`);
      for (let i = 0; i < bytes.length; i += 20) {
        const chunk = bytes.slice(i, i + 20);
        handlers.get('characteristicvaluechanged')?.({ target: { value: new DataView(chunk.buffer) } });
      }
    };
    const characteristic = {
      properties: { write: true, notify: true },
      addEventListener: (event, fn) => handlers.set(event, fn), removeEventListener: event => handlers.delete(event),
      startNotifications: async () => characteristic,
      async writeValueWithResponse(bytes) {
        input += new TextDecoder().decode(bytes);
        let newline;
        while ((newline = input.indexOf('\n')) >= 0) {
          const packet = JSON.parse(input.slice(0, newline)); input = input.slice(newline + 1); commands.push(packet);
          if (packet.cmd === 'presets') band.messages = packet.messages;
          if (packet.cmd === 'location') band.location = { lat: packet.lat, lon: packet.lon, timestamp: packet.timestamp, accuracy: packet.accuracy, valid: true, simulated: false };
          if (packet.cmd === 'clear_location') { band.location = { valid: false }; delete band.guidance; }
          notify({ ...band, type: 'response', id: packet.id, ok: true });
        }
      },
    };
    const device = { name: 'PulseBand-Nayaka', id: 'test-band',
      addEventListener: (event, fn) => deviceHandlers.set(event, fn), removeEventListener: event => deviceHandlers.delete(event),
      gatt: { connected: false, async connect() { this.connected = true; return { getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }) }; },
        disconnect() { this.connected = false; deviceHandlers.get('gattserverdisconnected')?.(); } } };
    Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: { requestDevice: async () => device } });
    window.__band = { commands, band, notify, disconnect: () => device.gatt.disconnect() };
  });
}

async function connect(page) {
  await installBand(page);
  await page.route('http://localhost:8787/**', route => route.fulfill({ json: { bands: [] } }));
  await page.goto('/phone');
  await page.getByTestId('transport-bluetooth').click();
  await page.getByTestId('connect-bluetooth').click();
  await expect(page.getByText('Firmware identity verified.', { exact: false })).toBeVisible();
}

test('production phone route edits, loads and synchronizes actual protocol messages', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await connect(page);
  await page.getByTestId('load-presets').click();
  await page.getByTestId('confirm-load-presets').click();
  await page.getByTestId('preset-input').fill('Meet beside the main stage');
  await page.getByTestId('save-preset').click();
  expect(await page.evaluate(() => window.__band.band.messages.length)).toBe(1);
  await page.getByTestId('sync-presets').click();
  await expect(page.getByTestId('preset-notice')).toContainText('acknowledged 2 preset messages');
  expect(await page.evaluate(() => window.__band.band.messages[1].text)).toBe('Meet beside the main stage');
  await page.getByRole('button', { name: 'Edit Meet beside the main stage', exact: true }).click();
  await page.getByTestId('preset-input').fill('Meet at Gate 3');
  await page.getByTestId('save-preset').click();
  await page.getByRole('button', { name: 'Delete Meet at Gate 3', exact: true }).click();
  await page.getByTestId('sync-presets').click();
  await expect(page.getByTestId('preset-notice')).toContainText('acknowledged 1 preset messages');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit Meet at Gate 2', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('custom popups, repeated messages, dismissal and direction expiry work on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await connect(page);
  await expect(page.getByTestId('direction-detail')).toContainText('100 m · 90° clockwise from north');
  const incoming = sequence => page.evaluate(sequence => window.__band.notify({ type: 'message', owner: 'nayaka', from: 'syifa', text: 'Meet beside the stage', sequence }), sequence);
  await incoming(42);
  await expect(page.getByTestId('incoming-band-popup')).toBeVisible();
  await expect(page.getByTestId('incoming-band-popup')).toContainText('Meet beside the stage');
  await page.getByTestId('hide-incoming').click();
  await expect(page.getByTestId('incoming-band-popup')).toBeHidden();
  await incoming(43);
  await expect(page.getByTestId('incoming-band-popup')).toBeVisible();
  await page.evaluate(() => window.__band.notify({ type: 'dismissed', owner: 'nayaka', unread: false, incoming: '', view: 'home' }));
  await expect(page.getByTestId('incoming-band-popup')).toBeHidden();
  await page.evaluate(() => window.__band.notify({ type: 'status', owner: 'nayaka', location: { valid: false }, peerLocation: { valid: true } }));
  await expect(page.getByTestId('direction-title')).toContainText('Waiting for fresh locations');
  await expect(page.getByTestId('direction-detail')).not.toContainText('90°');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('continuous phone location stops when Bluetooth disconnects', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -27.47, longitude: 153.03, accuracy: 10 });
  await connect(page);
  await page.getByTestId('watch-location').click();
  await expect(page.getByTestId('location-notice')).toContainText('acknowledged this phone');
  await page.evaluate(() => window.__band.disconnect());
  await expect(page.getByText('Automatic location updates are active', { exact: false })).toBeHidden();
  await expect(page.getByTestId('direction-title')).toContainText('Connect your band');
});

test('USB status exposes both wearers and their live incoming popup', async ({ page }) => {
  await page.route('http://localhost:8787/**', route => route.fulfill({ json: { bands: [
    { owner: 'nayaka', connected: true, peerConnected: true, unread: true, incoming: 'USB custom message', incomingSequence: 5 },
    { owner: 'syifa', connected: true, peerConnected: true },
  ] } }));
  await page.goto('/phone/');
  await expect(page.getByTestId('incoming-band-popup')).toContainText('USB custom message');
  await page.getByTestId('hide-incoming').click();
  await expect(page.getByText('USB connected', { exact: true })).toHaveCount(2);
  await page.getByTestId('owner-syifa').click();
  await expect(page.getByTestId('incoming-band-popup')).toBeHidden();
  await expect(page.getByTestId('live-band-status')).toContainText("Syifa's band");
});
