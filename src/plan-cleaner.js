// Converts any uploaded source — a photo of a paper plan, a scan, a PDF
// render, or a hand drawing — into a clean black-on-white floor plan
// outline suitable as the base layer of an evacuation map.
//
// Pipeline: downscale → grayscale → polarity check → adaptive threshold
// (integral-image mean, robust to shadows/uneven lighting) → despeckle.

export function cleanFloorPlan(source, opts = {}) {
  const maxDim = opts.maxDim || 2000;
  const radius = opts.windowRadius || 14;  // adaptive window half-size in px
  const offset = opts.offset || 12;        // how much darker than local mean counts as ink
  const inkAbsolute = opts.inkAbsolute || 60; // always ink below this (keeps thick solid walls)

  const srcW = source.naturalWidth || source.width;
  const srcH = source.naturalHeight || source.height;
  if (!srcW || !srcH) throw new Error('Source has no dimensions');

  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const wctx = work.getContext('2d', { willReadFrequently: true });
  wctx.fillStyle = '#ffffff';
  wctx.fillRect(0, 0, w, h);
  wctx.drawImage(source, 0, 0, w, h);

  const data = wctx.getImageData(0, 0, w, h).data;
  const n = w * h;

  // Grayscale
  const gray = new Float32Array(n);
  let sumAll = 0;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const g = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    gray[i] = g;
    sumAll += g;
  }

  // Dark-background sources (white-on-black blueprints, dark photos):
  // invert so ink is always the dark side
  if (sumAll / n < 110) {
    for (let i = 0; i < n; i++) gray[i] = 255 - gray[i];
  }

  // Integral image for fast local means
  const iw = w + 1;
  const integral = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x];
      integral[(y + 1) * iw + (x + 1)] = integral[y * iw + (x + 1)] + rowSum;
    }
  }

  // Adaptive threshold: ink = notably darker than its neighborhood,
  // or near-black outright
  const ink = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - radius);
    const y2 = Math.min(h - 1, y + radius);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - radius);
      const x2 = Math.min(w - 1, x + radius);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * iw + (x2 + 1)] -
        integral[y1 * iw + (x2 + 1)] -
        integral[(y2 + 1) * iw + x1] +
        integral[y1 * iw + x1];
      const g = gray[y * w + x];
      if (g < sum / area - offset || g < inkAbsolute) {
        ink[y * w + x] = 1;
      }
    }
  }

  // Despeckle: drop isolated ink pixels (sensor noise, paper grain)
  const cleaned = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!ink[i]) continue;
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          neighbors += ink[ny * w + nx];
        }
      }
      if (neighbors >= 2) cleaned[i] = 1;
    }
  }

  // Render: dark charcoal lines on white
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  const outData = octx.createImageData(w, h);
  const od = outData.data;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (cleaned[i]) {
      od[p] = 26; od[p + 1] = 26; od[p + 2] = 26; od[p + 3] = 255;
    } else {
      od[p] = 255; od[p + 1] = 255; od[p + 2] = 255; od[p + 3] = 255;
    }
  }
  octx.putImageData(outData, 0, 0);
  return out;
}
