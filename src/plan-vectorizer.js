// Floor plan vectorization: reconstructs actual wall GEOMETRY from any
// source image, instead of just filtering pixels.
//
// Pipeline:
//   1. Binary ink mask (shared adaptive-threshold pipeline)
//   2. Connected-component filtering — discards text, dimensions, furniture
//      symbols, and speckle that aren't wall-scale structures
//   3. Run-length wall extraction — horizontal and vertical wall slabs are
//      detected as long ink runs and reduced to line segments with thickness
//   4. Collinear merging — bridges scan noise, keeps real openings
//   5. Door-opening detection — moderate gaps between collinear walls
//   6. Vector re-draw — a crisp, uniform, drafted plan. Every input source
//      (photo, 1980s hand drawing, CAD export) converges to the same output
//      style because the plan is redrawn from geometry, not from the pixels.

import { computeInkMask } from './plan-cleaner.js';

export function vectorizeFloorPlan(source, opts = {}) {
  const minWallLen = opts.minWallLen ?? 20;   // in working-resolution px
  const maxThickness = opts.maxThickness ?? 28;
  const bridgeGap = opts.bridgeGap ?? 5;

  const { mask, w, h, scale } = computeInkMask(source, { maxDim: opts.maxDim || 1400 });

  removeSmallComponents(mask, w, h, 50, 14);

  const horizontal = extractSegments(mask, w, h, 'h', minWallLen, maxThickness);
  const vertical = extractSegments(mask, w, h, 'v', minWallLen, maxThickness);

  let walls = mergeCollinear([...horizontal, ...vertical], bridgeGap);
  const doors = detectDoorOpenings(walls);

  // Map from working resolution back to source coordinates
  const inv = 1 / scale;
  for (const wall of walls) {
    wall.x1 *= inv; wall.y1 *= inv;
    wall.x2 *= inv; wall.y2 *= inv;
    wall.t *= inv;
  }
  for (const door of doors) {
    door.x *= inv; door.y *= inv; door.width *= inv;
  }

  const srcW = source.naturalWidth || source.width;
  const srcH = source.naturalHeight || source.height;

  return { walls, doors, width: srcW, height: srcH };
}

// Flood-fill labeling; erase components too small to be structure.
// This is what removes room labels, dimension text, and furniture marks.
function removeSmallComponents(mask, w, h, minArea, minBox) {
  const n = w * h;
  const visited = new Uint8Array(n);
  const stack = new Int32Array(n);
  const comp = new Int32Array(n);

  for (let start = 0; start < n; start++) {
    if (!mask[start] || visited[start]) continue;

    let sp = 0;
    let count = 0;
    stack[sp++] = start;
    visited[start] = 1;
    let minX = w, maxX = 0, minY = h, maxY = 0;

    while (sp > 0) {
      const idx = stack[--sp];
      comp[count++] = idx;
      const x = idx % w;
      const y = (idx - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0 && mask[idx - 1] && !visited[idx - 1]) { visited[idx - 1] = 1; stack[sp++] = idx - 1; }
      if (x < w - 1 && mask[idx + 1] && !visited[idx + 1]) { visited[idx + 1] = 1; stack[sp++] = idx + 1; }
      if (y > 0 && mask[idx - w] && !visited[idx - w]) { visited[idx - w] = 1; stack[sp++] = idx - w; }
      if (y < h - 1 && mask[idx + w] && !visited[idx + w]) { visited[idx + w] = 1; stack[sp++] = idx + w; }
    }

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    if (count < minArea || (bw < minBox && bh < minBox)) {
      for (let i = 0; i < count; i++) mask[comp[i]] = 0;
    }
  }
}

// Scan rows (or columns), group overlapping ink runs across adjacent
// rows into slabs, and keep only slabs shaped like walls: long and thin.
function extractSegments(mask, w, h, dir, minLen, maxThick) {
  const segments = [];
  const primary = dir === 'h' ? h : w;
  const secondary = dir === 'h' ? w : h;

  let active = [];

  const finalize = (g) => {
    const len = g.maxS - g.minS + 1;
    const thick = g.lastP - g.firstP + 1;
    if (len >= minLen && thick <= maxThick && len >= 2.2 * thick) {
      const mid = (g.firstP + g.lastP) / 2;
      if (dir === 'h') {
        segments.push({ x1: g.minS, y1: mid, x2: g.maxS, y2: mid, t: thick, o: 'h' });
      } else {
        segments.push({ x1: mid, y1: g.minS, x2: mid, y2: g.maxS, t: thick, o: 'v' });
      }
    }
  };

  for (let p = 0; p < primary; p++) {
    // Ink runs along this row/column
    const runs = [];
    let runStart = -1;
    for (let q = 0; q <= secondary; q++) {
      const on = q < secondary && mask[dir === 'h' ? p * w + q : q * w + p];
      if (on && runStart < 0) {
        runStart = q;
      } else if (!on && runStart >= 0) {
        if (q - runStart >= 3) runs.push([runStart, q - 1]);
        runStart = -1;
      }
    }

    // Continue existing slabs or finalize them
    const nextActive = [];
    const used = new Uint8Array(runs.length);
    for (const g of active) {
      let matched = -1;
      for (let ri = 0; ri < runs.length; ri++) {
        if (used[ri]) continue;
        if (runs[ri][0] <= g.maxS && runs[ri][1] >= g.minS) { matched = ri; break; }
      }
      if (matched >= 0) {
        used[matched] = 1;
        g.minS = Math.min(g.minS, runs[matched][0]);
        g.maxS = Math.max(g.maxS, runs[matched][1]);
        g.lastP = p;
        nextActive.push(g);
      } else {
        finalize(g);
      }
    }
    for (let ri = 0; ri < runs.length; ri++) {
      if (!used[ri]) {
        nextActive.push({ minS: runs[ri][0], maxS: runs[ri][1], firstP: p, lastP: p });
      }
    }
    active = nextActive;
  }
  active.forEach(finalize);

  return segments;
}

