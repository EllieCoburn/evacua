// Base shape class
export class Shape {
  constructor(x, y, type = 'shape') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.name = `${type} ${Date.now()}`;
    this.rotation = 0;
    this.fillColor = '#ccc';
    this.strokeColor = '#333';
    this.strokeWidth = 2;
  }
  
  getBounds() {
    return [this.x - 20, this.y - 20, this.x + 20, this.y + 20];
  }
  
  contains(px, py) {
    const [x1, y1, x2, y2] = this.getBounds();
    return px >= x1 && px <= x2 && py >= y1 && py <= y2;
  }
  
  draw(ctx) {
    // Override in subclasses
  }
  
  toJSON() {
    return {
      type: this.type,
      x: this.x,
      y: this.y,
      rotation: this.rotation,
      fillColor: this.fillColor,
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
    };
  }
}

// Rectangle (room, desk, etc.)
export class Rect extends Shape {
  constructor(x, y, width = 100, height = 80) {
    super(x, y, 'rect');
    this.width = width;
    this.height = height;
    this.label = 'Room';
  }
  
  getBounds() {
    return [this.x, this.y, this.x + this.width, this.y + this.height];
  }
  
  contains(px, py) {
    return px >= this.x && px <= this.x + this.width &&
           py >= this.y && py <= this.y + this.height;
  }
  
  draw(ctx) {
    ctx.fillStyle = this.fillColor;
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = this.strokeWidth;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    
    // Draw label
    ctx.fillStyle = '#000';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.label, this.x + this.width/2, this.y + this.height/2);
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      width: this.width,
      height: this.height,
      label: this.label,
    };
  }
}

// Circle (column, pillar)
export class Circle extends Shape {
  constructor(x, y, radius = 15) {
    super(x, y, 'circle');
    this.radius = radius;
    this.label = 'Column';
  }
  
  getBounds() {
    const r = this.radius;
    return [this.x - r, this.y - r, this.x + r, this.y + r];
  }
  
  contains(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    return Math.sqrt(dx*dx + dy*dy) <= this.radius;
  }
  
  draw(ctx) {
    ctx.fillStyle = this.fillColor;
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = this.strokeWidth;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      radius: this.radius,
      label: this.label,
    };
  }
}

// Line (wall, escape route)
export class Line extends Shape {
  constructor(x1, y1, x2, y2) {
    super(x1, y1, 'line');
    this.x2 = x2;
    this.y2 = y2;
    this.isEscapeRoute = false;
  }
  
  getBounds() {
    const minX = Math.min(this.x, this.x2);
    const maxX = Math.max(this.x, this.x2);
    const minY = Math.min(this.y, this.y2);
    const maxY = Math.max(this.y, this.y2);
    return [minX - 5, minY - 5, maxX + 5, maxY + 5];
  }
  
  contains(px, py) {
    const dx = this.x2 - this.x;
    const dy = this.y2 - this.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    
    if (len === 0) return false;
    
    const t = ((px - this.x) * dx + (py - this.y) * dy) / (len * len);
    
    if (t < 0 || t > 1) return false;
    
    const cx = this.x + t * dx;
    const cy = this.y + t * dy;
    
    const dist = Math.sqrt((px - cx)**2 + (py - cy)**2);
    return dist <= 5;
  }
  
  draw(ctx) {
    ctx.strokeStyle = this.isEscapeRoute ? '#e74c3c' : this.strokeColor;
    ctx.lineWidth = this.isEscapeRoute ? 3 : this.strokeWidth;
    
    if (this.isEscapeRoute) {
      ctx.setLineDash([5, 5]);
    }
    
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x2, this.y2);
    ctx.stroke();
    
    ctx.setLineDash([]);
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      x2: this.x2,
      y2: this.y2,
      isEscapeRoute: this.isEscapeRoute,
    };
  }
}

// Door
export class Door extends Shape {
  constructor(x, y, width = 30, rotation = 0) {
    super(x, y, 'door');
    this.width = width;
    this.rotation = rotation;
    this.isEmergency = false;
  }
  
  getBounds() {
    const r = this.width / 2;
    return [this.x - r - 5, this.y - r - 5, this.x + r + 5, this.y + r + 5];
  }
  
  contains(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    return Math.sqrt(dx*dx + dy*dy) <= this.width / 2 + 5;
  }
  
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    // Door arc
    ctx.strokeStyle = this.isEmergency ? '#e74c3c' : '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.width / 2, 0, Math.PI / 2);
    ctx.stroke();
    
