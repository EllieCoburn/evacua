import * as Shapes from './shapes.js';

export class ToolManager {
  constructor(state) {
    this.state = state;
    this.tools = {};
    this.current = null;
  }
  
  init() {
    // Register all tools
    this.tools.select = new SelectTool(this.state);
    this.tools.rect = new RectTool(this.state);
    this.tools.circle = new CircleTool(this.state);
    this.tools.line = new LineTool(this.state);
    this.tools.door = new DoorTool(this.state);
    this.tools.text = new TextTool(this.state);
    this.tools.person = new PersonTool(this.state);
    this.tools.assembly = new AssemblyTool(this.state);
    this.tools.hazard = new HazardTool(this.state);
    this.tools.escape = new EscapeRouteTool(this.state);
    
    this.selectTool('select');
    this.renderToolbar();
  }
  
  selectTool(name) {
    if (this.current?.onDeactivate) {
      this.current.onDeactivate();
    }
    
    this.current = this.tools[name];
    this.state.mode = name;
    
    if (this.current?.onActivate) {
      this.current.onActivate();
    }
    
    this.renderToolbar();
    this.state.ui.updateLeftPanel();
  }
  
  renderToolbar() {
    const rail = document.getElementById('rail');
    rail.innerHTML = '';
    
    const toolDefs = [
      { id: 'select', label: 'Select', icon: 'select' },
      { id: 'rect', label: 'Room', icon: 'rect' },
      { id: 'circle', label: 'Column', icon: 'circle' },
      { id: 'line', label: 'Wall', icon: 'line' },
      { id: 'door', label: 'Door', icon: 'door' },
      { id: 'escape', label: 'Escape', icon: 'escape' },
      { id: 'text', label: 'Text', icon: 'text' },
      { id: 'person', label: 'Person', icon: 'person' },
      { id: 'assembly', label: 'Assembly', icon: 'assembly' },
      { id: 'hazard', label: 'Hazard', icon: 'hazard' },
    ];
    
    toolDefs.forEach(def => {
      const btn = document.createElement('button');
      btn.title = def.label;
      btn.dataset.tool = def.id;
      if (def.id === this.state.mode) {
        btn.classList.add('is-active');
      }
      
      const i = document.createElement('i');
      i.dataset.ico = def.icon;
      btn.appendChild(i);
      
      const span = document.createElement('span');
      span.textContent = def.label;
      btn.appendChild(span);
      
      btn.addEventListener('click', () => this.selectTool(def.id));
      rail.appendChild(btn);
    });
  }
}

// Base tool class
class Tool {
  constructor(state) {
    this.state = state;
  }
  
  onActivate() {}
  onDeactivate() {}
  onMouseDown(x, y, e) {}
  onMouseMove(x, y, e) {}
  onMouseUp(x, y, e) {}
  onMouseLeave(e) {}
  draw(ctx) {}
}

// Select tool
class SelectTool extends Tool {
  constructor(state) {
    super(state);
    this.dragStart = null;
    this.selectionBox = null;
  }
  
  onMouseDown(x, y, e) {
    const plan = this.state.plans.current;
    if (!plan) return;
    
    // Check if clicking on an object
    for (let i = plan.objects.length - 1; i >= 0; i--) {
      if (plan.objects[i].contains(x, y)) {
        this.state.canvas.select(plan.objects[i]);
        this.dragStart = { x, y, obj: plan.objects[i] };
        return;
      }
    }
    
    // Deselect
    this.state.canvas.deselect();
    this.dragStart = { x, y };
    this.selectionBox = { x1: x, y1: y, x2: x, y2: y };
  }
  
  onMouseMove(x, y, e) {
    if (this.dragStart) {
      if (this.dragStart.obj) {
        // Moving object
        const dx = x - this.dragStart.x;
        const dy = y - this.dragStart.y;
        
        this.dragStart.obj.x += dx;
        this.dragStart.obj.y += dy;
        
        if (this.dragStart.obj.x2 !== undefined) {
          this.dragStart.obj.x2 += dx;
          this.dragStart.obj.y2 += dy;
        }
        
        this.dragStart.x = x;
        this.dragStart.y = y;
      } else {
        // Selection box
        this.selectionBox.x2 = x;
        this.selectionBox.y2 = y;
      }
      
      this.state.canvas.render();
    }
  }
  
  onMouseUp(x, y, e) {
    this.dragStart = null;
    this.state.canvas.render();
  }
}

// Rectangle tool
class RectTool extends Tool {
  constructor(state) {
    super(state);
    this.drawing = null;
  }
  
  onMouseDown(x, y, e) {
    this.drawing = { x, y };
  }
  
