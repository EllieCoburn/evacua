// Pure rendering + hit-testing for reconstructed plan geometry.
// (All analysis happens in the vision worker; this only draws results.)

// Redraw the plan from geometry: filled wall polygons, door swing arcs,
// double-line window symbols.
export function renderPlanCanvas(plan) {
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

  // Cut a white gap through the wall at every opening (matters for doors
  // and windows the user adds onto solid walls; harmless for detected ones)
  ctx.fillStyle = '#ffffff';
  for (const opening of [...(plan.doors || []), ...(plan.windows || [])]) {
    const half = opening.length / 2;
    const cut = t * 0.75;
    if (opening.o === 'h') {
      ctx.fillRect(opening.x - half, opening.y - cut, opening.length, cut * 2);
    } else {
      ctx.fillRect(opening.x - cut, opening.y - half, cut * 2, opening.length);
    }
  }

  ctx.strokeStyle = '#1a1a1a';

  // Door swing arcs
  ctx.lineWidth = Math.max(1.5, t * 0.12);
  for (const door of plan.doors || []) {
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
  for (const win of plan.windows || []) {
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

// Render a traced ink mask (fallback path) to a canvas
export function renderTraceCanvas(trace) {
  const { mask, width: w, height: h } = trace;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(w, h);
  const od = out.data;
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    if (mask[i]) {
      od[p] = 26; od[p + 1] = 26; od[p + 2] = 26; od[p + 3] = 255;
    } else {
      od[p] = 255; od[p + 1] = 255; od[p + 2] = 255; od[p + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

// Hit-test doors and windows (their symbol regions) in plan coordinates
export function findOpeningAt(plan, x, y) {
  const t = plan.wallThickness || 8;
  const lists = [
    ['door', plan.doors || []],
    ['window', plan.windows || []]
  ];
  for (const [kind, list] of lists) {
    for (let i = list.length - 1; i >= 0; i--) {
      const op = list[i];
      const half = op.length / 2 + t;
      // Doors include the swing arc area above/right of the opening
      const reach = kind === 'door' ? op.length + t : t * 1.5;
      let hit;
      if (op.o === 'h') {
        hit = Math.abs(x - op.x) <= half && y <= op.y + t && y >= op.y - reach;
      } else {
        hit = Math.abs(y - op.y) <= half && x >= op.x - t && x <= op.x + reach;
      }
      if (hit) return { kind, index: i };
    }
  }
  return null;
}

// Add a straight wall to the model as a rectangle component
export function addWallToPlan(plan, x1, y1, x2, y2) {
  const t = Math.max(3, plan.wallThickness || 8);
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < t) return false;

  // Snap to axis when near-straight, like the reconstruction does
  if (Math.abs(y2 - y1) <= Math.max(3, Math.abs(x2 - x1) * 0.14)) {
    y2 = y1;
  } else if (Math.abs(x2 - x1) <= Math.max(3, Math.abs(y2 - y1) * 0.14)) {
    x2 = x1;
  }

  const nx = -(y2 - y1) / len * (t / 2);
  const ny = (x2 - x1) / len * (t / 2);
  plan.components.push({
    rings: [[
      { x: x1 + nx, y: y1 + ny },
      { x: x2 + nx, y: y2 + ny },
      { x: x2 - nx, y: y2 - ny },
      { x: x1 - nx, y: y1 - ny }
    ]]
  });
  plan.wallCount = plan.components.length;
  return true;
}

// Orientation of the nearest wall edge — used to align doors/windows the
// user places onto a wall
export function nearestWallOrientation(plan, x, y) {
  let best = Infinity;
  let orientation = 'h';
  for (const comp of plan.components) {
    for (const ring of comp.rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[j], b = ring[i];
        const d = distToSegment(x, y, a.x, a.y, b.x, b.y);
        if (d < best) {
          best = d;
          orientation = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'h' : 'v';
        }
      }
    }
  }
  return orientation;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const C = x2 - x1, D = y2 - y1;
  const lenSq = C * C + D * D;
  let t = lenSq ? ((px - x1) * C + (py - y1) * D) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * C), py - (y1 + t * D));
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
