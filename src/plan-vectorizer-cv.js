// Floor plan reconstruction on OpenCV (WebAssembly build, loaded on demand).
//
// This is the production-CV pipeline used by real plan-digitizing tools:
//
//   1. Adaptive threshold -> ink mask (robust to photos, shadows, scans)
//   2. Distance transform -> automatic wall-thickness estimation
//   3. Morphological opening sized to the wall thickness -> WALL MASK.
//      Walls are the thick strokes in any floor plan; text, dimension
//      lines, and furniture are thin and vanish. Works at any angle.
//   4. Morphological closing -> bridge breaks from scanning/hand drawing
//   5. Connected-component filtering -> drop non-structural fragments
//   6. Contour extraction + polygon simplification -> vector wall shapes
//      (with holes), i.e. real geometry, not pixels
//   7. Opening detection: close the wall mask with a large kernel and
//      diff — the difference marks gaps that bridge nearby walls.
//      Gaps containing drawn glass lines classify as WINDOWS, empty
//      gaps as DOORS.

const OPENCV_CDN = 'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js';

let cvPromise = null;

export function loadOpenCV() {
  if (cvPromise) return cvPromise;

  cvPromise = new Promise((resolve, reject) => {
    const settle = () => {
      const cv = window.cv;
      if (!cv) return false;
      if (typeof cv.then === 'function') {
        cv.then((mod) => { window.cv = mod; resolve(mod); });
      } else if (cv.Mat) {
        resolve(cv);
      } else {
        cv.onRuntimeInitialized = () => resolve(window.cv);
      }
      return true;
    };

    if (settle()) return;

    const script = document.createElement('script');
    script.src = OPENCV_CDN;
    script.async = true;
    script.onload = () => {
      if (!settle()) reject(new Error('Vision engine loaded but failed to initialize'));
    };
    script.onerror = () => reject(new Error('Could not load the vision engine (check connection)'));
    document.head.appendChild(script);

    setTimeout(() => reject(new Error('Vision engine load timed out')), 45000);
  });

  // Allow a retry after failure
  cvPromise.catch(() => { cvPromise = null; });
  return cvPromise;
}

export async function vectorizeCV(source, opts = {}) {
  const cv = await loadOpenCV();

  const maxDim = opts.maxDim || 1600;
  const srcW = source.naturalWidth || source.width;
  const srcH = source.naturalHeight || source.height;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const wctx = work.getContext('2d');
  wctx.fillStyle = '#ffffff';
  wctx.fillRect(0, 0, w, h);
  wctx.drawImage(source, 0, 0, w, h);

  const mats = [];
  const track = (m) => { mats.push(m); return m; };

  try {
    const src = track(cv.imread(work));
    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Dark-background sources: invert so ink is dark
    if (cv.mean(gray)[0] < 110) cv.bitwise_not(gray, gray);

    cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0);

    // Ink mask: adaptive (photos/uneven light) OR-ed with absolute dark
    // (keeps large solid wall fills that adaptive would hollow out)
    const bin = track(new cv.Mat());
    cv.adaptiveThreshold(gray, bin, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 41, 15);
    const dark = track(new cv.Mat());
    cv.threshold(gray, dark, 70, 255, cv.THRESH_BINARY_INV);
    cv.bitwise_or(bin, dark, bin);

    // Estimate wall thickness from the distance transform: inside a wall,
    // distance to background ~ half the wall thickness
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

    // WALL MASK: opening removes everything thinner than the kernel —
    // text, dimension lines, furniture — leaving wall-thickness strokes
    const kOpen = Math.max(2, Math.round(wallT * 0.5));
    const kernelO = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kOpen, kOpen)));
    const walls = track(new cv.Mat());
    cv.morphologyEx(bin, walls, cv.MORPH_OPEN, kernelO);

    // Bridge breaks (hand drawings, scan dropout). Slider-tunable.
    const bridgeFactor = ((opts.bridgeGap ?? 5) / 5);
    const kClose = Math.max(1, Math.round(wallT * 0.5 * bridgeFactor + 1));
    const kernelC = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kClose, kClose)));
    cv.morphologyEx(walls, walls, cv.MORPH_CLOSE, kernelC);

    // Drop fragments too small to be structure. Slider-tunable.
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

    // Thin-ink layer (original ink minus walls) — used to classify openings
    const thin = track(new cv.Mat());
    const wallsInv = track(new cv.Mat());
    cv.bitwise_not(walls, wallsInv);
    cv.bitwise_and(bin, wallsInv, thin);
    const thinData = thin.data;

    // OPENINGS: close the wall mask with a large kernel; the diff marks
    // gaps that bridge nearby wall ends (doorways / windows)
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

      // Must be wall-scale in one direction and door/window-scale in the other
      if (short < wallT * 0.35 || short > wallT * 2.5) continue;
      if (long < wallT * 1.6 || long > wallT * 9) continue;
      if (area < long * short * 0.35) continue;

      // Windows have glass lines drawn inside the gap; doors are empty
      let inkCount = 0;
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          if (thinData[y * w + x]) inkCount++;
        }
      }
      const inkRatio = inkCount / (bw * bh);

      const item = {
        x: bx + bw / 2,
        y: by + bh / 2,
        length: long,
        o: bw >= bh ? 'h' : 'v'
      };
      if (inkRatio > 0.1) windows.push(item);
      else doors.push(item);
    }

    // Vectorize the wall mask into polygons with holes
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

    // Scale geometry back to source coordinates
    const inv = 1 / scale;
    for (const comp of components) {
      for (const ring of comp.rings) {
        for (const p of ring) { p.x *= inv; p.y *= inv; }
      }
    }
    for (const d of doors) { d.x *= inv; d.y *= inv; d.length *= inv; }
    for (const win of windows) { win.x *= inv; win.y *= inv; win.length *= inv; }

    return {
      mode: 'cv',
      components,
      doors,
      windows,
      width: srcW,
      height: srcH,
      wallThickness: wallT * inv,
      wallCount: components.length
    };
  } finally {
    for (const m of mats) {
      try { m.delete(); } catch (e) { /* already deleted */ }
    }
  }
}