    // Door marker
    ctx.fillStyle = this.isEmergency ? '#e74c3c' : '#333';
    ctx.fillRect(-3, this.width / 2 - 5, 6, 10);
    
    ctx.restore();
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      width: this.width,
      isEmergency: this.isEmergency,
    };
  }
}

// Text label
export class TextLabel extends Shape {
  constructor(x, y, text = 'Label') {
    super(x, y, 'text');
    this.text = text;
    this.fontSize = 14;
  }
  
  getBounds() {
    const w = this.text.length * 5;
    return [this.x - w/2, this.y - 10, this.x + w/2, this.y + 10];
  }
  
  contains(px, py) {
    const [x1, y1, x2, y2] = this.getBounds();
    return px >= x1 && px <= x2 && py >= y1 && py <= y2;
  }
  
  draw(ctx) {
    ctx.fillStyle = this.strokeColor;
    ctx.font = `bold ${this.fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, this.x, this.y);
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      text: this.text,
      fontSize: this.fontSize,
    };
  }
}

// Person/Occupant icon
export class Person extends Shape {
  constructor(x, y) {
    super(x, y, 'person');
    this.fillColor = '#3498db';
  }
  
  getBounds() {
    return [this.x - 6, this.y - 8, this.x + 6, this.y + 8];
  }
  
  draw(ctx) {
    ctx.fillStyle = this.fillColor;
    
    // Head
    ctx.beginPath();
    ctx.arc(this.x, this.y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    ctx.fillRect(this.x - 2, this.y - 1, 4, 5);
    
    // Legs
    ctx.fillRect(this.x - 2, this.y + 4, 2, 4);
    ctx.fillRect(this.x, this.y + 4, 2, 4);
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
    };
  }
}

// Assembly point
export class AssemblyPoint extends Shape {
  constructor(x, y) {
    super(x, y, 'assembly');
    this.label = 'Assembly Point';
    this.fillColor = '#f39c12';
  }
  
  getBounds() {
    const s = 15;
    return [this.x - s, this.y - s, this.x + s, this.y + s];
  }
  
  contains(px, py) {
    const s = 15;
    return px >= this.x - s && px <= this.x + s &&
           py >= this.y - s && py <= this.y + s;
  }
  
  draw(ctx) {
    // Star shape for assembly point
    ctx.fillStyle = this.fillColor;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    const starPoints = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? 12 : 6;
      starPoints.push([
        this.x + r * Math.cos(angle),
        this.y + r * Math.sin(angle),
      ]);
    }
    
    ctx.beginPath();
    ctx.moveTo(starPoints[0][0], starPoints[0][1]);
    starPoints.forEach(([px, py]) => ctx.lineTo(px, py));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      label: this.label,
    };
  }
}

// Hazard (fire, chemicals, etc.)
export class Hazard extends Shape {
  constructor(x, y, hazardType = 'fire') {
    super(x, y, 'hazard');
    this.hazardType = hazardType; // 'fire', 'chemical', 'electrical'
  }
  
  getBounds() {
    return [this.x - 10, this.y - 10, this.x + 10, this.y + 10];
  }
  
  draw(ctx) {
    const s = 10;
    
    switch (this.hazardType) {
      case 'fire':
        // Flame
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - s);
        ctx.quadraticCurveTo(this.x - s/2, this.y - s/2, this.x - s/3, this.y + s/2);
        ctx.quadraticCurveTo(this.x, this.y, this.x + s/3, this.y + s/2);
        ctx.quadraticCurveTo(this.x + s/2, this.y - s/2, this.x, this.y - s);
        ctx.fill();
        break;
        
      case 'chemical':
        // Skull symbol
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(this.x, this.y - 3, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(this.x - 3, this.y - 5, 1.5, 0, Math.PI * 2);
        ctx.arc(this.x + 3, this.y - 5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;
        
      case 'electrical':
        // Lightning bolt
        ctx.fillStyle = '#f1c40f';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - s);
        ctx.lineTo(this.x - 3, this.y - 2);
        ctx.lineTo(this.x + 2, this.y);
        ctx.lineTo(this.x - 2, this.y + 4);
        ctx.lineTo(this.x + 3, this.y + s);
        ctx.lineTo(this.x, this.y + 2);
        ctx.lineTo(this.x - 3, this.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
    }
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      hazardType: this.hazardType,
    };
  }
}
