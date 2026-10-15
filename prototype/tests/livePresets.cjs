// Opt-in against actual USB watches through an ALREADY RUNNING bridge.
// No firmware uploads, tracking commands, synthetic coordinates or API doubles.
// Always restores exact original presets. Run: node tests/livePresets.cjs SITE BRIDGE
const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const [site, bridge = 'http://127.0.0.1:8787'] = process.argv.slice(2);
const original = {}, initial = {}, changed = new Set();
let browser;
async function command(owner, action, body = {}) {
  const response = await fetch(`${bridge}/api/bands/${owner}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const value = await response.json();
  assert.ok(response.ok && value.ok === true, value.error || 'No hardware acknowledgement'); return value;
}
(async () => {
  try {
    for (const owner of ['nayaka', 'syifa']) {
      initial[owner] = await command(owner, 'status');
      assert.equal(initial[owner].owner, owner); assert.ok(initial[owner].peerConnected);
      original[owner] = initial[owner].messages;
      assert.ok(Array.isArray(original[owner]) && original[owner].length < 8, 'Leave one free slot for the temporary test');
      assert.notEqual(initial[owner].capabilities?.imagePresets, true, 'This check specifically tests text-only firmware compatibility');
      assert.equal(initial[owner].unread, false, 'Dismiss existing real messages before testing');
    }
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.grantPermissions(['local-network-access'], { origin: new URL(site).origin });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${site}/phone`); await page.getByTestId('transport-usb').click();
    await page.getByTestId('bridge-url').fill(bridge);
    await page.getByRole('button', { name: 'Save bridge address', exact: true }).click();
    await expect(page.getByText('USB connected', { exact: true })).toHaveCount(2, { timeout: 15000 });
    for (const owner of ['nayaka', 'syifa']) {
      await page.getByTestId(`owner-${owner}`).click();
      await page.getByTestId('load-presets').click();
      await expect(page.getByTestId('load-presets')).not.toContainText('Reading');
      if (await page.getByTestId('confirm-load-presets').isVisible()) await page.getByTestId('confirm-load-presets').click();
      const name = `Image editor text check ${owner}`;
      await page.getByTestId('preset-input').fill(name); await page.getByTestId('save-preset').click();
      changed.add(owner); await page.getByTestId('sync-presets').click();
      await expect(page.getByTestId('preset-notice')).toContainText('acknowledged', { timeout: 15000 });
      assert.ok((await command(owner, 'status')).messages.some(m => m.text === name));
      await page.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
      await page.getByTestId('preset-input').fill('Edited text check'); await page.getByTestId('save-preset').click();
      await page.getByTestId('sync-presets').click();
      await expect(page.getByTestId('preset-notice')).toContainText('acknowledged', { timeout: 15000 });
      assert.ok((await command(owner, 'status')).messages.some(m => m.text === 'Edited text check'));
      await page.getByRole('button', { name: 'Delete Edited text check', exact: true }).click();
      await page.getByTestId('sync-presets').click();
      await expect(page.getByTestId('preset-notice')).toContainText('acknowledged', { timeout: 15000 });
      assert.deepEqual((await command(owner, 'status')).messages, original[owner]);
      const png = await page.evaluate(() => {
        const c = document.createElement('canvas'); c.width = c.height = 32;
        const ctx = c.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = 'black'; ctx.fillRect(0, 0, 16, 32); return c.toDataURL('image/png').split(',')[1];
      });
      await page.getByTestId('message-type-image').click();
      const chooser = page.waitForEvent('filechooser'); await page.getByTestId('choose-preset-image').click();
      await (await chooser).setFiles({ name: 'meeting.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
      await expect(page.getByTestId('draft-image-preview')).toBeVisible();
      await page.getByTestId('preset-input').fill('Browser-only image'); await page.getByTestId('save-preset').click();
      await expect(page.getByTestId('sync-presets')).toContainText('Sync text only');
      await page.getByTestId('sync-presets').click();
      await expect(page.getByTestId('preset-notice')).toContainText('were not transferred', { timeout: 15000 });
      assert.deepEqual((await command(owner, 'status')).messages, original[owner]);
      const local = await page.evaluate(owner => JSON.parse(localStorage.getItem(`pulseband.presets.v1.${owner}`)), owner);
      assert.equal(local.at(-1).image.data, 'ffff0000'.repeat(32));
      await page.getByRole('button', { name: 'Delete Browser-only image', exact: true }).click();
      console.log(`PASS ${owner}: actual USB load/add/edit/delete/sync readback; browser image retained but never sent to text-only firmware`);
    }
    // Test actual ESP-NOW popup in both directions without changing preset lists.
    for (const owner of ['nayaka', 'syifa']) {
      const peer = owner === 'nayaka' ? 'syifa' : 'nayaka';
      await page.getByTestId(`owner-${peer}`).click();
      await command(owner, 'send', { text: 'Real text popup check' });
      await expect(page.getByTestId('incoming-band-popup')).toContainText('Real text popup check', { timeout: 15000 });
      await expect.poll(async () => (await command(owner, 'status')).result).toBe('Received by band');
      await page.getByTestId('hide-incoming').click();
      await command(peer, 'control', { button: 'ok' });
      console.log(`PASS ${owner} → ${peer}: actual radio text, physical incoming status, browser popup and acknowledgement`);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    for (const owner of ['nayaka', 'syifa']) {
      const after = await command(owner, 'status');
      assert.deepEqual(after.messages, original[owner]);
      assert.deepEqual(after.sensors, initial[owner].sensors);
      assert.ok(after.uptimeMillis > initial[owner].uptimeMillis, 'Watch was reset unexpectedly');
    }
    console.log('PASS: both preset lists, hardware sensor configuration and uninterrupted firmware uptime preserved; no tracking commands sent');
  } finally {
    try {
      for (const owner of changed) {
        const current = await command(owner, 'status');
        if (JSON.stringify(current.messages) !== JSON.stringify(original[owner])) await command(owner, 'presets', { messages: original[owner] });
        assert.deepEqual((await command(owner, 'status')).messages, original[owner]);
      }
    } finally { if (browser) await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
