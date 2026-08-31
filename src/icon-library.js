// Professional emergency evacuation symbols following NFPA 170 and OSHA standards
// Simple, bold, high-contrast symbols for clarity and instant recognition

export const ICONS = {
  'emergency-exit': {
    name: 'Emergency Exit',
    color: '#16a34a',  // ISO safety green
    size: 50,
    description: 'Emergency exit location',
    standard: 'NFPA 170'
  },
  'evacuation-route': {
    name: 'Evacuation Route',
    color: '#dc2626',  // Bold red for evacuation
    size: 40,
    description: 'Primary evacuation path (draw as route)',
    isRoute: true,
    standard: 'NFPA 170'
  },
  'alt-evacuation-route': {
    name: 'Alternative Route',
    color: '#fbbf24',  // Warning yellow
    size: 40,
    description: 'Alternative evacuation path (draw as route)',
    isRoute: true,
    standard: 'NFPA 170'
  },
  'assembly-point': {
    name: 'Assembly Point',
    color: '#fbbf24',  // Yellow for gathering area
    size: 50,
    description: 'Designated assembly/muster point',
    standard: 'NFPA 170'
  },
  'fire-extinguisher': {
    name: 'Fire Extinguisher',
    color: '#dc2626',  // Bold red
    size: 45,
    description: 'Fire extinguisher location',
    standard: 'ISO 3864'
  },
  'first-aid': {
    name: 'First Aid Kit',
    color: '#16a34a',  // Safety green
    size: 45,
    description: 'First aid station or medical kit',
    standard: 'ISO 3864'
  },
  'fire-alarm': {
    name: 'Fire Alarm',
    color: '#dc2626',  // Bold red
    size: 40,
    description: 'Fire alarm pull station',
    standard: 'NFPA 170'
  },
  'emergency-telephone': {
    name: 'Emergency Telephone',
    color: '#06b6d4',  // Information blue
    size: 45,
    description: 'Emergency telephone location',
    standard: 'OSHA'
  },
  'aed-defibrillator': {
    name: 'AED/Defibrillator',
    color: '#06b6d4',  // Information blue
    size: 50,
    description: 'Automated external defibrillator',
    standard: 'OSHA'
  },
  'stairwell': {
    name: 'Stairwell',
    color: '#000000',  // Black outline
    size: 45,
    description: 'Staircase location',
    standard: 'NFPA 170'
  },
  'elevator': {
    name: 'Elevator',
    color: '#000000',  // Black outline
    size: 45,
    description: 'Elevator location',
    standard: 'NFPA 170'
  },
  'restroom': {
    name: 'Restroom',
    color: '#000000',  // Black outline
    size: 40,
    description: 'Restroom location',
    standard: 'NFPA 170'
  },
  'you-are-here': {
    name: 'You Are Here',
    color: '#dc2626',  // Bold red
    size: 45,
    description: 'Current location marker',
    standard: 'NFPA 170'
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

    // Draw the appropriate symbol based on type
    drawEmergencySymbol(ctx, this.type, icon);

    // Draw selection indicator - simple circle outline
    if (this.selected) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, icon.size / 2 + 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw label if exists
    if (this.label) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.font = 'bold 10px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const textY = icon.size / 2 + 12;
      ctx.strokeText(this.label, 0, textY);
      ctx.fillText(this.label, 0, textY);
    }

    ctx.restore();
  }

  getBounds() {
    const icon = this.getIcon();
    const r = icon.size / 2 + 12;
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
    return dist < (icon.size / 2 + 12);
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
    this.type = type;
    this.points = points;
    this.selected = false;
  }

  draw(ctx) {
    if (this.points.length < 2) return;

    const icon = ICONS[this.type];
    if (!icon) return;

    // Draw thick, bold route line
    ctx.strokeStyle = icon.color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);

    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }

    ctx.stroke();

    // Draw directional arrows at regular intervals
    const spacing = 80;

    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      const segmentDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

      let segmentProgress = 0;
      while (segmentProgress < segmentDist) {
        const ratio = segmentProgress / segmentDist;
        const arrowX = p1.x + (p2.x - p1.x) * ratio;
        const arrowY = p1.y + (p2.y - p1.y) * ratio;
        drawBoldArrow(ctx, p1.x, p1.y, p2.x, p2.y, arrowX, arrowY, icon.color);
        segmentProgress += spacing;
      }
    }

    // Draw selection highlight
    if (this.selected) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 7;
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

