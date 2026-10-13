// Laptop-speaker preview of the band's proximity beeps. The bands have no
// buzzer, so this plays the interval each band reports, and only after a click.
// Scheduling mirrors the firmware: a shorter interval applies from the last
// beep, and recovery after an unusable measurement beeps at once.
const TONE_HZ = 2700;
const TONE_SECONDS = 0.04;

function createBeepPreview(options = {}) {
  const AudioContextClass = 'AudioContext' in options ? options.AudioContext : globalThis.AudioContext || globalThis.webkitAudioContext;
  const now = options.now || (() => Date.now());
  const setTimer = options.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimeout || (timer => clearTimeout(timer));
  let context = null;
  let timer = null;
  let plan = { active: false, beepIntervalMs: 0 };
  let enabled = false;
  let lastBeepAt = null;
  let beeps = 0;

  const audible = () => enabled && plan.active && plan.beepIntervalMs > 0;
  const cancel = () => { if (timer !== null) { clearTimer(timer); timer = null; } };

  function tone() {
    const at = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = TONE_HZ;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + TONE_SECONDS);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + TONE_SECONDS + 0.01);
    beeps++;
  }

  function tick() {
    timer = null;
    if (!audible()) { lastBeepAt = null; return; }
    const time = now();
    if (lastBeepAt === null || time - lastBeepAt >= plan.beepIntervalMs) { tone(); lastBeepAt = time; }
    timer = setTimer(tick, Math.max(0, lastBeepAt + plan.beepIntervalMs - time));
  }

  return {
    async enable() {
      if (enabled) return { ok: true };
      if (typeof AudioContextClass !== 'function') return { ok: false, error: 'This browser cannot play audio for the beep preview.' };
      try {
        context = new AudioContextClass();
        await context.resume?.();
      } catch (error) {
        context = null;
        return { ok: false, error: `Laptop audio could not start: ${error.message}` };
      }
      enabled = true;
      lastBeepAt = null;
      cancel();
      tick();
      return { ok: true };
    },
    disable() {
      enabled = false;
      cancel();
      lastBeepAt = null;
      const closing = context;
      context = null;
      closing?.close?.()?.catch?.(() => {});
    },
    update(next) {
      plan = { active: next?.active === true, beepIntervalMs: Number.isFinite(next?.beepIntervalMs) ? next.beepIntervalMs : 0 };
      if (!enabled) return;
      cancel();
      if (!audible()) { lastBeepAt = null; return; }
      tick();
    },
    get state() { return { enabled, playing: audible(), intervalMs: audible() ? plan.beepIntervalMs : 0, beeps }; },
  };
}

module.exports = { createBeepPreview };
