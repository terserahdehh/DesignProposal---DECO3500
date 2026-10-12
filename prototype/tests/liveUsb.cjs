// Opt-in browser verification against real USB bands. No browser/API doubles.
// Run through hardware/verify_phone_usb.py, which restores presets/locations.
const { chromium, expect } = require('@playwright/test');
const [site, bridge] = process.argv.slice(2);
const requireValue = (value, message) => { if (!value) throw Error(message); };
async function command(owner, action, body = {}) {
  const response = await fetch(`${bridge}/api/bands/${owner}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  requireValue(response.ok && data.ok === true, data.error || 'Missing firmware acknowledgement');
  return data;
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.grantPermissions(['local-network-access'], { origin: new URL(site).origin });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${site}/phone`);
    await page.getByTestId('transport-usb').click();
    await page.getByTestId('bridge-url').fill(bridge);
    await page.getByRole('button', { name: 'Save bridge address', exact: true }).click();
    await expect(page.getByText('USB connected', { exact: true })).toHaveCount(2, { timeout: 15000 });
    console.log(`PASS: ${site} sees both actual USB bands in Chrome ${browser.version()}`);
    for (const owner of ['nayaka', 'syifa']) {
      await page.getByTestId(`owner-${owner}`).click();
      await expect(page.getByTestId('direction-detail')).toContainText('clockwise from north');
      await expect(page.getByTestId('direction-detail')).toContainText('SIMULATED LOCATION');
      await expect(page.getByTestId('direction-ring').locator('path').nth(1)).toHaveAttribute('stroke', owner === 'nayaka' ? '#FACC15' : '#A855F7');
    }
    console.log('PASS: both real band directions produce the correct yellow/purple browser ring');
    await page.getByTestId('owner-nayaka').click();
    await page.getByTestId('load-presets').click();
    await expect(page.getByTestId('load-presets')).not.toContainText('Reading');
    if (await page.getByTestId('confirm-load-presets').isVisible()) await page.getByTestId('confirm-load-presets').click();
    await page.getByTestId('preset-input').fill('Live browser meeting check');
    await page.getByTestId('save-preset').click();
    await page.getByTestId('sync-presets').click();
    await expect(page.getByTestId('preset-notice')).toContainText('acknowledged', { timeout: 15000 });
    requireValue((await command('nayaka', 'status')).messages.some(item => item.text === 'Live browser meeting check'), 'Fresh firmware readback did not match UI sync');
    await page.getByRole('button', { name: 'Edit Live browser meeting check', exact: true }).click();
    await page.getByTestId('preset-input').fill('Live browser edited check');
    await page.getByTestId('save-preset').click();
    await page.getByTestId('sync-presets').click();
    await expect(page.getByTestId('preset-notice')).toContainText('acknowledged', { timeout: 15000 });
    requireValue((await command('nayaka', 'status')).messages.some(item => item.text === 'Live browser edited check'), 'Edited preset missing from band');
    await page.getByRole('button', { name: 'Delete Live browser edited check', exact: true }).click();
    await page.getByTestId('sync-presets').click();
    await expect(page.getByTestId('preset-notice')).toContainText('acknowledged', { timeout: 15000 });
    requireValue(!(await command('nayaka', 'status')).messages.some(item => item.text === 'Live browser edited check'), 'Deleted preset still on band');
    console.log('PASS: real UI load/add/edit/delete/sync independently verified against firmware');
    for (let count = 0; count < 2; count++) {
      await command('syifa', 'send', { text: 'Live USB popup check' });
      await expect(page.getByTestId('incoming-band-popup')).toContainText('Live USB popup check', { timeout: 15000 });
      requireValue((await command('nayaka', 'status')).incoming === 'Live USB popup check', 'Physical popup differs from browser');
      await page.getByTestId('hide-incoming').click();
      await expect(page.getByTestId('incoming-band-popup')).toBeHidden();
      await expect.poll(async () => (await command('syifa', 'status')).result).toBe('Received by band');
    }
    await command('nayaka', 'control', { button: 'ok' });
    console.log('PASS: actual radio messages produce repeated browser/physical popups and band acknowledgements');
    await command('nayaka', 'clear-location'); await command('syifa', 'clear-location');
    await expect(page.getByTestId('direction-title')).toContainText('Waiting for fresh locations', { timeout: 15000 });
    await expect(page.getByTestId('direction-ring')).toBeHidden();
    requireValue(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile layout overflows');
    requireValue(errors.length === 0, `Uncaught browser errors: ${errors.join('; ')}`);
    console.log('PASS: cleared physical positions hide direction; mobile layout fits; no uncaught browser errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
