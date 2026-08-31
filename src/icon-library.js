// Emergency icon definitions and rendering

export const ICONS = {
  exit: {
    name: 'Emergency Exit',
    emoji: '🚪',
    color: '#ff6b6b',
    size: 40,
    description: 'Marked emergency exit'
  },
  'primary-route': {
    name: 'Primary Evacuation Route',
    emoji: '→',
    color: '#51cf66',
    size: 30,
    description: 'Recommended evacuation path',
    isRoute: true
  },
  'alt-route': {
    name: 'Alternative Evacuation Route',
    emoji: '⇢',
    color: '#ffd93d',
    size: 30,
    description: 'Alternate escape route',
    isRoute: true
  },
  assembly: {
    name: 'Assembly Point',
    emoji: '📍',
    color: '#a78bfa',
    size: 40,
    description: 'Designated assembly/muster point'
  },
  extinguisher: {
    name: 'Fire Extinguisher',
    emoji: '🧯',
    color: '#ff0000',
    size: 35,
    description: 'Fire extinguisher location'
  },
  'first-aid': {
    name: 'First Aid Kit',
    emoji: '🩹',
    color: '#ff6b6b',
    size: 35,
    description: 'First aid station'
  },
  hazard: {
    name: 'Hazard Zone',
    emoji: '⚠️',
    color: '#ffa500',
    size: 40,
    description: 'Area with hazardous materials/conditions'
  },
  person: {
    name: 'Person/Occupant',
    emoji: '👤',
    color: '#4ecdc4',
    size: 30,
    description: 'Person or occupant location'
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

    // Draw background circle
    ctx.fillStyle = icon.color;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, icon.size / 2 + 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw emoji
    ctx.globalAlpha = 1;
    ctx.font = `${icon.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon.emoji, 0, 0);

    // Draw selection indicator
    if (this.selected) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, icon.size / 2 + 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw label if exists
    if (this.label) {
      ctx.fillStyle = '#000';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(this.label, 0, icon.size / 2 + 20);
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
    this.type = type; // 'primary-route' or 'alt-route'
    this.points = points; // Array of {x, y}
    this.selected = false;
  }

  draw(ctx) {
    if (this.points.length < 2) return;

    const icon = ICONS[this.type];
    ctx.strokeStyle = icon.color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    
    ctx.stroke();

    // Draw arrows along the route
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      drawArrowhead(ctx, p1.x, p1.y, p2.x, p2.y, icon.color);
    }

    // Draw selection highlight
    if (this.selected) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 5;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i < this.points.length; i++) {
        ctx.lineTo(this.points[i].x, this.points[i].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  contains(x, y, threshold = 10) {
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

function drawArrowhead(ctx, fromX, fromY, toX, toY, color) {
  const headlen = 15;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  // Draw arrowhead
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
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
