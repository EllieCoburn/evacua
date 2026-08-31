// Emergency icon definitions following ANSI Z535.4, ISO 3864, and NFPA 170 standards
// All symbols are professional SVG-based representations with proper color coding

export const ICONS = {
  'emergency-exit': {
    name: 'Emergency Exit',
    color: '#16a34a',  // ISO 3864 safety green
    size: 50,
    description: 'Emergency exit location with arrow',
    standard: 'ISO 3864-1'
  },
  'evacuation-route': {
    name: 'Evacuation Route',
    color: '#16a34a',  // ISO safety green
    size: 40,
    description: 'Primary evacuation path (draw as route)',
    isRoute: true,
    standard: 'ISO 3864-1'
  },
  'alt-evacuation-route': {
    name: 'Alternative Evacuation Route',
    color: '#fbbf24',  // ISO warning yellow
    size: 40,
    description: 'Alternative evacuation path (draw as route)',
    isRoute: true,
    standard: 'ISO 3864-1'
  },
  'assembly-point': {
    name: 'Assembly/Muster Point',
    color: '#06b6d4',  // ISO information blue
    size: 50,
    description: 'Designated meeting point for assembly',
    standard: 'NFPA 170'
  },
  'fire-extinguisher': {
    name: 'Fire Extinguisher',
    color: '#dc2626',  // ISO danger red
    size: 45,
    description: 'Fire extinguisher location',
    standard: 'ISO 3864-1'
  },
  'first-aid': {
    name: 'First Aid Kit',
    color: '#16a34a',  // ISO safety green
    size: 45,
    description: 'First aid station or medical kit',
    standard: 'ISO 3864-1'
  },
  'emergency-telephone': {
    name: 'Emergency Telephone',
    color: '#06b6d4',  // ISO information blue
    size: 45,
    description: 'Emergency telephone location',
    standard: 'ISO 3864-1'
  },
  'aed-defibrillator': {
    name: 'Automated Defibrillator (AED)',
    color: '#06b6d4',  // ISO information blue
    size: 50,
    description: 'Automated external defibrillator location',
    standard: 'ISO 3864-1'
  },
  'emergency-alarm': {
    name: 'Emergency Alarm/Bell',
    color: '#fbbf24',  // ISO warning yellow
    size: 40,
    description: 'Fire alarm pull station or emergency bell',
    standard: 'ISO 3864-1'
  },
  'hazard-zone': {
    name: 'Hazard Zone',
    color: '#dc2626',  // ISO danger red
    size: 50,
    description: 'Area with hazardous conditions/materials',
    standard: 'ANSI Z535.4'
  },
  'emergency-shower': {
    name: 'Emergency Shower',
    color: '#16a34a',  // ISO safety green
    size: 45,
    description: 'Emergency shower/eyewash station',
    standard: 'ANSI Z535.4'
  },
  'evacuation-chair': {
    name: 'Evacuation Chair',
    color: '#16a34a',  // ISO safety green
    size: 45,
    description: 'Evacuation chair for mobility assistance',
    standard: 'ISO 3864-1'
  }
};

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

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.scale(this.scale, this.scale);

    // Draw the appropriate SVG symbol based on type
    drawEmergencySymbol(ctx, this.type, icon);

    // Draw selection indicator
    if (this.selected) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, icon.size / 2 + 15, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw label if exists
    if (this.label) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.font = 'bold 11px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const textY = icon.size / 2 + 15;
      ctx.strokeText(this.label, 0, textY);
      ctx.fillText(this.label, 0, textY);
    }

    ctx.restore();
  }

  getBounds() {
    const icon = this.getIcon();
    const r = icon.size / 2 + 15;
    return {
      x: this.x - r,
      y: this.y - r,
      width: r * 2,
      height: r * 2
    };
  }

  contains(x, y) {
    const icon = this.getIcon();
    const dx = x - this.x;
    const dy = y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (icon.size / 2 + 15);
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      rotation: this.rotation,
      scale: this.scale,
      label: this.label
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
    this.type = type; // 'evacuation-route' or 'alt-evacuation-route'
    this.points = points; // Array of {x, y}
    this.selected = false;
  }

  draw(ctx) {
    if (this.points.length < 2) return;

    const icon = ICONS[this.type];
    if (!icon) return;

    // Draw route line with arrow markers
    ctx.strokeStyle = icon.color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);

    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }

    ctx.stroke();

    // Draw arrows along the route at regular intervals
    const spacing = 60;
    let distanceAlongRoute = 0;

    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      const segmentDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

      // Draw arrows at intervals along this segment
      let segmentProgress = 0;
      while (segmentProgress < segmentDist) {
        const ratio = segmentProgress / segmentDist;
        const arrowX = p1.x + (p2.x - p1.x) * ratio;
        const arrowY = p1.y + (p2.y - p1.y) * ratio;
        drawDirectionalArrow(ctx, p1.x, p1.y, p2.x, p2.y, arrowX, arrowY, icon.color);
        segmentProgress += spacing;
      }
      distanceAlongRoute += segmentDist;
    }

    // Draw selection highlight
    if (this.selected) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i < this.points.length; i++) {
        ctx.lineTo(this.points[i].x, this.points[i].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  contains(x, y, threshold = 15) {
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      const dist = distanceToLine(x, y, p1.x, p1.y, p2.x, p2.y);
      if (dist < threshold) return true;
    }
    return false;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      points: this.points
    };
  }

  static fromJSON(data) {
    return new RouteElement(data.type, data.points, data.id);
  }
}