// Redraw the plan from geometry: filled wall polygons, door swing arcs,
// double-line window symbols.
export function renderCVPlan(plan) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(plan.width));
  canvas.height = Math.max(1, Math.round(plan.height));
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1a1a1a';
  for (const comp of plan.components) {
    ctx.beginPath();
    for (const ring of comp.rings) {
      ctx.moveTo(ring[0].x, ring[0].y);
      for (let i = 1; i < ring.length; i++) {
        ctx.lineTo(ring[i].x, ring[i].y);
      }
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }

  const t = plan.wallThickness || 8;
  ctx.strokeStyle = '#1a1a1a';

  // Door swing arcs
  ctx.lineWidth = Math.max(1.5, t * 0.12);
  for (const door of plan.doors) {
    const r = door.length;
    ctx.beginPath();
    if (door.o === 'h') {
      const hx = door.x - r / 2;
      ctx.moveTo(hx, door.y);
      ctx.lineTo(hx, door.y - r);
      ctx.arc(hx, door.y, r, -Math.PI / 2, 0);
    } else {
      const hy = door.y - r / 2;
      ctx.moveTo(door.x, hy);
      ctx.lineTo(door.x + r, hy);
      ctx.arc(door.x, hy, r, 0, Math.PI / 2);
    }
    ctx.stroke();
  }

  // Windows: double thin lines across the opening
  ctx.lineWidth = Math.max(1.2, t * 0.1);
  for (const win of plan.windows) {
    const half = win.length / 2;
    const off = Math.max(1.5, t * 0.18);
    ctx.beginPath();
    if (win.o === 'h') {
      ctx.moveTo(win.x - half, win.y - off);
      ctx.lineTo(win.x + half, win.y - off);
      ctx.moveTo(win.x - half, win.y + off);
      ctx.lineTo(win.x + half, win.y + off);
      ctx.moveTo(win.x - half, win.y - off * 2);
      ctx.lineTo(win.x - half, win.y + off * 2);
      ctx.moveTo(win.x + half, win.y - off * 2);
      ctx.lineTo(win.x + half, win.y + off * 2);
    } else {
      ctx.moveTo(win.x - off, win.y - half);
      ctx.lineTo(win.x - off, win.y + half);
      ctx.moveTo(win.x + off, win.y - half);
      ctx.lineTo(win.x + off, win.y + half);
      ctx.moveTo(win.x - off * 2, win.y - half);
      ctx.lineTo(win.x + off * 2, win.y - half);
      ctx.moveTo(win.x - off * 2, win.y + half);
      ctx.lineTo(win.x + off * 2, win.y + half);
    }
    ctx.stroke();
  }

  return canvas;
}

// Hit-test in plan coordinates: which wall component contains this point?
export function findComponentAt(plan, x, y) {
  for (let i = plan.components.length - 1; i >= 0; i--) {
    if (pointInComponent(plan.components[i], x, y)) return i;
  }
  return -1;
}

function pointInComponent(comp, x, y) {
  // Even-odd rule across all rings (outer boundary + holes)
  let inside = false;
  for (const ring of comp.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i].x, yi = ring[i].y;
      const xj = ring[j].x, yj = ring[j].y;
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
}
