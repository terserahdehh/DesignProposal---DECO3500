const test = require('node:test');
const assert = require('node:assert/strict');
const { imageError, pixelsToImage, bitmapPath, fileToPresetImage, MAX_IMAGE_FILE_BYTES } = require('../utils/presetImage');
const { validatePresets, savePresets, readPresets, validatedBandPresets } = require('../utils/presets');

const icon = { width: 32, height: 32, data: '80' + '00'.repeat(127) };

test('unsupported formats and oversized original files are rejected before decoding', async () => {
  await assert.rejects(fileToPresetImage({ type: 'image/svg+xml', size: 100 }), /PNG, JPEG or WebP/);
  await assert.rejects(fileToPresetImage({ type: 'image/png', size: MAX_IMAGE_FILE_BYTES + 1 }), /5 MB/);
});

test('image protocol is exactly 32x32 monochrome, never arbitrary markup or a URL', () => {
  assert.equal(imageError(icon), null);
  for (const bad of [null, {}, { ...icon, width: 64 }, { ...icon, height: true },
    { ...icon, data: 'ff' }, { ...icon, data: 'z'.repeat(256) }, { ...icon, data: 'https://example.com' }])
    assert.ok(imageError(bad));
  assert.equal(MAX_IMAGE_FILE_BYTES, 5 * 1024 * 1024);
});

test('RGBA pixels become row-major most-significant-first bits with transparency on white', () => {
  const pixels = new Uint8ClampedArray(32 * 32 * 4).fill(255);
  pixels.set([0, 0, 0, 255], 0);
  pixels.set([0, 0, 0, 0], 4);
  pixels.set([0, 0, 0, 255], 32 * 4);
  const result = pixelsToImage(pixels);
  assert.equal(result.data.slice(0, 8), '80000000');
  assert.equal(result.data.slice(8, 16), '80000000');
  assert.equal(imageError(result), null);
  assert.throws(() => pixelsToImage(new Uint8Array(4)), /32/);
  assert.match(bitmapPath(icon), /M0 0h1v1h-1z/);
  assert.equal(bitmapPath({}), '');
});

test('mixed text and image presets survive save, reload, import, caption edit and deletion', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const messages = [{ id: 'text', text: 'Meet at gate' }, { id: 'photo', text: 'Our meeting point', image: icon }];
  assert.deepEqual(validatePresets(messages), { ok: true, messages });
  assert.equal(savePresets('nayaka', messages, storage).ok, true);
  assert.deepEqual(readPresets('nayaka', storage), messages);
  assert.deepEqual(validatedBandPresets('nayaka', { ok: true, owner: 'nayaka', messages }).messages, messages);
  const changed = messages.map(m => m.id === 'photo' ? { ...m, text: 'New caption' } : m);
  assert.equal(savePresets('nayaka', changed, storage).ok, true);
  assert.equal(readPresets('nayaka', storage)[1].image.data, icon.data);
  assert.equal(savePresets('nayaka', changed.filter(m => m.id !== 'photo'), storage).ok, true);
  assert.deepEqual(readPresets('nayaka', storage), [messages[0]]);
});

test('invalid image payloads cannot be silently saved or accepted from firmware', () => {
  const messages = [{ id: 'bad', text: 'A caption', image: { ...icon, data: 'ff' } }];
  assert.equal(validatePresets(messages).ok, false);
  assert.throws(() => validatedBandPresets('nayaka', { ok: true, owner: 'nayaka', messages }), /invalid/);
});
