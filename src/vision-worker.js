// Vision worker: runs the entire floor-plan analysis off the main thread
// so the UI never freezes. Loads OpenCV (WebAssembly) inside the worker
// and reports progress at each pipeline stage.
'use strict';

const OPENCV_CDN = 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js';

let cvReadyPromise = null;

function ensureCV() {
  if (cvReadyPromise) return cvReadyPromise;
  cvReadyPromise = new Promise((resolve, reject) => {
    try {
      importScripts(OPENCV_CDN);
    } catch (e) {
      cvReadyPromise = null;
      reject(new Error('Could not download the vision engine'));
      return;
    }
    const cv = self.cv;
    if (!cv) {
      cvReadyPromise = null;
      reject(new Error('Vision engine failed to initialize'));
    } else if (typeof cv.then === 'function') {
      cv.then((mod) => { self.cv = mod; resolve(mod); });
    } else if (cv.Mat) {
      resolve(cv);
    } else {
      cv.onRuntimeInitialized = () => resolve(self.cv);
    }
  });
  return cvReadyPromise;
}

self.onmessage = async (e) => {
  const { id, type, payload } = e.data;
  const progress = (pct, label) => self.postMessage({ id, type: 'progress', pct, label });

  try {
    if (type === 'warmup') {
      await ensureCV();
      self.postMessage({ id, type: 'done', result: { ready: true } });
    } else if (type === 'vectorize') {
      progress(5, 'Loading vision engine…');
      const cv = await ensureCV();
      progress(25, 'Reading image…');
      const result = vectorize(cv, payload, progress);
      self.postMessage({ id, type: 'done', result });
    } else if (type === 'trace') {
      progress(20, 'Tracing plan…');
      const result = traceInk(payload);
      progress(95, 'Finishing…');
      self.postMessage({ id, type: 'done', result }, [result.mask.buffer]);
    } else {
      throw new Error(`Unknown request: ${type}`);
    }
  } catch (err) {
    self.postMessage({ id, type: 'error', error: String((err && err.message) || err) });
  }
};

// ---------------- OpenCV reconstruction pipeline ----------------

