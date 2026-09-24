const CONNECTION_HELP = 'Two laptops or phones running this website cannot pair with each other over Bluetooth. Selecting an identity only names this browser; it does not turn it into a Bluetooth peripheral. Use a physical BLE device running compatible PulseBand firmware.';
function connectPhysicalBand(service, choice) {
  if (choice !== 'physical') return false;
  service.connect();
  return true;
}
module.exports = { CONNECTION_HELP, connectPhysicalBand };