// Symbol drawing functions - professional NFPA 170 style
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
      drawFirstAidSign(ctx, color, size);
      break;
    case 'fire-alarm':
      drawFireAlarmSign(ctx, color, size);
      break;
    case 'emergency-telephone':
      drawTelephoneSign(ctx, color, size);
      break;
    case 'aed-defibrillator':
      drawAEDSign(ctx, color, size);
      break;
    case 'stairwell':
      drawStairwellSign(ctx, color, size);
      break;
    case 'elevator':
      drawElevatorSign(ctx, color, size);
      break;
    case 'restroom':
      drawRestroomSign(ctx, color, size);
      break;
    case 'you-are-here':
      drawYouAreHereSign(ctx, color, size);
      break;
    default:
      drawPlaceholder(ctx, color, size);
  }
}

function drawExitSign(ctx, color, size) {
  const r = size / 2;

  // Green background rectangle
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.8, -r * 0.5, size * 0.8, size * 0.5);

  // White border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-r * 0.8, -r * 0.5, size * 0.8, size * 0.5);

  // White "EXIT" text
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.35}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', -r * 0.3, -r * 0.15);

  // White running figure
  ctx.fillStyle = '#ffffff';
  // Head
  ctx.beginPath();
  ctx.arc(r * 0.2, -r * 0.2, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillRect(r * 0.15, -r * 0.05, r * 0.1, r * 0.2);
  // Legs
  ctx.fillRect(r * 0.16, r * 0.15, r * 0.04, r * 0.15);
  ctx.fillRect(r * 0.22, r * 0.15, r * 0.04, r * 0.15);
}

function drawAssemblyPoint(ctx, color, size) {
  const r = size / 2;

  // Yellow triangle with bold border
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.85);
  ctx.lineTo(r * 0.85, r * 0.7);
  ctx.lineTo(-r * 0.85, r * 0.7);
  ctx.closePath();
  ctx.fill();

  // Bold black border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Simple figures inside (stick figures)
  ctx.fillStyle = '#000000';

  // Left figure
  ctx.beginPath();
  ctx.arc(-r * 0.35, -r * 0.1, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-r * 0.4, r * 0.05, r * 0.1, r * 0.35);

  // Right figure
  ctx.beginPath();
  ctx.arc(r * 0.35, -r * 0.1, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(r * 0.3, r * 0.05, r * 0.1, r * 0.35);
}

function drawFireExtinguisher(ctx, color, size) {
  const r = size / 2;

  // Red square background
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.65, -r * 0.65, size * 0.65, size * 0.65);

  // White border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(-r * 0.65, -r * 0.65, size * 0.65, size * 0.65);

  // White fire extinguisher outline
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.fillStyle = 'transparent';

  // Tank body
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r * 0.25, -r * 0.3, r * 0.5, r * 0.45);

  // Nozzle
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.3);
  ctx.lineTo(r * 0.1, -r * 0.4);
  ctx.lineTo(r * 0.2, -r * 0.2);
  ctx.lineTo(-r * 0.15, -r * 0.2);
  ctx.closePath();
  ctx.fill();

  // Handle
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.3);
  ctx.quadraticCurveTo(-r * 0.4, -r * 0.5, r * 0.15, -r * 0.3);
  ctx.stroke();
}

function drawFirstAidSign(ctx, color, size) {
  const r = size / 2;

  // Green square
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.65, -r * 0.65, size * 0.65, size * 0.65);

  // White border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(-r * 0.65, -r * 0.65, size * 0.65, size * 0.65);

  // White cross
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r * 0.12, -r * 0.4, r * 0.24, r * 0.8);
  ctx.fillRect(-r * 0.4, -r * 0.12, r * 0.8, r * 0.24);
}

function drawFireAlarmSign(ctx, color, size) {
  const r = size / 2;

  // Red circle background
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
  ctx.fill();

  // White border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // White bell symbol inside
  ctx.fillStyle = '#ffffff';
  // Bell dome
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.15, r * 0.3, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bell handle
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -r * 0.45, r * 0.15, Math.PI * 0.4, Math.PI * 1.6);
  ctx.stroke();

  // Clapper
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r * 0.05, r * 0.05, r * 0.1, r * 0.25);
}

