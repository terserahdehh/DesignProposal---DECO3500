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

async function installLocationProvider(page) {
  await page.addInitScript(() => {
    const requests = [];
    let watcher, cleared = 0;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition(ok, fail, options) { requests.push({ ok, fail, options }); },
      watchPosition(ok, fail) { watcher = { ok, fail }; return 8; },
      clearWatch() { cleared++; },
    } });
    window.__geo = { requests, get cleared() { return cleared; },
      success(index, accuracy = 10) { requests[index].ok({ coords: { latitude: -27.47, longitude: 153.03, accuracy }, timestamp: Date.now() }); },
      failure(index, code) { requests[index].fail({ code }); },
      movement() { watcher.ok({ coords: { latitude: -27.471, longitude: 153.03, accuracy: 10 }, timestamp: Date.now() }); },
    };
  });
}

test('stationary laptop sharing uploads fresh fixes past 60 seconds and stops all sources on disconnect', async ({ page }) => {
  await page.clock.install();
  await installLocationProvider(page); await connect(page);
  await page.getByTestId('watch-location').click();
  await page.evaluate(() => window.__geo.success(0));
  await expect(page.getByTestId('location-notice')).toContainText('acknowledged this device');
  for (let index = 1; index <= 3; index++) {
    await page.clock.fastForward(20000);
    expect(await page.evaluate(() => window.__geo.requests.at(-1).options.maximumAge)).toBe(0);
    await page.evaluate(index => window.__geo.success(index), index);
    await expect(page.getByTestId('location-freshness')).toContainText('0 s old');
  }
  expect(await page.evaluate(() => window.__band.commands.filter(c => c.cmd === 'location').length)).toBe(4);
  await page.evaluate(() => window.__band.disconnect());
  await page.clock.fastForward(40000);
  await page.evaluate(() => window.__geo.movement());
  expect(await page.evaluate(() => window.__geo.requests.length)).toBe(4);
  expect(await page.evaluate(() => window.__geo.cleared)).toBe(1);
  expect(await page.evaluate(() => window.__band.commands.filter(c => c.cmd === 'location').length)).toBe(4);
});

test('laptop standard-provider timeout and denied permission expose usable retries without claiming precise accuracy', async ({ page }) => {
  await installLocationProvider(page); await connect(page);
  await page.getByTestId('share-location').click();
  expect(await page.evaluate(() => window.__geo.requests[0].options.enableHighAccuracy)).toBe(false);
  await page.evaluate(() => window.__geo.failure(0, 3));
  await expect(page.getByTestId('location-notice')).toContainText('timed out');
  await page.getByTestId('share-location').click();
  expect(await page.evaluate(() => window.__geo.requests[1].options.enableHighAccuracy)).toBe(false);
  await page.evaluate(() => window.__geo.success(1, 1500));
  await expect(page.getByTestId('location-notice')).toContainText('accuracy ±1500 m');
  await expect(page.getByTestId('location-notice')).toContainText('coarse');
  await page.getByTestId('watch-location').click();
  await page.evaluate(() => window.__geo.failure(2, 1));
  await expect(page.getByTestId('location-notice')).toContainText('Chrome site settings');
  await expect(page.getByTestId('watch-location')).toBeEnabled();
  await page.getByTestId('watch-location').click();
  await page.evaluate(() => window.__geo.success(3));
  await expect(page.getByTestId('location-notice')).toContainText('acknowledged this device');
});

test('phone mode still requests high accuracy and falls back with the provider’s actual accuracy', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: { mobile: true } }));
  await installLocationProvider(page); await connect(page);
  await page.getByTestId('share-location').click();
  expect(await page.evaluate(() => window.__geo.requests[0].options.enableHighAccuracy)).toBe(true);
  await page.evaluate(() => window.__geo.failure(0, 3));
  await expect(page.getByTestId('location-notice')).toContainText('standard location provider');
  expect(await page.evaluate(() => window.__geo.requests[1].options.enableHighAccuracy)).toBe(false);
  await page.evaluate(() => window.__geo.success(1, 1500));
  await expect(page.getByTestId('location-notice')).toContainText('accuracy ±1500 m');
});

