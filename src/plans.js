// Plan management
export class Plans {
  constructor() {
    this.current = null;
    this.plans = [];
  }
  
  new() {
    this.current = {
      name: 'Untitled Plan',
      location: '',
      description: '',
      createdAt: new Date(),
      objects: [],
    };
    this.plans = [this.current];
    
    window.app.state.history.reset();
    window.app.state.history.push();
    window.app.state.canvas.render();
    this.showToast('New plan created', 'success');
  }
  
  async save() {
    if (!this.current) return;
    
    const data = {
      version: 1,
      name: this.current.name,
      location: this.current.location,
      description: this.current.description,
      createdAt: this.current.createdAt,
      objects: this.current.objects.map(obj => obj.toJSON()),
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.current.name.replace(/\s+/g, '-')}.evac`;
    a.click();
    
    URL.revokeObjectURL(url);
    this.showToast('Plan saved', 'success');
  }
  
  async open(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.version !== 1) {
        throw new Error('Unsupported file format');
      }
      
      this.current = {
        name: data.name || 'Imported Plan',
        location: data.location || '',
        description: data.description || '',
        createdAt: data.createdAt || new Date(),
        objects: this.deserializeObjects(data.objects),
      };
      
      this.plans = [this.current];
      
      window.app.state.history.reset();
      window.app.state.history.push();
      window.app.state.canvas.fitToScreen();
      
      this.showToast('Plan opened', 'success');
    } catch (err) {
      this.showToast(`Error opening file: ${err.message}`, 'error');
    }
  }
  
  deserializeObjects(data) {
    const { Rect, Circle, Line, Door, TextLabel, Person, AssemblyPoint, Hazard } = require('./shapes.js');
    
    return data.map(obj => {
      switch (obj.type) {
        case 'rect':
          const rect = new Rect(obj.x, obj.y, obj.width, obj.height);
          rect.label = obj.label;
          return rect;
        case 'circle':
          const circle = new Circle(obj.x, obj.y, obj.radius);
          circle.label = obj.label;
          return circle;
        case 'line':
          const line = new Line(obj.x, obj.y, obj.x2, obj.y2);
          line.isEscapeRoute = obj.isEscapeRoute;
          return line;
        case 'door':
          const door = new Door(obj.x, obj.y, obj.width, obj.rotation);
          door.isEmergency = obj.isEmergency;
          return door;
        case 'text':
          return new TextLabel(obj.x, obj.y, obj.text);
        case 'person':
          return new Person(obj.x, obj.y);
        case 'assembly':
          return new AssemblyPoint(obj.x, obj.y);
        case 'hazard':
          return new Hazard(obj.x, obj.y, obj.hazardType);
        default:
          return null;
      }
    }).filter(Boolean);
  }
  
  remove(obj) {
    if (!this.current) return;
    
    const idx = this.current.objects.indexOf(obj);
    if (idx >= 0) {
      this.current.objects.splice(idx, 1);
      window.app.state.history.push();
      window.app.state.canvas.render();
      this.showToast('Object deleted', 'info');
    }
  }
  
  showToast(msg, type = 'info') {
    const host = document.getElementById('toast-host');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    host.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slide-in 200ms reverse ease-in';
      setTimeout(() => toast.remove(), 200);
    }, 2000);
  }
}
