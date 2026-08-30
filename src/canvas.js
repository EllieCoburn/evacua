export class Canvas {
  constructor(el, state) {
    this.el = el;
    this.state = state;
    this.ctx = el.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    
    // Canvas dimensions
    this.width = 1200;
    this.height = 900;
    this.offsetX = 0;
    this.offsetY = 0;
    
    // Drawing state
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    
    // Interaction
    this.dragStart = null;
    this.selection = null;
    
    // Grid
    this.gridSize = 20; // 1 foot = 20px at 1x zoom
  }
  
  init() {
    this.resize();
    this.setupHandlers();
    this.render();
  }
  
  resize() {
    const wrap = this.el.parentElement;
    this.el.width = wrap.clientWidth * this.dpr;
    this.el.height = wrap.clientHeight * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    
    this.offsetX = (wrap.clientWidth - this.width) / 2;
    this.offsetY = (wrap.clientHeight - this.height) / 2;
  }
  
  setupHandlers() {
    window.addEventListener('resize', () => {
      this.resize();
      this.render();
    });
    
    this.el.addEventListener('mousedown', e => this.onMouseDown(e));
    this.el.addEventListener('mousemove', e => this.onMouseMove(e));
    this.el.addEventListener('mouseup', e => this.onMouseUp(e));
    this.el.addEventListener('mouseleave', e => this.onMouseLeave(e));
    this.el.addEventListener('wheel', e => this.onWheel(e));
  }
  
  onMouseDown(e) {
    const [x, y] = this.getCanvasCoords(e);
    this.lastX = x;
    this.lastY = y;
    
    const tool = this.state.tools.current;
    if (tool?.onMouseDown) {
      tool.onMouseDown(x, y, e);
    }
  }
  
  onMouseMove(e) {
    const [x, y] = this.getCanvasCoords(e);
    this.lastX = x;
    this.lastY = y;
    
    // Update status bar
    const ft = (x / this.gridSize).toFixed(1);
    const fy = (y / this.gridSize).toFixed(1);
    document.getElementById('status-coord').textContent = `${ft}ft × ${fy}ft`;
    
    const tool = this.state.tools.current;
    if (tool?.onMouseMove) {
      tool.onMouseMove(x, y, e);
    }
  }
  
  onMouseUp(e) {
    const [x, y] = this.getCanvasCoords(e);
    
    const tool = this.state.tools.current;
    if (tool?.onMouseUp) {
      tool.onMouseUp(x, y, e);
    }
  }
  
  onMouseLeave(e) {
    const tool = this.state.tools.current;
    if (tool?.onMouseLeave) {
      tool.onMouseLeave(e);
    }
  }
  
  onWheel(e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 1.1 : 0.9;
    this.zoom(this.state.zoom * delta);
  }
  
  getCanvasCoords(e) {
    const rect = this.el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.dpr;
    const y = (e.clientY - rect.top) / this.dpr;
    
    // Convert to canvas space
    const cx = (x - this.offsetX) / this.state.zoom;
    const cy = (y - this.offsetY) / this.state.zoom;
    
    return [cx, cy];
  }
  
  zoom(z) {
    z = Math.max(0.1, Math.min(4, z));
    this.state.zoom = z;
    
    document.getElementById('zoom-readout').textContent = Math.round(z * 100) + '%';
    this.render();
  }
  
  fitToScreen() {
    const wrap = this.el.parentElement;
    const aw = wrap.clientWidth / this.width;
    const ah = wrap.clientHeight / this.height;
    this.zoom(Math.min(aw, ah) * 0.9);
  }
  
  render() {
    const ctx = this.ctx;
    const zoom = this.state.zoom;
    
    // Clear
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, this.el.width / this.dpr, this.el.height / this.dpr);
    
    // Save context state
    ctx.save();
    
    // Apply zoom and offset
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(zoom, zoom);
    
    // Draw canvas background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw grid
    if (this.state.grid) {
      this.drawGrid();
    }
    
    // Draw all objects
    const plan = this.state.plans.current;
    if (plan?.objects) {
      plan.objects.forEach(obj => {
        this.drawObject(obj, obj === this.state.selected);
      });
    }
    
    // Draw current tool preview if any
    const tool = this.state.tools.current;
    if (tool?.draw) {
      tool.draw(ctx);
    }
    
    ctx.restore();
  }
  
  drawGrid() {
    const ctx = this.ctx;
    const gs = this.gridSize;
    
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 0.5;
    
    // Major grid every 5 feet
    for (let x = 0; x < this.width; x += gs * 5) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    
    for (let y = 0; y < this.height; y += gs * 5) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    
    // Minor grid every foot
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.3;
    
    for (let x = 0; x < this.width; x += gs) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    
    for (let y = 0; y < this.height; y += gs) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
  }
  
  drawObject(obj, selected = false) {
    const ctx = this.ctx;
    
    ctx.save();
    
    if (selected) {
      ctx.globalAlpha = 1;
    }
    
    // Delegate to object's draw method
    if (obj.draw) {
      obj.draw(ctx);
    }
    
    // Draw selection box
    if (selected) {
      const [x1, y1, x2, y2] = obj.getBounds();
      const w = x2 - x1;
      const h = y2 - y1;
      
      ctx.strokeStyle = '#5dade2';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x1, y1, w, h);
      
      // Draw handles
      const handles = [
        [x1, y1], [x1 + w/2, y1], [x2, y1],
        [x1, y1 + h/2], [x2, y1 + h/2],
        [x1, y2], [x1 + w/2, y2], [x2, y2]
      ];
      
      ctx.fillStyle = '#5dade2';
      ctx.globalAlpha = 0.8;
      handles.forEach(([hx, hy]) => {
        ctx.fillRect(hx - 4, hy - 4, 8, 8);
      });
      
      ctx.setLineDash([]);
    }
    
    ctx.restore();
  }
  
  deselect() {
    this.state.selected = null;
    this.state.ui.updatePropertiesPanel();
    this.render();
  }
  
  select(obj) {
    this.state.selected = obj;
    this.state.ui.updatePropertiesPanel();
    document.getElementById('status-sel').textContent = obj.name || obj.type;
    this.render();
  }
  
  async printPDF() {
    // For now, use browser print
    window.print();
  }
  
  async exportPNG() {
    const scale = 2; // 2x for crisp export
    const canvas = document.createElement('canvas');
    canvas.width = this.width * scale;
    canvas.height = this.height * scale;
    
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    
    // Draw white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw grid (light)
    const gs = this.gridSize;
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.3;
    
    for (let x = 0; x < this.width; x += gs) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    
    for (let y = 0; y < this.height; y += gs) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
    
    // Draw objects
    const plan = this.state.plans.current;
    if (plan?.objects) {
      plan.objects.forEach(obj => {
        if (obj.draw) {
          obj.draw(ctx);
        }
      });
    }
    
    // Download
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${plan.name || 'evacuation-plan'}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}
