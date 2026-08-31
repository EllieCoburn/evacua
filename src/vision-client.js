// Main-thread client for the vision worker. All heavy analysis happens in
// the worker; this wraps it in a promise API with progress callbacks.

let worker = null;
let nextId = 1;
const pending = new Map();

function getWorker() {
  if (worker) return worker;

  worker = new Worker('src/vision-worker.js');

  worker.onmessage = (e) => {
    const msg = e.data;
    const req = pending.get(msg.id);
    if (!req) return;

    if (msg.type === 'progress') {
      req.onProgress?.(msg.pct, msg.label);
    } else if (msg.type === 'done') {
      req.resolve(msg.result);
      pending.delete(msg.id);
    } else if (msg.type === 'error') {
      req.reject(new Error(msg.error));
      pending.delete(msg.id);
    }
  };

  worker.onerror = (e) => {
    const err = new Error(e.message || 'Vision worker crashed');
    for (const req of pending.values()) req.reject(err);
    pending.clear();
    worker = null; // allow a fresh worker on the next request
  };

  return worker;
}

export function visionRequest(type, payload, onProgress, transfer) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    try {
      getWorker().postMessage({ id, type, payload }, transfer || []);
    } catch (err) {
      pending.delete(id);
      reject(err);
    }
  });
}

// Pre-download and compile the vision engine in the background
export function warmupVision() {
  return visionRequest('warmup', {}).catch(err => {
    console.warn('Vision engine warmup failed (will retry on first use):', err);
  });
}

// Downscale any drawable source into ImageData for transfer to the worker
export function sourceToImageData(source, maxDim) {
  const srcW = source.naturalWidth || source.width;
  const srcH = source.naturalHeight || source.height;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);

  return { imageData: ctx.getImageData(0, 0, w, h), scale };
}