function drawTelephoneSign(ctx, color, size) {
  const r = size / 2;

  // Blue circle background
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
  ctx.fill();

  // White border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // White telephone symbol
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;

  // Phone handset
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, -r * 0.15);
  ctx.lineTo(r * 0.25, -r * 0.15);
  ctx.arc(r * 0.25, -r * 0.05, r * 0.1, Math.PI, 0);
  ctx.lineTo(r * 0.25, r * 0.05);
  ctx.lineTo(-r * 0.25, r * 0.05);
  ctx.arc(-r * 0.25, -r * 0.05, r * 0.1, 0, Math.PI);
  ctx.closePath();
  ctx.fill();

  // Phone receiver buttons
  ctx.beginPath();
  ctx.arc(-r * 0.1, r * 0.2, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.1, r * 0.2, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawAEDSign(ctx, color, size) {
  const r = size / 2;

  // Blue background
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
  ctx.fill();

  // White border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // White AED device
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r * 0.35, -r * 0.35, r * 0.7, r * 0.5);

  // Defibrillator pads (red)
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-r * 0.25, -r * 0.2, r * 0.2, r * 0.2);
  ctx.fillRect(r * 0.05, -r * 0.2, r * 0.2, r * 0.2);

  // "AED" text
  ctx.fillStyle = '#06b6d4';
  ctx.font = `bold ${r * 0.25}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AED', 0, r * 0.1);
}

function drawStairwellSign(ctx, color, size) {
  const r = size / 2;

  // White rectangle with black border
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r * 0.65, -r * 0.65, size * 0.65, size * 0.65);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(-r * 0.65, -r * 0.65, size * 0.65, size * 0.65);

  // Simple staircase symbol
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.fillStyle = color;

  // Draw staircase steps
  const stepSize = r * 0.2;
  for (let i = 0; i < 3; i++) {
    const x = -r * 0.4 + i * stepSize;
    const y = -r * 0.2 + i * stepSize;
    ctx.strokeRect(x, y, stepSize, stepSize);
  }
}

function drawElevatorSign(ctx, color, size) {
  const r = size / 2;

  // White rectangle with black border
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r * 0.65, -r * 0.65, size * 0.65, size * 0.65);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(-r * 0.65, -r * 0.65, size * 0.65, size * 0.65);

  // Elevator symbol (box with arrows)
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.25, -r * 0.2, r * 0.5, r * 0.4);

  // Up arrow
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.15);
  ctx.lineTo(-r * 0.1, r * 0.05);
  ctx.lineTo(r * 0.1, r * 0.05);
  ctx.closePath();
  ctx.fill();

  // Down arrow
  ctx.beginPath();
  ctx.moveTo(0, r * 0.15);
  ctx.lineTo(-r * 0.1, -r * 0.05);
  ctx.lineTo(r * 0.1, -r * 0.05);
  ctx.closePath();
  ctx.fill();
}

function drawRestroomSign(ctx, color, size) {
  const r = size / 2;

  // White rectangle with black border
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r * 0.65, -r * 0.65, size * 0.65, size * 0.65);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(-r * 0.65, -r * 0.65, size * 0.65, size * 0.65);

  // Male figure (left)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-r * 0.25, -r * 0.2, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-r * 0.3, -r * 0.05, r * 0.1, r * 0.3);
  ctx.fillRect(-r * 0.35, 0, r * 0.2, r * 0.15);

  // Female figure (right)
  ctx.beginPath();
  ctx.arc(r * 0.25, -r * 0.2, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.25, -r * 0.05, r * 0.15, 0, Math.PI);
  ctx.fill();
  ctx.fillRect(r * 0.2, r * 0.05, r * 0.1, r * 0.3);
}

function drawYouAreHereSign(ctx, color, size) {
  const r = size / 2;

  // Red circle background
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
  ctx.fill();

  // White border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // White center dot
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // You are here text indicator
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${r * 0.2}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✓', 0, r * 0.05);
}

function drawPlaceholder(ctx, color, size) {
  const r = size / 2;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, 0);
}

function drawBoldArrow(ctx, p1x, p1y, p2x, p2y, arrowX, arrowY, color) {
  const headlen = 16;
  const angle = Math.atan2(p2y - p1y, p2x - p1x);

  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(arrowX, arrowY);
  ctx.rotate(angle);

  // Bold arrowhead
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-headlen, -headlen * 0.7);
  ctx.lineTo(-headlen * 0.5, 0);
  ctx.lineTo(-headlen, headlen * 0.7);
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