  onMouseMove(x, y, e) {
    if (this.drawing) {
      this.state.canvas.render();
    }
  }
  
  onMouseUp(x, y, e) {
    if (!this.drawing) return;
    
    const w = Math.abs(x - this.drawing.x);
    const h = Math.abs(y - this.drawing.y);
    
    if (w > 10 && h > 10) {
      const rect = new Shapes.Rect(
        Math.min(this.drawing.x, x),
        Math.min(this.drawing.y, y),
        w,
        h
      );
      
      this.state.plans.current.objects.push(rect);
      this.state.history.push();
    }
    
    this.drawing = null;
    this.state.canvas.render();
  }
  
  draw(ctx) {
    if (this.drawing) {
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      const w = Math.abs(this.state.canvas.lastX - this.drawing.x);
      const h = Math.abs(this.state.canvas.lastY - this.drawing.y);
      ctx.strokeRect(this.drawing.x, this.drawing.y, w, h);
      ctx.setLineDash([]);
    }
  }
}

// Circle tool
class CircleTool extends Tool {
  constructor(state) {
    super(state);
    this.center = null;
  }
  
  onMouseDown(x, y, e) {
    const circle = new Shapes.Circle(x, y, 15);
    this.state.plans.current.objects.push(circle);
    this.state.history.push();
    this.state.canvas.render();
  }
}

// Line tool
class LineTool extends Tool {
  constructor(state) {
    super(state);
    this.start = null;
  }
  
  onMouseDown(x, y, e) {
    if (!this.start) {
      this.start = { x, y };
    } else {
      const line = new Shapes.Line(this.start.x, this.start.y, x, y);
      this.state.plans.current.objects.push(line);
      this.state.history.push();
      this.start = null;
      this.state.canvas.render();
    }
  }
  
  onMouseMove(x, y, e) {
    if (this.start) {
      this.state.canvas.render();
    }
  }
  
  draw(ctx) {
    if (this.start) {
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(this.start.x, this.start.y);
      ctx.lineTo(this.state.canvas.lastX, this.state.canvas.lastY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

// Door tool
class DoorTool extends Tool {
  constructor(state) {
    super(state);
  }
  
  onMouseDown(x, y, e) {
    const door = new Shapes.Door(x, y);
    this.state.plans.current.objects.push(door);
    this.state.history.push();
    this.state.canvas.select(door);
    this.state.canvas.render();
  }
}

// Text tool
class TextTool extends Tool {
  constructor(state) {
    super(state);
  }
  
  onMouseDown(x, y, e) {
    const text = prompt('Enter text:');
    if (text) {
      const label = new Shapes.TextLabel(x, y, text);
      this.state.plans.current.objects.push(label);
      this.state.history.push();
      this.state.canvas.render();
    }
  }
}

// Person tool
class PersonTool extends Tool {
  constructor(state) {
    super(state);
  }
  
  onMouseDown(x, y, e) {
    const person = new Shapes.Person(x, y);
    this.state.plans.current.objects.push(person);
    this.state.history.push();
    this.state.canvas.render();
  }
}

// Assembly point tool
class AssemblyTool extends Tool {
  constructor(state) {
    super(state);
  }
  
  onMouseDown(x, y, e) {
    const assembly = new Shapes.AssemblyPoint(x, y);
    this.state.plans.current.objects.push(assembly);
    this.state.history.push();
    this.state.canvas.render();
  }
}

// Hazard tool
class HazardTool extends Tool {
  constructor(state) {
    super(state);
  }
  
  onActivate() {
    this.state.ui.updateLeftPanel();
  }
  
  onMouseDown(x, y, e) {
    const hazardType = this.state.currentHazardType || 'fire';
    const hazard = new Shapes.Hazard(x, y, hazardType);
    this.state.plans.current.objects.push(hazard);
    this.state.history.push();
    this.state.canvas.render();
  }
}

// Escape route tool
class EscapeRouteTool extends Tool {
  constructor(state) {
    super(state);
    this.start = null;
  }
  
  onMouseDown(x, y, e) {
    if (!this.start) {
      this.start = { x, y };
    } else {
      const line = new Shapes.Line(this.start.x, this.start.y, x, y);
      line.isEscapeRoute = true;
      this.state.plans.current.objects.push(line);
      this.state.history.push();
      this.start = null;
      this.state.canvas.render();
    }
  }
  
  onMouseMove(x, y, e) {
    if (this.start) {
      this.state.canvas.render();
    }
  }
  
  draw(ctx) {
    if (this.start) {
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(this.start.x, this.start.y);
      ctx.lineTo(this.state.canvas.lastX, this.state.canvas.lastY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
