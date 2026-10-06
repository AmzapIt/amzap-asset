import assert from 'node:assert/strict';
import test from 'node:test';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { decodeCameraFrame, detectNativeQr } from '../lib/qr-camera.js';

const code = 'F1-MON-001';
const source = QRCode.create(code);

function frameWithQr({ x = 910, y = 480, pixels = 120, inverted = false } = {}) {
  const width = 1920, height = 1080;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const background = inverted ? 0 : 255;
  rgba.fill(background);
  for (let index = 3; index < rgba.length; index += 4) rgba[index] = 255;
  const modules = source.modules.size + 8; // four quiet modules on each side
  for (let py = y; py < y + pixels; py++) {
    for (let px = x; px < x + pixels; px++) {
      const moduleX = Math.floor((px - x) * modules / pixels) - 4;
      const moduleY = Math.floor((py - y) * modules / pixels) - 4;
      const dark = moduleX >= 0 && moduleX < source.modules.size &&
        moduleY >= 0 && moduleY < source.modules.size && Boolean(source.modules.get(moduleX, moduleY));
      const color = (dark !== inverted) ? 0 : 255;
      const offset = (py * width + px) * 4;
      rgba[offset] = rgba[offset + 1] = rgba[offset + 2] = color;
    }
  }
  return { videoWidth: width, videoHeight: height, rgba };
}

function fakeCanvas() {
  const canvas = { width: 0, height: 0 };
  let pixels;
  const context = {
    drawImage(frame, sx, sy, sw, sh, _dx, _dy, dw, dh) {
      pixels = new Uint8ClampedArray(dw * dh * 4);
      for (let y = 0; y < dh; y++) {
        const sourceY = Math.min(frame.videoHeight - 1, Math.floor(sy + y * sh / dh));
        for (let x = 0; x < dw; x++) {
          const sourceX = Math.min(frame.videoWidth - 1, Math.floor(sx + x * sw / dw));
          const from = (sourceY * frame.videoWidth + sourceX) * 4;
          const to = (y * dw + x) * 4;
          pixels.set(frame.rgba.subarray(from, from + 4), to);
        }
      }
    },
    getImageData(_x, _y, width, height) { return { data: pixels, width, height }; },
  };
  return { canvas, context };
}

test('reads a small sticker QR from the centre without first shrinking the whole camera frame', () => {
  const { canvas, context } = fakeCanvas();
  assert.equal(decodeCameraFrame(frameWithQr(), canvas, context, jsQR, 1), code);
  assert.equal(canvas.width, 778);
});

test('periodic full-frame scan also finds an off-centre QR', () => {
  const { canvas, context } = fakeCanvas();
  assert.equal(decodeCameraFrame(frameWithQr({ x: 90, y: 240, pixels: 170 }), canvas, context, jsQR, 2), code);
});

test('periodic inversion finds light modules on a dark label', () => {
  const { canvas, context } = fakeCanvas();
  assert.equal(decodeCameraFrame(frameWithQr({ inverted: true }), canvas, context, jsQR, 4), code);
});

test('waits for video dimensions before sampling', () => {
  const { canvas, context } = fakeCanvas();
  assert.equal(decodeCameraFrame({ videoWidth: 0, videoHeight: 0 }, canvas, context, jsQR, 1), null);
});

test('uses native detection when available and times out before falling back', async () => {
  assert.equal(await detectNativeQr({ detect: async () => [{ rawValue: code }] }, {}, 20), code);
  await assert.rejects(detectNativeQr({ detect: () => new Promise(() => {}) }, {}, 20), /timed out/);
});
