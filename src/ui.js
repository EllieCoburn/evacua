// UI Manager
export class UI {
  constructor(state) {
    this.state = state;
    this.currentTab = 'props';
  }
  
  init() {
    this.setupPanelTabs();
  }
  
  setupPanelTabs() {
    const tabs = document.querySelectorAll('.ptab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        this.currentTab = tab.dataset.tab;
        this.updateRightPanel();
      });
    });
    
    this.updateRightPanel();
  }
  
  updateLeftPanel() {
    const body = document.getElementById('left-panel-body');
    const title = document.getElementById('left-panel-title');
    
    body.innerHTML = '';
    
    const mode = this.state.mode;
    
    if (mode === 'hazard') {
      title.textContent = 'Hazard Type';
      
      const types = [
        { id: 'fire', label: 'Fire' },
        { id: 'chemical', label: 'Chemical' },
        { id: 'electrical', label: 'Electrical' },
      ];
      
      types.forEach(type => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.width = '100%';
        btn.style.marginBottom = '8px';
        btn.textContent = type.label;
        btn.addEventListener('click', () => {
          this.state.currentHazardType = type.id;
          btn.style.background = '#e74c3c';
          btn.style.color = 'white';
        });
        body.appendChild(btn);
      });
    } else if (mode === 'select') {
      title.textContent = 'Symbols';
      body.textContent = 'Select an object to edit its properties.';
    } else {
      title.textContent = 'Tool Options';
      body.textContent = 'Click on the canvas to draw.';
    }
  }
  
  updateRightPanel() {
    const body = document.getElementById('right-panel-body');
    body.innerHTML = '';
    
    if (this.currentTab === 'props') {
      this.showPropertiesPanel(body);
    } else if (this.currentTab === 'plan') {
      this.showPlanInfoPanel(body);
    } else if (this.currentTab === 'check') {
      this.showSafetyCheckPanel(body);
    }
  }
  
  updatePropertiesPanel() {
    if (this.currentTab === 'props') {
      this.updateRightPanel();
    }
  }
  
  showPropertiesPanel(body) {
    if (!this.state.selected) {
      body.innerHTML = '<p style="color: var(--c-fg-muted);">No object selected</p>';
      return;
    }
    
    const obj = this.state.selected;
    
    let html = `<div class="form-group">
      <label>Type</label>
      <input type="text" value="${obj.type}" disabled style="opacity: 0.6;">
    </div>`;
    
    if (obj.label !== undefined) {
      html += `<div class="form-group">
        <label>Label</label>
        <input type="text" value="${obj.label}" id="prop-label">
      </div>`;
    }
    
    if (obj.fillColor !== undefined) {
      html += `<div class="form-group">
        <label>Fill Color</label>
        <input type="color" value="${obj.fillColor}" id="prop-fill">
      </div>`;
    }
    
    if (obj.strokeColor !== undefined) {
      html += `<div class="form-group">
        <label>Outline Color</label>
        <input type="color" value="${obj.strokeColor}" id="prop-stroke">
      </div>`;
    }
    
    if (obj.isEmergency !== undefined) {
      html += `<div class="form-group">
        <label>
          <input type="checkbox" id="prop-emergency" ${obj.isEmergency ? 'checked' : ''}>
          Emergency Exit
        </label>
      </div>`;
    }
    
    html += '<button class="btn" style="width: 100%; margin-top: 12px;" onclick="window.app.state.plans.remove(window.app.state.selected)">Delete</button>';
    
    body.innerHTML = html;
    
    // Wire up property changes
    const labelInput = body.querySelector('#prop-label');
    if (labelInput) {
      labelInput.addEventListener('change', e => {
        obj.label = e.target.value;
        this.state.canvas.render();
      });
    }
    
    const fillInput = body.querySelector('#prop-fill');
    if (fillInput) {
      fillInput.addEventListener('change', e => {
        obj.fillColor = e.target.value;
        this.state.canvas.render();
      });
    }
    
    const strokeInput = body.querySelector('#prop-stroke');
    if (strokeInput) {
      strokeInput.addEventListener('change', e => {
        obj.strokeColor = e.target.value;
        this.state.canvas.render();
      });
    }
    
    const emergencyInput = body.querySelector('#prop-emergency');
    if (emergencyInput) {
      emergencyInput.addEventListener('change', e => {
        obj.isEmergency = e.target.checked;
        this.state.canvas.render();
      });
    }
  }
  
  showPlanInfoPanel(body) {
    const plan = this.state.plans.current;
    if (!plan) return;
    
    body.innerHTML = `
      <div class="form-group">
        <label>Plan Name</label>
        <input type="text" value="${plan.name}" id="plan-name">
      </div>
      <div class="form-group">
        <label>Location/Building</label>
        <input type="text" value="${plan.location}" id="plan-location">
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="plan-desc">${plan.description}</textarea>
      </div>
      <div class="form-group">
        <label>Objects on plan: ${plan.objects.length}</label>
      </div>
    `;
    
    body.querySelector('#plan-name').addEventListener('change', e => {
      plan.name = e.target.value;
    });
    
    body.querySelector('#plan-location').addEventListener('change', e => {
      plan.location = e.target.value;
    });
    
    body.querySelector('#plan-desc').addEventListener('change', e => {
      plan.description = e.target.value;
    });
  }
  
  showSafetyCheckPanel(body) {
    const plan = this.state.plans.current;
    if (!plan) return;
    
    const checks = [];
    
    // Check 1: At least one assembly point
    const hasAssembly = plan.objects.some(o => o.type === 'assembly');
    checks.push({
      ok: hasAssembly,
      msg: hasAssembly ? '✓ Assembly point defined' : '✗ Add an assembly/meeting point',
    });
    
    // Check 2: Multiple escape routes
    const escapeRoutes = plan.objects.filter(o => o.isEscapeRoute).length;
    checks.push({
      ok: escapeRoutes >= 2,
      msg: escapeRoutes >= 2 ? `✓ Multiple escape routes (${escapeRoutes})` : `✗ Add at least 2 escape routes (${escapeRoutes})`,
    });
    
    // Check 3: People placed
    const people = plan.objects.filter(o => o.type === 'person').length;
    checks.push({
      ok: people > 0,
      msg: people > 0 ? `✓ Occupant positions marked (${people})` : '✗ Mark occupant positions',
    });
    
    // Check 4: Hazards identified
    const hazards = plan.objects.filter(o => o.type === 'hazard').length;
    checks.push({
      ok: hazards > 0,
      msg: hazards > 0 ? `✓ Hazards identified (${hazards})` : '⚠ Consider marking hazards',
    });
    
    const badge = document.getElementById('check-badge');
    const failCount = checks.filter(c => !c.ok).length;
    badge.textContent = failCount;
    
    let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
    checks.forEach(check => {
      html += `<div style="padding: 8px; border-radius: 4px; background: ${check.ok ? 'rgba(39, 174, 96, 0.1)' : 'rgba(231, 76, 60, 0.1)'};">
        <strong style="color: ${check.ok ? '#27ae60' : '#e74c3c'};">${check.msg}</strong>
      </div>`;
    });
    html += '</div>';
    
    body.innerHTML = html;
  }
  
  showPanel(tabName) {
    this.currentTab = tabName;
    
    document.querySelectorAll('.ptab').forEach(t => {
      t.classList.toggle('is-active', t.dataset.tab === tabName);
    });
    
    this.updateRightPanel();
  }
  
  togglePanel(side) {
    const panel = document.getElementById(`${side}-panel`);
    panel.classList.toggle('is-collapsed');
  }
  
  showHelpDialog() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 500px;">
        <div class="modal-head">
          <h1>Keyboard Shortcuts & Tips</h1>
          <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <h3>File Operations</h3>
          <table style="width: 100%; font-size: 12px; margin-bottom: 16px;">
            <tr><td><code>Ctrl+N</code></td><td>New plan</td></tr>
            <tr><td><code>Ctrl+O</code></td><td>Open plan</td></tr>
            <tr><td><code>Ctrl+S</code></td><td>Save plan</td></tr>
          </table>
          
          <h3>Editing</h3>
          <table style="width: 100%; font-size: 12px; margin-bottom: 16px;">
            <tr><td><code>Ctrl+Z</code></td><td>Undo</td></tr>
            <tr><td><code>Ctrl+Shift+Z</code></td><td>Redo</td></tr>
            <tr><td><code>Delete</code></td><td>Delete selected</td></tr>
            <tr><td><code>Esc</code></td><td>Deselect</td></tr>
          </table>
          
          <h3>View</h3>
          <table style="width: 100%; font-size: 12px; margin-bottom: 16px;">
            <tr><td><code>+</code></td><td>Zoom in</td></tr>
            <tr><td><code>−</code></td><td>Zoom out</td></tr>
            <tr><td><code>0</code></td><td>Fit to screen</td></tr>
            <tr><td><code>Ctrl+P</code></td><td>Print/PDF</td></tr>
          </table>
          
          <h3>Tips</h3>
          <ul style="font-size: 12px; line-height: 1.8;">
            <li>Use the grid and snap options for precise placement</li>
            <li>Grid squares represent 1 foot each</li>
            <li>Mark multiple escape routes clearly</li>
            <li>Show known hazards and equipment locations</li>
            <li>Use the Safety Check tab to validate your plan</li>
            <li>Print or export as PNG for sharing</li>
          </ul>
        </div>
      </div>
    `;
    
    document.getElementById('modal-host').appendChild(modal);
  }
  
  showTemplatesDialog() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 600px;">
        <div class="modal-head">
          <h1>Plan Templates</h1>
          <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
        </div>
        <div class="modal-body">
          <p style="color: var(--c-fg-muted); margin-bottom: 16px;">Start with a pre-made template for your building type.</p>
          
          <div class="grid grid-2" style="gap: 12px;">
            <button class="btn" style="padding: 20px; text-align: left; height: auto;" onclick="window.app.state.plans.new(); this.closest('.modal').remove();">
              <strong>Blank Canvas</strong>
              <br><span style="font-size: 11px; color: var(--c-fg-muted);">Start from scratch</span>
            </button>
            
            <button class="btn" style="padding: 20px; text-align: left; height: auto;" onclick="alert('Template loading not yet implemented'); this.closest('.modal').remove();">
              <strong>Small Office</strong>
              <br><span style="font-size: 11px; color: var(--c-fg-muted);">2-4 rooms template</span>
            </button>
            
            <button class="btn" style="padding: 20px; text-align: left; height: auto;" onclick="alert('Template loading not yet implemented'); this.closest('.modal').remove();">
              <strong>Daycare/Nursery</strong>
              <br><span style="font-size: 11px; color: var(--c-fg-muted);">Multi-room with playareas</span>
            </button>
            
            <button class="btn" style="padding: 20px; text-align: left; height: auto;" onclick="alert('Template loading not yet implemented'); this.closest('.modal').remove();">
              <strong>Retail Store</strong>
              <br><span style="font-size: 11px; color: var(--c-fg-muted);">Open floor plan</span>
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('modal-host').appendChild(modal);
  }
}