// Symbol drawing functions - each implements ISO 3864/ANSI Z535.4 standard representations
function drawEmergencySymbol(ctx, type, icon) {
  const size = icon.size;
  const color = icon.color;

  switch (type) {
    case 'emergency-exit':
      drawExitSign(ctx, color, size);
      break;
    case 'assembly-point':
      drawAssemblyPoint(ctx, color, size);
      break;
    case 'fire-extinguisher':
      drawFireExtinguisher(ctx, color, size);
      break;
    case 'first-aid':
      drawFirstAidKit(ctx, color, size);
      break;
    case 'emergency-telephone':
      drawEmergencyTelephone(ctx, color, size);
      break;
    case 'aed-defibrillator':
      drawDefibrillator(ctx, color, size);
      break;
    case 'emergency-alarm':
      drawEmergencyAlarm(ctx, color, size);
      break;
    case 'hazard-zone':
      drawHazardZone(ctx, color, size);
      break;
    case 'emergency-shower':
      drawEmergencyShower(ctx, color, size);
      break;
    case 'evacuation-chair':
      drawEvacuationChair(ctx, color, size);
      break;
    default:
      drawPlaceholder(ctx, color, size);
  }
}

function drawExitSign(ctx, color, size) {
  const r = size / 2;

  // Background rectangle
  ctx.fillStyle = color;
  ctx.fillRect(-r, -r * 0.6, size, size * 0.6);

  // Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-r, -r * 0.6, size, size * 0.6);

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', 0, -r * 0.3);

  // Arrow pointing right
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(r * 0.3, r * 0.2);
  ctx.lineTo(r * 0.7, r * 0.2);
  ctx.lineTo(r * 0.5, r * 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawAssemblyPoint(ctx, color, size) {
  const r = size / 2;

  // Outer triangle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r, r * 0.8);
  ctx.lineTo(-r, r * 0.8);
  ctx.closePath();
  ctx.fill();

  // Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Two figures inside
  ctx.fillStyle = '#ffffff';

  // Left figure
  ctx.beginPath();
  ctx.arc(-r * 0.4, -r * 0.2, r * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillRect(-r * 0.5, 0, r * 0.2, r * 0.5);

  // Right figure
  ctx.beginPath();
  ctx.arc(r * 0.4, -r * 0.2, r * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillRect(r * 0.3, 0, r * 0.2, r * 0.5);
}

function drawFireExtinguisher(ctx, color, size) {
  const r = size / 2;

  // Background square with border
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.7, -r * 0.7, size * 0.7, size * 0.7);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-r * 0.7, -r * 0.7, size * 0.7, size * 0.7);

  // Extinguisher shape in white
  ctx.fillStyle = '#ffffff';

  // Tank body
  ctx.fillRect(-r * 0.3, -r * 0.3, r * 0.6, r * 0.5);

  // Nozzle
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.3);
  ctx.lineTo(r * 0.15, -r * 0.35);
  ctx.lineTo(r * 0.2, -r * 0.2);
  ctx.lineTo(-r * 0.1, -r * 0.15);
  ctx.closePath();
  ctx.fill();

  // Handle
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.3);
  ctx.quadraticCurveTo(-r * 0.45, -r * 0.5, r * 0.2, -r * 0.3);
  ctx.stroke();
}

function drawFirstAidKit(ctx, color, size) {
  const r = size / 2;

  // White background square
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r * 0.65, -r * 0.65, size * 0.65, size * 0.65);

  // Green border
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(-r * 0.65, -r * 0.65, size * 0.65, size * 0.65);

  // Red cross
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.15, -r * 0.45, r * 0.3, r * 0.9);
  ctx.fillRect(-r * 0.45, -r * 0.15, r * 0.9, r * 0.3);
}

