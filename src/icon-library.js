// Professional evacuation-map symbol library.
// One set of SVG pictograms used everywhere: palette buttons, the map canvas,
// and the exported legend — modeled on real NFPA 170 / ISO 7010 signage.

const RED = '#c8102e';     // fire equipment / routes / you-are-here
const GREEN = '#0a7d33';   // safe condition: exits, first aid, assembly
const BLACK = '#1a1a1a';   // building features: stairs, elevator, restroom
const YELLOW = '#ffd200';  // warning

function svgWrap(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`;
}

export const ICONS = {
  'you-are-here': {
    name: 'You Are Here',
    size: 46,
    svg: svgWrap(`
      <path d="M50 6 C31 6 18 20 18 38 C18 62 50 94 50 94 C50 94 82 62 82 38 C82 20 69 6 50 6 Z"
            fill="${RED}" stroke="#fff" stroke-width="4"/>
      <circle cx="50" cy="38" r="13" fill="#fff"/>`)
  },
  'emergency-exit': {
    name: 'Emergency Exit',
    size: 48,
    svg: svgWrap(`
      <rect x="2" y="2" width="96" height="96" rx="10" fill="${GREEN}"/>
      <rect x="68" y="16" width="16" height="68" fill="none" stroke="#fff" stroke-width="5"/>
      <circle cx="36" cy="25" r="8" fill="#fff"/>
      <path d="M28 41 L44 36 L53 47 L64 51" stroke="#fff" stroke-width="7" fill="none"
            stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M44 36 L43 58 L55 69 L53 84" stroke="#fff" stroke-width="7" fill="none"
            stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M43 58 L31 66 L25 82" stroke="#fff" stroke-width="7" fill="none"
            stroke-linecap="round" stroke-linejoin="round"/>`)
  },
  'route-primary': {
    name: 'Primary Route',
    isRoute: true,
    color: RED,
    dash: [],
    size: 40,
    svg: svgWrap(`
      <path d="M12 78 L54 78 L54 36 L70 36" stroke="${RED}" stroke-width="10" fill="none"
            stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M66 20 L92 36 L66 52 Z" fill="${RED}"/>`)
  },
  'route-alt': {
    name: 'Alternative Route',
    isRoute: true,
    color: RED,
    dash: [14, 10],
    size: 40,
    svg: svgWrap(`
      <path d="M12 78 L54 78 L54 36 L70 36" stroke="${RED}" stroke-width="10" fill="none"
            stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="16 12"/>
      <path d="M66 20 L92 36 L66 52 Z" fill="${RED}"/>`)
  },
  'fire-extinguisher': {
    name: 'Fire Extinguisher',
    size: 44,
    svg: svgWrap(`
      <circle cx="50" cy="50" r="47" fill="${RED}"/>
      <rect x="42" y="38" width="20" height="40" rx="6" fill="#fff"/>
      <rect x="46" y="27" width="12" height="9" rx="2" fill="#fff"/>
      <path d="M48 28 C36 23 28 30 30 41" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M24 40 L36 42 L28 52 Z" fill="#fff"/>`)
  },
  'fire-alarm': {
    name: 'Fire Alarm',
    size: 42,
    svg: svgWrap(`
      <circle cx="50" cy="50" r="47" fill="${RED}"/>
      <text x="50" y="69" font-family="Arial, Helvetica, sans-serif" font-size="56"
            font-weight="bold" fill="#fff" text-anchor="middle">A</text>`)
  },
  'first-aid': {
    name: 'First Aid',
    size: 44,
    svg: svgWrap(`
      <rect x="2" y="2" width="96" height="96" rx="10" fill="${GREEN}"/>
      <rect x="41" y="20" width="18" height="60" fill="#fff"/>
      <rect x="20" y="41" width="60" height="18" fill="#fff"/>`)
  },
  'aed': {
    name: 'AED',
    size: 46,
    svg: svgWrap(`
      <rect x="2" y="2" width="96" height="96" rx="10" fill="${GREEN}"/>
      <path d="M50 84 C18 60 23 28 41 28 C47 28 50 34 50 37 C50 34 53 28 59 28 C77 28 82 60 50 84 Z"
            fill="#fff"/>
      <polygon points="55,32 40,56 49,56 44,78 61,50 52,50" fill="${GREEN}"/>`)
  },
  'assembly-point': {
    name: 'Assembly Point',
    size: 48,
    svg: svgWrap(`
      <rect x="2" y="2" width="96" height="96" rx="10" fill="${GREEN}"/>
      <polygon points="35,35 14,25 25,14" fill="#fff"/>
      <polygon points="65,35 75,14 86,25" fill="#fff"/>
      <polygon points="35,65 25,86 14,75" fill="#fff"/>
      <polygon points="65,65 86,75 75,86" fill="#fff"/>
      <circle cx="50" cy="41" r="8" fill="#fff"/>
      <path d="M50 49 L50 62 M41 55 L59 55 M50 62 L42 76 M50 62 L58 76"
            stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>`)
  },
  'emergency-phone': {
    name: 'Emergency Phone',
    size: 42,
    svg: svgWrap(`
      <rect x="2" y="2" width="96" height="96" rx="10" fill="${GREEN}"/>
      <path d="M26 34 C26 20 74 20 74 34 L69 46 C67 50 58 49 57 44 C52 46 48 46 43 44 C42 49 33 50 31 46 Z"
            fill="#fff"/>
      <text x="50" y="80" font-family="Arial, Helvetica, sans-serif" font-size="26"
            font-weight="bold" fill="#fff" text-anchor="middle">SOS</text>`)
  },
  'stairwell': {
    name: 'Stairwell',
    size: 42,
    svg: svgWrap(`
      <rect x="3" y="3" width="94" height="94" rx="8" fill="#fff" stroke="${BLACK}" stroke-width="5"/>
      <path d="M16 80 L34 80 L34 64 L48 64 L48 48 L62 48 L62 32 L78 32 L78 20"
            stroke="${BLACK}" stroke-width="6" fill="none"/>`)
  },
  'elevator': {
    name: 'Elevator',
    size: 42,
    svg: svgWrap(`
      <rect x="3" y="3" width="94" height="94" rx="8" fill="#fff" stroke="${BLACK}" stroke-width="5"/>
      <rect x="26" y="26" width="48" height="48" fill="none" stroke="${BLACK}" stroke-width="5"/>
      <path d="M26 26 L74 74 M74 26 L26 74" stroke="${BLACK}" stroke-width="5"/>`)
  },
  'restroom': {
    name: 'Restroom',
    size: 42,
    svg: svgWrap(`
      <rect x="3" y="3" width="94" height="94" rx="8" fill="#fff" stroke="${BLACK}" stroke-width="5"/>
      <circle cx="33" cy="24" r="8" fill="${BLACK}"/>
      <rect x="26" y="34" width="14" height="24" rx="4" fill="${BLACK}"/>
      <rect x="27" y="58" width="5" height="20" fill="${BLACK}"/>
      <rect x="34" y="58" width="5" height="20" fill="${BLACK}"/>
      <circle cx="67" cy="24" r="8" fill="${BLACK}"/>
      <polygon points="67,34 55,60 79,60" fill="${BLACK}"/>
      <rect x="61" y="60" width="5" height="18" fill="${BLACK}"/>
      <rect x="68" y="60" width="5" height="18" fill="${BLACK}"/>
      <line x1="50" y1="16" x2="50" y2="84" stroke="${BLACK}" stroke-width="2"/>`)
  },
  'hazard': {
    name: 'Hazard',
    size: 44,
    svg: svgWrap(`
      <path d="M50 8 L96 88 L4 88 Z" fill="${YELLOW}" stroke="${BLACK}" stroke-width="5"
            stroke-linejoin="round"/>
      <rect x="45" y="36" width="10" height="28" rx="4" fill="${BLACK}"/>
      <circle cx="50" cy="76" r="6" fill="${BLACK}"/>`)
  }
};

