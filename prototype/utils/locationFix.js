const LOCATION_TTL_MS = 60000;

function validateLocationFix(location, now = Date.now()) {
  if (!location || !Number.isFinite(location.lat) || Math.abs(location.lat) > 90 ||
      !Number.isFinite(location.lon) || Math.abs(location.lon) > 180 ||
      !Number.isFinite(location.accuracy) || location.accuracy < 0 ||
      !Number.isSafeInteger(location.timestamp) || location.timestamp <= 0 ||
      location.simulated !== false) throw new Error('A valid phone location is required; obtain a fresh phone location.');
  if (now - location.timestamp >= LOCATION_TTL_MS || location.timestamp - now > 5000)
    throw new Error('Obtain a fresh phone location; this fix is expired or its clock is ahead.');
  return location;
}

module.exports = { LOCATION_TTL_MS, validateLocationFix };