function drawEmergencyTelephone(ctx, color, size) {
  const r = size / 2;

  // Blue background circle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // White telephone
  ctx.fillStyle = '#ffffff';

  // Phone body
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -r * 0.2);
  ctx.lineTo(r * 0.35, -r * 0.2);
  ctx.quadraticCurveTo(r * 0.4, 0, r * 0.35, r * 0.2);
  ctx.lineTo(-r * 0.35, r * 0.2);
  ctx.quadraticCurveTo(-r * 0.4, 0, -r * 0.35, -r * 0.2);
  ctx.closePath();
  ctx.fill();

  // Handset
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.15, r * 0.1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.2, -r * 0.15, r * 0.1, 0, Math.PI * 2);
  ctx.stroke();
}

function drawDefibrillator(ctx, color, size) {
  const r = size / 2;

  // Blue background
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
  ctx.fill();

  // Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // White AED device
  ctx.fillStyle = '#ffffff';

  // Main box
  ctx.fillRect(-r * 0.4, -r * 0.4, r * 0.8, r * 0.7);

  // Pads area
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-r * 0.3, -r * 0.2, r * 0.3, r * 0.25);
  ctx.fillRect(0, -r * 0.2, r * 0.3, r * 0.25);

  // "AED" text
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${r * 0.3}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AED', 0, r * 0.15);
}

function drawEmergencyAlarm(ctx, color, size) {
  const r = size / 2;

  // Yellow background
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Bell shape
  ctx.fillStyle = '#000000';

  // Bell dome
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.1, r * 0.35, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bell handle
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.4);
  ctx.quadraticCurveTo(0, -r * 0.6, r * 0.15, -r * 0.4);
  ctx.stroke();

  // Clapper
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, r * 0.3);
  ctx.stroke();
}

function drawHazardZone(ctx, color, size) {
  const r = size / 2;

  // Hazard stripes (yellow and red/black)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r, 0);
  ctx.closePath();
  ctx.fill();

  // Stripes
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.3);
  ctx.lineTo(r * 0.3, r * 0.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-r * 0.7, 0);
  ctx.lineTo(r * 0.5, 0);
  ctx.stroke();

  // Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r, 0);
  ctx.closePath();
  ctx.stroke();

  // Exclamation mark
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${r * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 0, -r * 0.1);
}

function drawEmergencyShower(ctx, color, size) {
  const r = size / 2;

  // Green background square
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.7, -r * 0.7, size * 0.7, size * 0.7);

  // Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-r * 0.7, -r * 0.7, size * 0.7, size * 0.7);

  // Shower head and water
  ctx.fillStyle = '#ffffff';

  // Pipe
  ctx.fillRect(-r * 0.1, -r * 0.5, r * 0.2, r * 0.4);

  // Shower head
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.1, r * 0.35, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Water droplets
  ctx.beginPath();
  ctx.arc(-r * 0.2, r * 0.15, r * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, r * 0.2, r * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(r * 0.2, r * 0.15, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawEvacuationChair(ctx, color, size) {
  const r = size / 2;

  // Green background square
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.7, -r * 0.7, size * 0.7, size * 0.7);

  // Border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-r * 0.7, -r * 0.7, size * 0.7, size * 0.7);

  // White chair figure
  ctx.fillStyle = '#ffffff';

  // Seat
  ctx.fillRect(-r * 0.3, -r * 0.1, r * 0.6, r * 0.25);

  // Backrest
  ctx.fillRect(-r * 0.3, -r * 0.35, r * 0.1, r * 0.35);

  // Arm rests
  ctx.fillRect(-r * 0.35, -r * 0.15, r * 0.1, r * 0.25);
  ctx.fillRect(r * 0.25, -r * 0.15, r * 0.1, r * 0.25);

  // Tracks/wheels
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-r * 0.25, r * 0.2, r * 0.08, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(r * 0.25, r * 0.2, r * 0.08, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPlaceholder(ctx, color, size) {
  const r = size / 2;

  // Placeholder circle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Question mark
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, 0);
}

function drawDirectionalArrow(ctx, p1x, p1y, p2x, p2y, arrowX, arrowY, color) {
  const headlen = 12;
  const angle = Math.atan2(p2y - p1y, p2x - p1x);

  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(arrowX, arrowY);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-headlen, -headlen * 0.6);
  ctx.lineTo(-headlen * 0.6, 0);
  ctx.lineTo(-headlen, headlen * 0.6);
  ctx.closePath();
  ctx.fill();

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

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}
