// Fixed-size icons fit one acknowledged ESP-NOW packet; originals stay local.
const IMAGE_SIZE = 32;
const MAX_IMAGE_FILE_BYTES = 5 * 1024 * 1024;
function imageError(image) {
  return image && image.width === IMAGE_SIZE && image.height === IMAGE_SIZE &&
    typeof image.data === 'string' && /^[0-9a-f]{256}$/i.test(image.data)
    ? null : 'Use a valid 32×32 black-and-white watch image.';
}
function copyImage(image) { return { width: IMAGE_SIZE, height: IMAGE_SIZE, data: image.data.toLowerCase() }; }
function pixelsToImage(pixels) {
  if (pixels?.length !== IMAGE_SIZE * IMAGE_SIZE * 4) throw new Error('Expected 32×32 RGBA pixels.');
  const bytes = new Uint8Array(128);
  for (let i = 0; i < 1024; i++) {
    const alpha = pixels[i * 4 + 3] / 255;
    const luminance = (0.2126 * pixels[i * 4] + 0.7152 * pixels[i * 4 + 1] + 0.0722 * pixels[i * 4 + 2]) * alpha + 255 * (1 - alpha);
    if (luminance < 160) bytes[i >> 3] |= 0x80 >> (i & 7);
  }
  return { width: IMAGE_SIZE, height: IMAGE_SIZE, data: Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') };
}
function bitmapPath(image) {
  if (imageError(image)) return '';
  const bytes = image.data.match(/../g).map(b => parseInt(b, 16));
  let path = '';
  for (let y = 0; y < IMAGE_SIZE; y++) for (let x = 0; x < IMAGE_SIZE; x++) {
    const bit = y * IMAGE_SIZE + x;
    if (bytes[bit >> 3] & (0x80 >> (bit & 7))) path += `M${x} ${y}h1v1h-1z`;
  }
  return path;
}
async function fileToPresetImage(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP image.');
  if (file.size > MAX_IMAGE_FILE_BYTES) throw new Error('Choose an image smaller than 5 MB.');
  const url = URL.createObjectURL(file);
  try {
    const picture = new globalThis.Image();
    await new Promise((resolve, reject) => { picture.onload = resolve; picture.onerror = () => reject(new Error('This image could not be decoded. Choose another PNG, JPEG or WebP.')); picture.src = url; });
    if (!picture.naturalWidth || !picture.naturalHeight || picture.naturalWidth * picture.naturalHeight > 16000000) throw new Error('Choose an image no larger than 16 megapixels.');
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = IMAGE_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('This browser cannot prepare watch images.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
    const scale = Math.min(IMAGE_SIZE / picture.naturalWidth, IMAGE_SIZE / picture.naturalHeight);
    const width = picture.naturalWidth * scale, height = picture.naturalHeight * scale;
    context.drawImage(picture, (IMAGE_SIZE - width) / 2, (IMAGE_SIZE - height) / 2, width, height);
    return pixelsToImage(context.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE).data);
  } finally { URL.revokeObjectURL(url); }
}
function choosePresetImage() {
  if (!globalThis.document) return Promise.reject(new Error('Choose an image from the web app in Chrome.'));
  return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp'; input.style.display = 'none';
    const cleanup = () => input.remove();
    input.oncancel = () => { cleanup(); resolve(null); };
    input.onchange = async () => {
      const file = input.files?.[0]; cleanup();
      if (!file) { resolve(null); return; }
      try { resolve(await fileToPresetImage(file)); } catch (error) { reject(error); }
    };
    document.body.appendChild(input); input.click();
  });
}
function requireImageSupport(messages, band) {
  if (messages.some(m => m.image) && band?.capabilities?.imagePresets !== true)
    throw new Error('Image messages need updated watch firmware. Flash the image-message firmware on both watches; text messages still work.');
}
module.exports = { IMAGE_SIZE, MAX_IMAGE_FILE_BYTES, imageError, copyImage, pixelsToImage, bitmapPath, fileToPresetImage, choosePresetImage, requireImageSupport };