// ---- Preloaded raster images of each SVG for canvas drawing ----
const iconImages = {};

export function preloadIcons() {
  const loads = Object.entries(ICONS).map(([key, icon]) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => {
        console.error(`Failed to rasterize icon: ${key}`);
        resolve();
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(icon.svg);
      iconImages[key] = img;
    });
  });
  return Promise.all(loads);
}

export function getIconImage(type) {
  return iconImages[type] || null;
}

export class IconElement {
  constructor(type, x, y, id = null) {
    this.id = id || Math.random().toString(36).substr(2, 9);
    this.type = type;
    this.x = x;
    this.y = y;
    this.rotation = 0;
    this.scale = 1;
    this.label = '';
    this.selected = false;
  }

  getIcon() {
    return ICONS[this.type];
  }

  draw(ctx) {
    const icon = this.getIcon();
    if (!icon) return;

    const s = icon.size * this.scale;
    const img = getIconImage(this.type);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
    } else {
      // Fallback while the SVG rasterizes
      ctx.fillStyle = '#999';
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.selected) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(-s / 2 - 6, -s / 2 - 6, s + 12, s + 12);
      ctx.setLineDash([]);

      // Resize handle at the bottom-right corner
      ctx.fillStyle = '#2563eb';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fillRect(s / 2 + 6 - 7, s / 2 + 6 - 7, 14, 14);
      ctx.strokeRect(s / 2 + 6 - 7, s / 2 + 6 - 7, 14, 14);
    }

    if (this.label) {
      ctx.font = 'bold 11px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#1a1a1a';
      ctx.strokeText(this.label, 0, s / 2 + 6);
      ctx.fillText(this.label, 0, s / 2 + 6);
    }

    ctx.restore();
  }

  getBounds() {
    const s = this.getIcon().size * this.scale;
    return { x: this.x - s / 2, y: this.y - s / 2, width: s, height: s };
  }

  getHandleRect() {
    const s = this.getIcon().size * this.scale;
    // Matches the handle drawn in draw(); padded slightly for easier grabbing
    return { x: this.x + s / 2 - 3, y: this.y + s / 2 - 3, w: 18, h: 18 };
  }

  contains(x, y) {
    const s = this.getIcon().size * this.scale;
    return Math.abs(x - this.x) < s / 2 + 8 && Math.abs(y - this.y) < s / 2 + 8;
  }

  toJSON() {
    return {
      id: this.id, type: this.type, x: this.x, y: this.y,
      rotation: this.rotation, scale: this.scale, label: this.label
    };
  }

  static fromJSON(data) {
    const elem = new IconElement(data.type, data.x, data.y, data.id);
    elem.rotation = data.rotation || 0;
    elem.scale = data.scale || 1;
    elem.label = data.label || '';
    return elem;
  }
}

