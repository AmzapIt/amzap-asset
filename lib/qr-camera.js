// Read the centre at higher pixel density before checking the whole frame.
// The sticker QR is small, so shrinking a full phone camera frame first can
// erase the fine modules that jsQR needs to distinguish.
export function decodeCameraFrame(frame, canvas, context, jsQR, frameNumber) {
  const width = frame.videoWidth;
  const height = frame.videoHeight;
  if (!width || !height) return null;

  function decode(sourceX, sourceY, sourceWidth, sourceHeight, maxSide, inversionAttempts) {
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
    if (canvas.width !== targetWidth) canvas.width = targetWidth;
    if (canvas.height !== targetHeight) canvas.height = targetHeight;
    context.drawImage(frame, sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, targetWidth, targetHeight);
    const pixels = context.getImageData(0, 0, targetWidth, targetHeight);
    return jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts })?.data ?? null;
  }

  const side = Math.min(width, height) * 0.72;
  const sourceX = (width - side) / 2;
  const sourceY = (height - side) / 2;
  const invert = frameNumber % 4 === 0 ? 'attemptBoth' : 'dontInvert';
  const centred = decode(sourceX, sourceY, side, side, 800, invert);
  if (centred) return centred;
  // Periodically inspect the edges too, without doubling work on every frame.
  return frameNumber % 2 === 0 ? decode(0, 0, width, height, 900, 'dontInvert') : null;
}

// Some implementations expose BarcodeDetector but stall on live video frames.
// Let the JavaScript decoder take over promptly in that case.
export async function detectNativeQr(detector, frame, timeoutMs = 600) {
  let timeout;
  try {
    const detected = await Promise.race([
      detector.detect(frame),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Native QR detection timed out')), timeoutMs);
      }),
    ]);
    return detected.find((item) => item.rawValue)?.rawValue ?? null;
  } finally {
    clearTimeout(timeout);
  }
}
