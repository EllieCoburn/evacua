// Overlay management - handles icons, routes, and annotations

import { IconElement, RouteElement, ICONS } from './icon-library.js';
import { History } from './history.js';

export class Overlay {
  constructor(overlayCanvas, imageProcessor) {
    this.canvas = overlayCanvas;
    this.ctx = overlayCanvas.getContext('2d');
    this.imageProcessor = imageProcessor;
    
    this.icons = [];
    this.routes = [];
    this.labels = [];
    this.lines = [];
    
    this.selectedElement = null;
    this.currentTool = 'select';
    this.currentIconType = null;
    this.drawingRoute = null;
    this.drawingLine = null;
    this.lastMousePos = { x: 0, y: 0 };
    this.history = new History();

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.drawingRoute) {
        this.drawingRoute = null;
        this.render();
      }
    });
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  onMouseDown(e) {
    const pos = this.getMousePos(e);

    if (this.currentTool === 'select') {
      for (const icon of this.icons) {
        if (icon.contains(pos.x, pos.y)) {
          this.selectElement(icon);
          return;
        }
      }

      for (const route of this.routes) {
        if (route.contains(pos.x, pos.y)) {
          this.selectElement(route);
          return;
        }
      }

      this.selectElement(null);
    } else if (this.currentTool === 'draw-line') {
      this.drawingLine = {
        start: pos,
        end: pos
      };
    } else if (this.currentTool === 'draw-arrow') {
      if (!this.drawingRoute) {
        // Start route: first fixed point + a preview point that follows the mouse
        this.drawingRoute = new RouteElement(this.currentIconType, [pos, { x: pos.x, y: pos.y }]);
      } else {
        // Commit the preview point and start a new preview segment
        this.drawingRoute.points.push({ x: pos.x, y: pos.y });
      }
      this.render();
    } else if (this.currentTool === 'add-icon') {
      this.addIcon(this.currentIconType, pos.x, pos.y);
    }

    this.lastMousePos = pos;
  }

  onMouseMove(e) {
    const pos = this.getMousePos(e);

    if (this.drawingLine) {
      this.drawingLine.end = pos;
      this.render();
    } else if (this.drawingRoute) {
      if (this.drawingRoute.points.length > 0) {
        this.drawingRoute.points[this.drawingRoute.points.length - 1] = pos;
      }
      this.render();
    } else if (this.selectedElement && this.currentTool === 'select') {
      const dx = pos.x - this.lastMousePos.x;
      const dy = pos.y - this.lastMousePos.y;
      
      if (this.selectedElement instanceof IconElement) {
        this.selectedElement.x += dx;
        this.selectedElement.y += dy;
        this.render();
      }
    }

    this.lastMousePos = pos;
  }

  onMouseUp(e) {
    if (this.drawingLine) {
      this.drawingLine = null;
      this.render();
    }
  }

  onDoubleClick(e) {
    if (this.currentTool === 'draw-arrow' && this.drawingRoute) {
      // Drop the live preview point, then any duplicates left by the
      // double-click's own mousedown events
      const pts = this.drawingRoute.points;
      pts.pop();
      while (pts.length > 1) {
        const a = pts[pts.length - 1];
        const b = pts[pts.length - 2];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 4) {
          pts.pop();
        } else {
          break;
        }
      }

      if (pts.length >= 2) {
        this.routes.push(this.drawingRoute);
      }
      this.drawingRoute = null;
      this.render();
    }
  }

  addIcon(type, x, y) {
    const icon = new IconElement(type, x, y);
    this.icons.push(icon);
    this.history.push({ action: 'add-icon', element: icon });
    this.render();
    return icon;
  }

  removeElement(element) {
    if (element instanceof IconElement) {
      const idx = this.icons.indexOf(element);
      if (idx !== -1) {
        this.icons.splice(idx, 1);
        this.history.push({ action: 'remove-icon', element });
      }
    } else if (element instanceof RouteElement) {
      const idx = this.routes.indexOf(element);
      if (idx !== -1) {
        this.routes.splice(idx, 1);
        this.history.push({ action: 'remove-route', element });
      }
    }
    this.render();
  }

  selectElement(element) {
    if (this.selectedElement) {
      this.selectedElement.selected = false;
    }
    
    this.selectedElement = element;
    if (element) {
      element.selected = true;
    }

    this.render();
    this.dispatchSelection(element);
  }

  setTool(tool) {
    this.currentTool = tool;
    
    if (tool !== 'draw-arrow') {
      this.drawingRoute = null;
    }
    if (tool !== 'draw-line') {
      this.drawingLine = null;
    }

    this.render();
  }

  setIconTool(iconType) {
    this.currentIconType = iconType;
    this.currentTool = 'add-icon';
  }

  render() {
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.clearRect(0, 0, width, height);

    for (const route of this.routes) {
      route.draw(this.ctx);
    }

    if (this.drawingLine) {
      this.ctx.strokeStyle = '#999';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.beginPath();
      this.ctx.moveTo(this.drawingLine.start.x, this.drawingLine.start.y);
      this.ctx.lineTo(this.drawingLine.end.x, this.drawingLine.end.y);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    for (const icon of this.icons) {
      icon.draw(this.ctx);
    }

    if (this.drawingRoute) {
      this.drawingRoute.draw(this.ctx);
    }
  }

  undo() {
    // TODO: implement undo
  }

  redo() {
    // TODO: implement redo
  }

  export() {
    return {
      icons: this.icons.map(i => i.toJSON()),
      routes: this.routes.map(r => r.toJSON())
    };
  }

  import(data) {
    this.icons = data.icons.map(i => IconElement.fromJSON(i));
    this.routes = data.routes.map(r => RouteElement.fromJSON(r));
    this.render();
  }

  dispatchSelection(element) {
    const event = new CustomEvent('element-selected', { detail: element });
    window.dispatchEvent(event);
  }
}
