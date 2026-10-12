// Presets are stored per wearer; only printable ASCII fits the firmware font.
const OWNERS = ['nayaka', 'syifa'];
const MAX_MESSAGES = 8;
const MAX_TEXT_LENGTH = 40;
const DEFAULT_MESSAGES = [
  { id: 'safe', text: "I'm Safe" },
  { id: 'toilet', text: 'Going to the toilet' },
  { id: 'break', text: 'Taking a break' },
  { id: 'home', text: 'Going home' },
  { id: 'meet', text: 'Meet at our meeting point' },
];
const DEFAULT_BRIDGE_URL = 'http://localhost:8787';
const BRIDGE_KEY = 'pulseband.usbBridgeUrl.v1';
const validOwner = owner => OWNERS.includes(owner);
const defaults = () => DEFAULT_MESSAGES.map(message => ({ ...message }));

function messageError(text) {
  if (typeof text !== 'string' || !text.trim()) return 'Enter a message first.';
  if (text.trim().length > MAX_TEXT_LENGTH) return `Use ${MAX_TEXT_LENGTH} characters or fewer.`;
  if (!/^[\x20-\x7e]+$/.test(text)) return 'Use plain English letters, numbers and punctuation (no emoji or line breaks).';
  return null;
}

function validatePresets(messages) {
  if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) return { ok: false, error: `A band can store up to ${MAX_MESSAGES} messages.` };
  const ids = new Set();
  const cleaned = [];
  for (const message of messages) {
    if (!message || typeof message.id !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(message.id) || ids.has(message.id)) return { ok: false, error: 'Every message needs a unique, valid ID.' };
    const error = messageError(message.text);
    if (error) return { ok: false, error };
    ids.add(message.id);
    cleaned.push({ id: message.id, text: message.text.trim() });
  }
  return { ok: true, messages: cleaned };
}

function validatedBandPresets(owner, response) {
  if (!validOwner(owner)) throw new Error('Choose Nayaka or Syifa.');
  if (response?.ok !== true) throw new Error('The band did not acknowledge reading its stored messages.');
  const reportedOwner = response.owner ?? response.band?.owner;
  if (reportedOwner !== owner || [response.owner, response.band?.owner].some(value => value !== undefined && value !== owner)) throw new Error('The message list did not come from the selected wearer\'s band. Reconnect and try again.');
  const messages = Object.prototype.hasOwnProperty.call(response, 'messages') ? response.messages : response.band?.messages;
  const checked = validatePresets(messages);
  if (!checked.ok || messages.some(message => message.text.length > MAX_TEXT_LENGTH)) throw new Error(`The band returned an invalid preset list. ${checked.error || 'Messages must fit the 40-character screen limit.'}`);
  // Keep the stored text intact; loading is a read, so it never rewrites the band.
  return { owner, messages: messages.map(({ id, text }) => ({ id, text })) };
}

function storageTarget(storage) { return storage === undefined ? globalThis.localStorage : storage; }
function readPresets(owner, storage) {
  if (!validOwner(owner)) throw new Error('Choose Nayaka or Syifa.');
  try {
    const raw = storageTarget(storage)?.getItem(`pulseband.presets.v1.${owner}`);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    const checked = validatePresets(parsed);
    return checked.ok && parsed.every(message => message.text.length <= MAX_TEXT_LENGTH) ? parsed.map(({ id, text }) => ({ id, text })) : defaults();
  } catch (_) { return defaults(); }
}

function savePresets(owner, messages, storage, { preserveStoredText = false } = {}) {
  if (!validOwner(owner)) return { ok: false, error: 'Choose Nayaka or Syifa.' };
  const checked = validatePresets(messages);
  if (!checked.ok) return checked;
  if (preserveStoredText && messages.some(message => message.text.length > MAX_TEXT_LENGTH)) return { ok: false, error: 'Stored messages must fit the 40-character screen limit.' };
  const savedMessages = preserveStoredText ? messages.map(({ id, text }) => ({ id, text })) : checked.messages;
  try {
    const target = storageTarget(storage);
    if (!target) throw new Error('Storage unavailable');
    target.setItem(`pulseband.presets.v1.${owner}`, JSON.stringify(savedMessages));
    return { ok: true, messages: savedMessages };
  } catch (_) { return { ok: false, error: 'Browser storage is unavailable. Messages are kept for this visit only.' }; }
}

function newMessageId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, '');
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeBridgeUrl(input) {
  try {
    const url = new URL(typeof input === 'string' ? input.trim() : '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    return url.toString().replace(/\/+$/, '');
  } catch (_) { throw new Error('Enter the bridge address, such as http://localhost:8787 or http://192.168.1.5:8787.'); }
}

function readBridgeUrl(storage) {
  try { const saved = storageTarget(storage)?.getItem(BRIDGE_KEY); return saved ? normalizeBridgeUrl(saved) : DEFAULT_BRIDGE_URL; }
  catch (_) { return DEFAULT_BRIDGE_URL; }
}

function saveBridgeUrl(input, storage) {
  let url;
  try { url = normalizeBridgeUrl(input); } catch (error) { return { ok: false, error: error.message }; }
  try {
    const target = storageTarget(storage);
    if (!target) throw new Error();
    target.setItem(BRIDGE_KEY, url);
    return { ok: true, url };
  } catch (_) { return { ok: false, url, error: 'Bridge address is set for this visit; browser storage is unavailable.' }; }
}

module.exports = { OWNERS, MAX_MESSAGES, MAX_TEXT_LENGTH, DEFAULT_MESSAGES, DEFAULT_BRIDGE_URL, validOwner, messageError, validatePresets, validatedBandPresets, readPresets, savePresets, newMessageId, normalizeBridgeUrl, readBridgeUrl, saveBridgeUrl };