function vectorize(cv, payload, progress) {
  const { width: w, height: h, buffer, opts } = payload;
  const imageData = new ImageData(new Uint8ClampedArray(buffer), w, h);

  const mats = [];
  const track = (m) => { mats.push(m); return m; };

  try {
    const src = track(cv.matFromImageData(imageData));
    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    if (cv.mean(gray)[0] < 110) cv.bitwise_not(gray, gray);
    cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0);

    progress(35, 'Separating ink from background…');
    const bin = track(new cv.Mat());
    cv.adaptiveThreshold(gray, bin, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 41, 15);
    const dark = track(new cv.Mat());
    cv.threshold(gray, dark, 70, 255, cv.THRESH_BINARY_INV);
    cv.bitwise_or(bin, dark, bin);

    progress(50, 'Measuring wall thickness…');
    const dist = track(new cv.Mat());
    cv.distanceTransform(bin, dist, cv.DIST_L2, 3);
    const dvals = dist.data32F;
    const samples = [];
    for (let i = 0; i < dvals.length; i += 7) {
      if (dvals[i] > 0.8) samples.push(dvals[i]);
    }
    samples.sort((a, b) => a - b);
    const p92 = samples.length ? samples[Math.floor(samples.length * 0.92)] : 2.5;
    const wallT = Math.max(4, Math.min(40, Math.round(p92 * 2)));

    progress(60, 'Isolating walls…');
    const kOpen = Math.max(2, Math.round(wallT * 0.5));
    const kernelO = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kOpen, kOpen)));
    const walls = track(new cv.Mat());
    cv.morphologyEx(bin, walls, cv.MORPH_OPEN, kernelO);

    const bridgeFactor = ((opts.bridgeGap ?? 5) / 5);
    const kClose = Math.max(1, Math.round(wallT * 0.5 * bridgeFactor + 1));
    const kernelC = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kClose, kClose)));
    cv.morphologyEx(walls, walls, cv.MORPH_CLOSE, kernelC);

    progress(70, 'Removing clutter…');
    const labels = track(new cv.Mat());
    const stats = track(new cv.Mat());
    const centroids = track(new cv.Mat());
    const nLabels = cv.connectedComponentsWithStats(walls, labels, stats, centroids, 8);
    const detail = (opts.minWallLen ?? 20) / 20;
    const minArea = Math.round(wallT * wallT * 2.5 * detail);
    const keep = new Uint8Array(nLabels);
    for (let i = 1; i < nLabels; i++) {
      if (stats.data32S[i * 5 + cv.CC_STAT_AREA] >= minArea) keep[i] = 1;
    }
    const labData = labels.data32S;
    const wallData = walls.data;
    for (let i = 0; i < w * h; i++) {
      wallData[i] = keep[labData[i]] ? 255 : 0;
    }

    progress(80, 'Finding doors and windows…');
    const thin = track(new cv.Mat());
    const wallsInv = track(new cv.Mat());
    cv.bitwise_not(walls, wallsInv);
    cv.bitwise_and(bin, wallsInv, thin);
    const thinData = thin.data;

    const kBig = Math.max(3, Math.round(wallT * 4));
    const kernelBig = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kBig, kBig)));
    const closedBig = track(new cv.Mat());
    cv.morphologyEx(walls, closedBig, cv.MORPH_CLOSE, kernelBig);
    const openings = track(new cv.Mat());
    cv.subtract(closedBig, walls, openings);

    const oLabels = track(new cv.Mat());
    const oStats = track(new cv.Mat());
    const oCent = track(new cv.Mat());
    const nOpen = cv.connectedComponentsWithStats(openings, oLabels, oStats, oCent, 8);

    const doors = [];
    const windows = [];
    for (let i = 1; i < nOpen; i++) {
      const bx = oStats.data32S[i * 5 + cv.CC_STAT_LEFT];
      const by = oStats.data32S[i * 5 + cv.CC_STAT_TOP];
      const bw = oStats.data32S[i * 5 + cv.CC_STAT_WIDTH];
      const bh = oStats.data32S[i * 5 + cv.CC_STAT_HEIGHT];
      const area = oStats.data32S[i * 5 + cv.CC_STAT_AREA];

      const long = Math.max(bw, bh);
      const short = Math.min(bw, bh);
      if (short < wallT * 0.35 || short > wallT * 2.5) continue;
      if (long < wallT * 1.6 || long > wallT * 9) continue;
      if (area < long * short * 0.35) continue;

      let inkCount = 0;
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          if (thinData[y * w + x]) inkCount++;
        }
      }
      const inkRatio = inkCount / (bw * bh);

      const item = { x: bx + bw / 2, y: by + bh / 2, length: long, o: bw >= bh ? 'h' : 'v' };
      if (inkRatio > 0.1) windows.push(item);
      else doors.push(item);
    }

    progress(90, 'Vectorizing wall geometry…');
    const contours = new cv.MatVector();
    const hierarchy = track(new cv.Mat());
    cv.findContours(walls, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

    const eps = Math.max(1.2, wallT * 0.22);
    const hier = hierarchy.data32S;
    const rings = [];
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const approx = new cv.Mat();
      cv.approxPolyDP(c, approx, eps, true);
      const pts = [];
      const d = approx.data32S;
      for (let j = 0; j < approx.rows; j++) {
        pts.push({ x: d[j * 2], y: d[j * 2 + 1] });
      }
      rings.push({ pts, parent: hier[i * 4 + 3] });
      approx.delete();
      c.delete();
    }
    contours.delete();

    const components = [];
    const outerToComp = new Map();
    rings.forEach((r, i) => {
      if (r.parent === -1 && r.pts.length >= 3) {
        outerToComp.set(i, components.length);
        components.push({ rings: [r.pts] });
      }
    });
    rings.forEach((r) => {
      if (r.parent !== -1 && r.pts.length >= 3) {
        const ci = outerToComp.get(r.parent);
        if (ci !== undefined) components[ci].rings.push(r.pts);
      }
    });

    progress(100, 'Done');
    return {
      components,
      doors,
      windows,
      wallThickness: wallT,
      wallCount: components.length,
      width: w,
      height: h
    };
  } finally {
    for (const m of mats) {
      try { m.delete(); } catch (err) { /* already deleted */ }
    }
  }
}

// ---------------- Pure-JS raster trace (fallback, no OpenCV) ----------------

function traceInk(payload) {
  const { width: w, height: h, buffer } = payload;
  const data = new Uint8ClampedArray(buffer);
  const n = w * h;
  const radius = 14;
  const offset = 12;
  const inkAbsolute = 60;

  const gray = new Float32Array(n);
  let sumAll = 0;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const g = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    gray[i] = g;
    sumAll += g;
  }
  if (sumAll / n < 110) {
    for (let i = 0; i < n; i++) gray[i] = 255 - gray[i];
  }

  const iw = w + 1;
  const integral = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x];
      integral[(y + 1) * iw + (x + 1)] = integral[y * iw + (x + 1)] + rowSum;
    }
  }

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
      if (g < sum / area - offset || g < inkAbsolute) ink[y * w + x] = 1;
    }
  }

  // Despeckle
  const mask = new Uint8Array(n);
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
      if (neighbors >= 2) mask[i] = 1;
    }
  }

  return { mask, width: w, height: h };
}