export class RouteElement {
  constructor(type, points = [], id = null) {
    this.id = id || Math.random().toString(36).substr(2, 9);
    this.type = type; // 'route-primary' or 'route-alt'
    this.points = points;
    this.selected = false;
  }

  draw(ctx) {
    if (this.points.length < 2) return;

    const icon = ICONS[this.type];
    if (!icon) return;

    ctx.save();

    // White casing underneath so the route reads over any floor plan
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.tracePath(ctx);
    ctx.stroke();

    // Route line
    ctx.strokeStyle = icon.color;
    ctx.lineWidth = 5;
    ctx.setLineDash(icon.dash || []);
    this.tracePath(ctx);
    ctx.stroke();
    ctx.setLineDash([]);

    // Single bold arrowhead at the end of the route (toward the exit),
    // like real evacuation plans
    const n = this.points.length;
    const p1 = this.points[n - 2];
    const p2 = this.points[n - 1];
    drawArrowhead(ctx, p1, p2, icon.color);

    if (this.selected) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 11;
      ctx.globalAlpha = 0.3;
      this.tracePath(ctx);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  tracePath(ctx) {
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
  }

  contains(x, y, threshold = 12) {
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      if (distanceToLine(x, y, p1.x, p1.y, p2.x, p2.y) < threshold) return true;
    }
    return false;
  }

  toJSON() {
    return { id: this.id, type: this.type, points: this.points };
  }

  static fromJSON(data) {
    return new RouteElement(data.type, data.points, data.id);
  }
}

function drawArrowhead(ctx, from, to, color) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const len = 18;

  ctx.save();
  ctx.translate(to.x, to.y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(len * 0.6, 0);
  ctx.lineTo(-len * 0.5, -len * 0.55);
  ctx.lineTo(-len * 0.2, 0);
  ctx.lineTo(-len * 0.5, len * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function distanceToLine(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  let param = -1;
  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;
  if (param < 0) { xx = x1; yy = y1; }
  else if (param > 1) { xx = x2; yy = y2; }
  else { xx = x1 + param * C; yy = y1 + param * D; }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}