// Merge collinear segments separated by tiny gaps (scan noise), while
// preserving real openings like doorways.
function mergeCollinear(walls, gap) {
  const merged = [];
  for (const orientation of ['h', 'v']) {
    const group = walls.filter(wl => wl.o === orientation);
    const axis = orientation === 'h' ? 'y1' : 'x1';
    const lo = orientation === 'h' ? 'x1' : 'y1';
    const hi = orientation === 'h' ? 'x2' : 'y2';

    group.sort((a, b) => (a[axis] - b[axis]) || (a[lo] - b[lo]));

    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i], b = group[j];
          if (Math.abs(a[axis] - b[axis]) > 3) continue;
          const gapAB = Math.max(a[lo], b[lo]) - Math.min(a[hi], b[hi]);
          if (gapAB <= gap) {
            a[lo] = Math.min(a[lo], b[lo]);
            a[hi] = Math.max(a[hi], b[hi]);
            a.t = Math.max(a.t, b.t);
            a[axis] = (a[axis] + b[axis]) / 2;
            if (orientation === 'h') a.y2 = a.y1; else a.x2 = a.x1;
            group.splice(j, 1);
            changed = true;
            j--;
          }
        }
      }
    }
    merged.push(...group);
  }
  return merged;
}

// A moderate gap between two long collinear walls reads as a doorway.
function detectDoorOpenings(walls) {
  const doors = [];
  for (const orientation of ['h', 'v']) {
    const group = walls
      .filter(wl => wl.o === orientation)
      .sort((a, b) => {
        const axis = orientation === 'h' ? 'y1' : 'x1';
        const lo = orientation === 'h' ? 'x1' : 'y1';
        return (a[axis] - b[axis]) || (a[lo] - b[lo]);
      });

    const axis = orientation === 'h' ? 'y1' : 'x1';
    const lo = orientation === 'h' ? 'x1' : 'y1';
    const hi = orientation === 'h' ? 'x2' : 'y2';

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        if (Math.abs(a[axis] - b[axis]) > 4) continue;

        const first = a[hi] < b[lo] ? a : b;
        const second = first === a ? b : a;
        const gap = second[lo] - first[hi];
        const lenA = a[hi] - a[lo];
        const lenB = b[hi] - b[lo];

        if (gap >= 12 && gap <= 60 && lenA >= 25 && lenB >= 25) {
          const mid = first[hi] + gap / 2;
          if (orientation === 'h') {
            doors.push({ x: mid, y: a[axis], width: gap, o: 'h' });
          } else {
            doors.push({ x: a[axis], y: mid, width: gap, o: 'v' });
          }
        }
      }
    }
  }
  return doors;
}

// Redraw the plan from geometry: crisp uniform walls on white, with the
// classic quarter-arc door symbol at detected openings.
export function renderVectorPlan(plan, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(plan.width));
  canvas.height = Math.max(1, Math.round(plan.height));
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#1a1a1a';
  ctx.lineCap = 'square';

  for (const wall of plan.walls) {
    ctx.lineWidth = Math.min(20, Math.max(3, wall.t * 0.85));
    ctx.beginPath();
    ctx.moveTo(wall.x1, wall.y1);
    ctx.lineTo(wall.x2, wall.y2);
    ctx.stroke();
  }

  // Door swing symbols
  ctx.lineWidth = Math.max(1.5, canvas.width / 900);
  for (const door of plan.doors || []) {
    const r = door.width;
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

  return canvas;
}

// Hit-test a point (in plan/source coordinates) against the wall list.
export function findWallAt(plan, x, y, slack = 8) {
  for (let i = plan.walls.length - 1; i >= 0; i--) {
    const wl = plan.walls[i];
    const threshold = wl.t / 2 + slack;
    const dist = distanceToSegment(x, y, wl.x1, wl.y1, wl.x2, wl.y2);
    if (dist <= threshold) return i;
  }
  return -1;
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
  const lenSq = C * C + D * D;
  let param = lenSq !== 0 ? (A * C + B * D) / lenSq : -1;
  let xx, yy;
  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }
  return Math.hypot(px - xx, py - yy);
}
