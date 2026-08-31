// Overlay management - handles icons, routes, and annotations

import { IconElement, RouteElement, ICONS, getIconImage } from './icon-library.js';
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
    this.isDragging = false;
    this.isResizing = false;
    this.planInfo = null; // { title, address, floor, footer1, footer2, show }
    this.history = new History();

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    document.addEventListener('keydown', (e) => {
      if (this.drawingRoute) {
        if (e.key === 'Escape') {
          // Cancel the in-progress route and leave drawing mode
          this.finishRoute(false);
          this.exitToSelect();
        } else if (e.key === 'Enter') {
          // Commit the route and leave drawing mode
          e.preventDefault();
          this.finishRoute(true);
          this.exitToSelect();
        }
      }
    });
  }

  // Close out the in-progress route. commit=true keeps it, false discards it.
  finishRoute(commit) {
    if (!this.drawingRoute) return;

    const pts = this.drawingRoute.points;
    pts.pop(); // remove the live preview point
    // Drop trailing near-duplicate points (e.g. from a double-click)
    while (pts.length > 1) {
      const a = pts[pts.length - 1];
      const b = pts[pts.length - 2];
      if (Math.hypot(a.x - b.x, a.y - b.y) < 4) {
        pts.pop();
      } else {
        break;
      }
    }

    if (commit && pts.length >= 2) {
      this.routes.push(this.drawingRoute);
    }
    this.drawingRoute = null;
    this.render();
  }

  exitToSelect() {
    this.currentTool = 'select';
    this.dispatchToolChange('select');
  }

  onHandle(pos) {
    if (!(this.selectedElement instanceof IconElement)) return false;
    const h = this.selectedElement.getHandleRect();
    return pos.x >= h.x && pos.x <= h.x + h.w && pos.y >= h.y && pos.y <= h.y + h.h;
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
    this.lastMousePos = pos;

    if (this.currentTool === 'select') {
      // Resize handle on the selected icon takes priority
      if (this.onHandle(pos)) {
        this.isResizing = true;
        return;
      }

      // Topmost icon first (last drawn = last in array)
      for (let i = this.icons.length - 1; i >= 0; i--) {
        if (this.icons[i].contains(pos.x, pos.y)) {
          this.selectElement(this.icons[i]);
          this.isDragging = true;
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
      // Place ONE icon, select it, and switch straight back to select mode.
      // Dragging continues from this same press, so place-and-position is
      // a single gesture.
      const icon = this.addIcon(this.currentIconType, pos.x, pos.y);
      this.selectElement(icon);
      this.currentTool = 'select';
      this.isDragging = true;
      this.dispatchToolChange('select');
    }
  }

  onMouseMove(e) {
    const pos = this.getMousePos(e);

    if (this.drawingLine) {
      this.drawingLine.end = pos;
      this.render();
    } else if (this.drawingRoute && this.currentTool === 'draw-arrow') {
      if (this.drawingRoute.points.length > 0) {
        this.drawingRoute.points[this.drawingRoute.points.length - 1] = pos;
      }
      this.render();
    } else if (this.isResizing && this.selectedElement instanceof IconElement) {
      // Scale so the handle tracks the cursor
      const el = this.selectedElement;
      const half = Math.max(Math.abs(pos.x - el.x), Math.abs(pos.y - el.y)) - 6;
      const newScale = (half * 2) / el.getIcon().size;
      el.scale = Math.min(3, Math.max(0.4, newScale));
      this.render();
      this.dispatchSelection(el);
    } else if (this.isDragging && this.selectedElement instanceof IconElement) {
      // Move only while the mouse button is held
      const dx = pos.x - this.lastMousePos.x;
      const dy = pos.y - this.lastMousePos.y;
      this.selectedElement.x += dx;
      this.selectedElement.y += dy;
      this.render();
    } else {
      this.updateCursor(pos);
    }

    this.lastMousePos = pos;
  }

  onMouseUp(e) {
    this.isDragging = false;
    this.isResizing = false;

    if (this.drawingLine) {
      this.drawingLine = null;
      this.render();
    }
  }

  onWheel(e) {
    // Scroll over the selected icon to resize it
    const pos = this.getMousePos(e);
    if (
      this.selectedElement instanceof IconElement &&
      (this.selectedElement.contains(pos.x, pos.y) || this.onHandle(pos))
    ) {
      e.preventDefault();
      const el = this.selectedElement;
      el.scale = Math.min(3, Math.max(0.4, el.scale * (e.deltaY < 0 ? 1.1 : 0.9)));
      this.render();
      this.dispatchSelection(el);
    }
  }

  updateCursor(pos) {
    let cursor = 'default';
    if (this.currentTool === 'add-icon' || this.currentTool === 'draw-arrow' || this.currentTool === 'draw-line') {
      cursor = 'crosshair';
    } else if (this.onHandle(pos)) {
      cursor = 'nwse-resize';
    } else if (this.currentTool === 'select') {
      for (let i = this.icons.length - 1; i >= 0; i--) {
        if (this.icons[i].contains(pos.x, pos.y)) {
          cursor = 'move';
          break;
        }
      }
    }
    this.canvas.style.cursor = cursor;
  }

  onDoubleClick(e) {
    if (this.currentTool === 'draw-arrow' && this.drawingRoute) {
      // Finish the route AND leave drawing mode — the next click selects,
      // it does not start another route
      this.finishRoute(true);
      this.exitToSelect();
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
    // Changing tools always closes out an in-progress route: what you drew
    // is kept (if it has at least two points), and drawing mode ends
    if (this.drawingRoute) {
      this.finishRoute(true);
    }
    this.drawingLine = null;
    this.isDragging = false;
    this.isResizing = false;

    this.currentTool = tool;
    this.render();
  }

  setIconTool(iconType) {
    if (this.drawingRoute) {
      this.finishRoute(true);
    }
    this.drawingLine = null;
    this.isDragging = false;
    this.isResizing = false;

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

    this.drawPlanFrame();
  }

  // Title block, auto-updating legend, and instruction footer — the parts
  // that make this read as a real evacuation plan. Drawn on the overlay so
  // they update live and are included in exports automatically.
  drawPlanFrame() {
    const info = this.planInfo;
    if (!info || !info.show) return;
    if (!this.imageProcessor.currentImage) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();

    // --- Title block, top center ---
    const title = (info.title || '').trim();
    const subtitle = [info.address, info.floor]
      .map(s => (s || '').trim())
      .filter(Boolean)
      .join('  •  ');

    if (title || subtitle) {
      ctx.font = 'bold 20px Arial, sans-serif';
      const titleW = title ? ctx.measureText(title).width : 0;
      ctx.font = '13px Arial, sans-serif';
      const subW = subtitle ? ctx.measureText(subtitle).width : 0;

      const boxW = Math.min(w - 24, Math.max(titleW, subW) + 48);
      const boxH = 16 + (title ? 26 : 0) + (subtitle ? 20 : 0);
      const bx = (w - boxW) / 2;
      const by = 10;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeRect(bx, by, boxW, boxH);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let ty = by + 8;
      if (title) {
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.fillText(title, w / 2, ty + 13, boxW - 20);
        ty += 26;
      }
      if (subtitle) {
        ctx.fillStyle = '#444444';
        ctx.font = '13px Arial, sans-serif';
        ctx.fillText(subtitle, w / 2, ty + 10, boxW - 20);
      }
    }

    // --- Legend, bottom left: automatically lists every symbol in use ---
    const used = new Map();
    for (const rt of this.routes) {
      if (ICONS[rt.type]) used.set(rt.type, ICONS[rt.type]);
    }
    for (const ic of this.icons) {
      if (ICONS[ic.type]) used.set(ic.type, ICONS[ic.type]);
    }

    if (used.size > 0) {
      const rowH = 26;
      const pad = 12;
      const titleH = 24;
      const boxW = 200;
      const boxH = titleH + used.size * rowH + pad - 4;
      const x = 12;
      const y = h - boxH - 12;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, boxW, boxH);
      ctx.strokeRect(x, y, boxW, boxH);

      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 12px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('LEGEND', x + pad, y + titleH / 2 + 3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + pad, y + titleH - 2);
      ctx.lineTo(x + boxW - pad, y + titleH - 2);
      ctx.stroke();

      let rowY = y + titleH + rowH / 2 - 2;
      for (const [type, icon] of used) {
        if (icon.isRoute) {
          ctx.strokeStyle = icon.color;
          ctx.lineWidth = 3;
          ctx.setLineDash(icon.dash && icon.dash.length ? [7, 5] : []);
          ctx.beginPath();
          ctx.moveTo(x + pad, rowY);
          ctx.lineTo(x + pad + 20, rowY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = icon.color;
          ctx.beginPath();
          ctx.moveTo(x + pad + 28, rowY);
          ctx.lineTo(x + pad + 19, rowY - 5);
          ctx.lineTo(x + pad + 19, rowY + 5);
          ctx.closePath();
          ctx.fill();
        } else {
          const img = getIconImage(type);
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, x + pad + 3, rowY - 10, 20, 20);
          }
        }

        ctx.fillStyle = '#1a1a1a';
        ctx.font = '11px Arial, sans-serif';
        ctx.fillText(icon.name.toUpperCase(), x + pad + 36, rowY, boxW - pad * 2 - 36);
        rowY += rowH;
      }
    }

    // --- Instruction footer, bottom center ---
    const f1 = (info.footer1 || '').trim();
    const f2 = (info.footer2 || '').trim();

    if (f1 || f2) {
      ctx.font = 'bold 14px Arial, sans-serif';
      const f1W = f1 ? ctx.measureText(f1).width : 0;
      ctx.font = 'bold 13px Arial, sans-serif';
      const f2W = f2 ? ctx.measureText(f2).width : 0;

      const boxW = Math.min(w - 24, Math.max(f1W, f2W) + 40);
      const boxH = 12 + (f1 ? 20 : 0) + (f2 ? 19 : 0);
      // Keep clear of the legend in the bottom-left corner
      const bx = Math.max((w - boxW) / 2, 224);
      const by = h - boxH - 12;

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeRect(bx, by, boxW, boxH);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let fy = by + 6;
      const cx = bx + boxW / 2;
      if (f1) {
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.fillText(f1, cx, fy + 10, boxW - 16);
        fy += 20;
      }
      if (f2) {
        ctx.fillStyle = '#c8102e';
        ctx.font = 'bold 13px Arial, sans-serif';
        ctx.fillText(f2, cx, fy + 9, boxW - 16);
      }
    }

    ctx.restore();
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

  dispatchToolChange(tool) {
    const event = new CustomEvent('tool-changed', { detail: tool });
    window.dispatchEvent(event);
  }
}