test('stopping sharing clears the band and late location callbacks cannot restart it', async ({ page }) => {
  await installLocationProvider(page); await connect(page);
  await page.getByTestId('watch-location').click();
  await page.getByTestId('stop-location').click();
  await expect(page.getByTestId('location-notice')).toContainText('acknowledged clearing');
  await page.evaluate(() => { window.__geo.success(0); window.__geo.movement(); });
  expect(await page.evaluate(() => window.__band.commands.filter(c => c.cmd === 'location').length)).toBe(0);
  expect(await page.evaluate(() => window.__band.band.location.valid)).toBe(false);
});

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
  const arc = page.getByTestId('direction-ring').locator('path').nth(1);
  await expect(arc).toHaveAttribute('stroke', '#FACC15');
  const firstPath = await arc.getAttribute('d');
  const firstBrightness = Number(await arc.getAttribute('opacity'));
  await page.evaluate(() => window.__band.notify({ ...window.__band.band, type: 'status', guidance: { ...window.__band.band.guidance, bearing: 0, metres: 25 } }));
  const arrow = page.getByTestId('direction-arrow');
  await expect(arrow).toHaveAttribute('d', 'M50 20 L70 80 L50 65 L30 80 Z');
  const arrowBox = await arrow.boundingBox();
  const ringBox = await page.getByTestId('direction-ring').boundingBox();
  expect(Math.abs(arrowBox.x + arrowBox.width / 2 - ringBox.x - ringBox.width / 2)).toBeLessThan(1);
  expect(Math.abs(arrowBox.y + arrowBox.height / 2 - ringBox.y - ringBox.height / 2)).toBeLessThan(1);
  expect(arrowBox.height).toBeGreaterThanOrEqual(119);
  await expect(arc).not.toHaveAttribute('d', firstPath);
  expect(Number(await arc.getAttribute('opacity'))).toBeGreaterThan(firstBrightness);
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
  await expect(page.getByTestId('direction-ring')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('continuous phone location stops when Bluetooth disconnects', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -27.47, longitude: 153.03, accuracy: 10 });
  await connect(page);
  await page.getByTestId('watch-location').click();
  await expect(page.getByTestId('location-notice')).toContainText('acknowledged this device');
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

test('cancelling a band import preserves an unfinished draft and local messages', async ({ page }) => {
  await connect(page);
  await page.getByTestId('preset-input').fill('Unfinished message');
  const before = await page.getByRole('button', { name: /^Edit / }).count();
  await page.getByTestId('load-presets').click();
  await page.getByTestId('cancel-load-presets').click();
  await expect(page.getByTestId('preset-input')).toHaveValue('Unfinished message');
  expect(await page.getByRole('button', { name: /^Edit / }).count()).toBe(before);
  expect(await page.evaluate(() => window.__band.commands.some(packet => packet.cmd === 'presets'))).toBe(false);
});

test('uncertain, offline and old telemetry remove browser direction claims', async ({ page }) => {
  await connect(page);
  await page.evaluate(() => window.__band.notify({ ...window.__band.band, type: 'status', guidance: { ...window.__band.band.guidance, usable: false, metres: 20, accuracy: 54 } }));
  await expect(page.getByTestId('direction-title')).toContainText('too uncertain');
  await expect(page.getByTestId('direction-detail')).toContainText('distance is unknown');
  await expect(page.getByTestId('direction-detail')).toContainText('±54 m');
  await expect(page.getByTestId('direction-detail')).not.toContainText('20 m');
  await expect(page.getByTestId('direction-ring')).toBeHidden();
  await page.evaluate(() => window.__band.notify({ ...window.__band.band, type: 'status', peerConnected: false }));
  await expect(page.getByTestId('direction-title')).toContainText('Waiting for fresh locations');
  await expect(page.getByTestId('direction-title')).toContainText('Connect your band', { timeout: 12000 });
});

test('unsupported Bluetooth leaves the message editor usable without hardware writes', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: null }));
  await page.route('http://localhost:8787/**', route => route.fulfill({ json: { bands: [] } }));
  await page.goto('/phone');
  await page.getByTestId('transport-bluetooth').click();
  await expect(page.getByTestId('connect-bluetooth')).toBeDisabled();
  await page.getByTestId('preset-input').fill('Meet near the entrance');
  await page.getByTestId('save-preset').click();
  await expect(page.getByTestId('preset-notice')).toContainText('Saved on this browser');
  await expect(page.getByTestId('sync-presets')).toBeDisabled();
});

test('the original prototype still loads and exposes the physical setup link', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Nayaka', exact: true }).click();
  await expect(page.getByText('Using PulseBand as Nayaka')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Prepare messages for your physical band ↗' })).toHaveAttribute('href', '/phone');
  await expect(page.getByText('LIVE BAND SIMULATION', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('large simulator direction arrow remains centered and inside the LCD on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Nayaka', exact: true }).click();
  for (let press = 0; press < 3; press++) await page.getByTestId('band-ok').click();
  const arrow = page.getByTestId('sim-direction-arrow');
  await expect(arrow).toBeVisible();
  const screen = await page.getByTestId('band-screen').boundingBox();
  const shape = await arrow.locator('path').boundingBox();
  expect(Math.abs(shape.x + shape.width / 2 - screen.x - screen.width / 2)).toBeLessThan(4);
  expect(shape.x).toBeGreaterThan(screen.x);
  expect(shape.y).toBeGreaterThan(screen.y);
  expect(shape.x + shape.width).toBeLessThan(screen.x + screen.width);
  expect(shape.y + shape.height).toBeLessThan(screen.y + screen.height);
  await expect(page.getByTestId('band-screen')).toContainText('SIM');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
