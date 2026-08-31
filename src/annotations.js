// Drawing-tool elements: wall lines, annotation arrows, and text labels.
// All are selectable, movable, and deletable like icons.

function distanceToSegment(px, py, x1, y1, x2, y2) {
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

  return Math.hypot(px - xx, py - yy);
}

export class LineElement {
  constructor(x1, y1, x2, y2, id = null) {
    this.id = id || Math.random().toString(36).substr(2, 9);
    this.kind = 'line';
    this.typeName = 'Wall Line';
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.selected = false;
  }

  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(this.x2, this.y2);
    ctx.stroke();

    if (this.selected) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 8;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(this.x1, this.y1);
      ctx.lineTo(this.x2, this.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  contains(x, y) {
    return distanceToSegment(x, y, this.x1, this.y1, this.x2, this.y2) < 10;
  }

  moveBy(dx, dy) {
    this.x1 += dx; this.y1 += dy;
    this.x2 += dx; this.y2 += dy;
  }

  toJSON() {
    return { id: this.id, kind: this.kind, x1: this.x1, y1: this.y1, x2: this.x2, y2: this.y2 };
  }

  static fromJSON(d) {
    return new LineElement(d.x1, d.y1, d.x2, d.y2, d.id);
  }
}

export class ArrowElement {
  constructor(x1, y1, x2, y2, id = null) {
    this.id = id || Math.random().toString(36).substr(2, 9);
    this.kind = 'arrow';
    this.typeName = 'Arrow';
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.selected = false;
  }

  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = '#1a1a1a';
    ctx.fillStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    const angle = Math.atan2(this.y2 - this.y1, this.x2 - this.x1);
    const head = 14;

    // Shaft stops short of the tip so the arrowhead stays sharp
    const shaftX = this.x2 - Math.cos(angle) * head * 0.6;
    const shaftY = this.y2 - Math.sin(angle) * head * 0.6;
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(shaftX, shaftY);
    ctx.stroke();

    ctx.translate(this.x2, this.y2);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-head, -head * 0.55);
    ctx.lineTo(-head, head * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (this.selected) {
      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 8;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(this.x1, this.y1);
      ctx.lineTo(this.x2, this.y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  contains(x, y) {
    return distanceToSegment(x, y, this.x1, this.y1, this.x2, this.y2) < 10;
  }

  moveBy(dx, dy) {
    this.x1 += dx; this.y1 += dy;
    this.x2 += dx; this.y2 += dy;
  }

  toJSON() {
    return { id: this.id, kind: this.kind, x1: this.x1, y1: this.y1, x2: this.x2, y2: this.y2 };
  }

  static fromJSON(d) {
    return new ArrowElement(d.x1, d.y1, d.x2, d.y2, d.id);
  }
}

export class TextElement {
  constructor(x, y, text, id = null) {
    this.id = id || Math.random().toString(36).substr(2, 9);
    this.kind = 'text';
    this.typeName = 'Text Label';
    this.x = x;
    this.y = y;
    this.text = text || 'Label';
    this.fontSize = 16;
    this.selected = false;
  }

  draw(ctx) {
    ctx.save();
    ctx.font = `bold ${this.fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, this.fontSize / 5);
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#1a1a1a';
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);

    if (this.selected) {
      const b = this.getBounds(ctx);
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(b.x, b.y, b.width, b.height);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  getBounds(ctx) {
    ctx.font = `bold ${this.fontSize}px Arial, sans-serif`;
    const w = ctx.measureText(this.text).width;
    const h = this.fontSize * 1.3;
    return { x: this.x - w / 2 - 6, y: this.y - h / 2 - 4, width: w + 12, height: h + 8 };
  }

  contains(x, y) {
    // Approximate bounds without a context: character width heuristic
    const w = this.text.length * this.fontSize * 0.62 + 12;
    const h = this.fontSize * 1.3 + 8;
    return Math.abs(x - this.x) < w / 2 && Math.abs(y - this.y) < h / 2;
  }

  moveBy(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  toJSON() {
    return { id: this.id, kind: this.kind, x: this.x, y: this.y, text: this.text, fontSize: this.fontSize };
  }

  static fromJSON(d) {
    const t = new TextElement(d.x, d.y, d.text, d.id);
    t.fontSize = d.fontSize || 16;
    return t;
  }
}

export function annotationFromJSON(d) {
  if (d.kind === 'line') return LineElement.fromJSON(d);
  if (d.kind === 'arrow') return ArrowElement.fromJSON(d);
  if (d.kind === 'text') return TextElement.fromJSON(d);
  return null;
}
