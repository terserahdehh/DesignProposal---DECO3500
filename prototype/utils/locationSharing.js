// Watch movement AND request fresh fixes while stationary. Never renew a fix by
// inventing a timestamp: the band deliberately expires positions after 60 s.
function createLocationSharing(options) {
  const { geolocation, onPosition, onError, onNotice = () => {} } = options;
  const page = options.document;
  const every = options.setInterval || globalThis.setInterval;
  const cancel = options.clearInterval || globalThis.clearInterval;
  let active = false, continuous = false, generation = 0;
  let watchId = null, timer = null, request = null, queued = null;
  let sending = false, sendingKey = null, lastKey = null;
  const key = p => JSON.stringify([p.timestamp, p.coords.latitude, p.coords.longitude, p.coords.accuracy]);

  function stop() {
    active = false; generation++; queued = null; request = null;
    if (watchId !== null) geolocation.clearWatch(watchId);
    if (timer !== null) cancel(timer);
    watchId = null; timer = null;
    page?.removeEventListener('visibilitychange', resume);
  }
  function errorMessage(error) {
    if (error.code === 1) return 'Location permission denied. In Chrome site settings, set Location to Allow; also enable device location and allow Chrome in your OS privacy settings. Then retry.';
    if (error.code === 2) return 'This device cannot obtain a location. Enable device location and Chrome location access. Laptop locations can be coarse; try each wearer’s Android phone outdoors.';
    if (error.code === 3) return 'Getting location timed out. Enable device location, keep this page visible and retry. On a laptop, try an Android phone outdoors for a more accurate fix.';
    return error.message || 'Could not obtain this device’s location. Check Chrome and OS location permissions, then retry.';
  }
  function fail(error, token) {
    if (!active || token !== generation) return;
    const stopped = error.code === 1 || !continuous;
    if (stopped) stop();
    onError({ message: errorMessage(error), stopped });
  }
  async function deliver(position, token) {
    if (!active || token !== generation) return;
    const nextKey = key(position);
    if (nextKey === lastKey || nextKey === sendingKey) return;
    queued = { position, token, key: nextKey };
    if (sending) return;
    sending = true;
    try {
      while (queued) {
        const next = queued; queued = null;
        if (!active || next.token !== generation) continue;
        sendingKey = next.key;
        try { await onPosition(next.position); if (active && next.token === generation) lastKey = next.key; }
        catch (error) { if (active && next.token === generation) onError({ message: error.message || 'Location upload failed. Reconnect the band and retry.', stopped: !continuous }); }
        finally { sendingKey = null; }
      }
    } finally { sending = false; }
  }
  function acquire(highAccuracy = true) {
    if (!active || request) return;
    const token = generation, ticket = {};
    request = ticket;
    const current = () => active && token === generation && request === ticket;
    const success = position => { if (!current()) return; request = null; deliver(position, token); };
    const failure = error => {
      if (!current()) return;
      request = null;
      if (error.code !== 1 && highAccuracy) {
        onNotice('Precise location is unavailable. Trying the device’s standard location provider; its reported accuracy will be preserved.');
        acquire(false);
      } else fail(error, token);
    };
    try { geolocation.getCurrentPosition(success, failure, { enableHighAccuracy: highAccuracy, maximumAge: 0, timeout: highAccuracy ? 20000 : 30000 }); }
    catch (error) { request = null; fail(error, token); }
  }
  function resume() { if (page?.visibilityState === 'visible') acquire(); }
  return {
    start(keepUpdated = false) {
      stop(); active = true; continuous = keepUpdated; lastKey = null;
      const token = generation;
      acquire();
      if (continuous && active) {
        try {
          const id = geolocation.watchPosition(p => deliver(p, token), error => {
            if (error.code === 1) fail(error, token);
            else if (active && token === generation) acquire();
          }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
          if (active && token === generation) watchId = id;
          else geolocation.clearWatch(id);
          if (active) { timer = every(acquire, 20000); page?.addEventListener('visibilitychange', resume); }
        } catch (error) { fail(error, token); }
      }
    },
    retry: acquire,
    stop,
  };
}
module.exports = { createLocationSharing };
