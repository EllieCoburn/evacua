import { ImageProcessor } from './image-processor.js';
import { Overlay } from './overlay.js';
import { ICONS } from './icon-library.js';

const state = {
  imageProcessor: null,
  overlay: null,
  currentPlan: null,
};

function init() {
  setupCanvases();
  setupEventListeners();
  setupToolButtons();
  setupIconButtons();
  console.log('Evacua initialized');
}

function setupCanvases() {
  const imageCanvas = document.getElementById('image-canvas');
  const overlayCanvas = document.getElementById('overlay-canvas');

  // Set canvas size to window size
  const resizeCanvases = () => {
    imageCanvas.width = imageCanvas.offsetWidth;
    imageCanvas.height = imageCanvas.offsetHeight;
    overlayCanvas.width = overlayCanvas.offsetWidth;
    overlayCanvas.height = overlayCanvas.offsetHeight;
  };

  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);

  // Initialize processors
  state.imageProcessor = new ImageProcessor(imageCanvas, overlayCanvas);
  state.overlay = new Overlay(overlayCanvas, state.imageProcessor);
}

function setupEventListeners() {
  // File input
  document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await loadImage(file);
    }
    e.target.value = '';
  });

  // Upload zone drag-and-drop
  const uploadZone = document.getElementById('upload-zone');
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.style.backgroundColor = '';
  });

  uploadZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      await loadImage(file);
    }
  });

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      showTab(tab, btn.closest('.panel'));
    });
  });

  // Canvas controls
  document.querySelectorAll('[data-ctrl]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ctrl = btn.dataset.ctrl;
      handleCanvasControl(ctrl);
    });
  });

  // Action buttons
  document.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.act;
      handleAction(action);
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      state.imageProcessor.zoomIn();
    } else if (e.key === '-') {
      e.preventDefault();
      state.imageProcessor.zoomOut();
    } else if (e.key === '0') {
      e.preventDefault();
      state.imageProcessor.fitToScreen();
      state.imageProcessor.render();
    } else if (e.key === 'Delete') {
      if (state.overlay.selectedElement) {
        state.overlay.removeElement(state.overlay.selectedElement);
      }
    }
  });
}

function setupToolButtons() {
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      
      // Update active state
      document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      state.overlay.setTool(tool);
    });
  });
}

function setupIconButtons() {
  document.querySelectorAll('[data-icon]').forEach(btn => {
    btn.addEventListener('click', () => {
      const iconType = btn.dataset.icon;
      
      if (ICONS[iconType]?.isRoute) {
        // For routes, switch to draw mode
        state.overlay.currentIconType = iconType;
        state.overlay.setTool('draw-arrow');
        showToast(`Click canvas to start ${ICONS[iconType].name}`, 'info');
      } else {
        // For icons, enter placement mode
        state.overlay.setIconTool(iconType);
        showToast(`Click to place ${ICONS[iconType].name}`, 'info');
      }
    });
  });
}

async function loadImage(file) {
  try {
    await state.imageProcessor.loadImage(file);
    
    // Show editor, hide upload zone
    document.getElementById('upload-zone').style.display = 'none';
    document.getElementById('editor-container').style.display = 'flex';
    
    // Re-render overlay
    state.overlay.render();

    showToast('Image loaded! Start adding evacuation markers', 'success');
  } catch (err) {
    showToast(`Failed to load image: ${err.message}`, 'error');
  }
}

function handleCanvasControl(ctrl) {
  switch (ctrl) {
    case 'zoom-in':
      state.imageProcessor.zoomIn();
      break;
    case 'zoom-out':
      state.imageProcessor.zoomOut();
      break;
    case 'fit-screen':
      state.imageProcessor.fitToScreen();
      state.imageProcessor.render();
      break;
    case 'reset-view':
      state.imageProcessor.fitToScreen();
      state.imageProcessor.render();
      break;
  }
}

function handleAction(action) {
  switch (action) {
    case 'upload':
      document.getElementById('file-input').click();
      break;
    case 'undo':
      state.overlay.undo();
      break;
    case 'redo':
      state.overlay.redo();
      break;
    case 'export':
      exportPlan();
      break;
    case 'help':
      showHelp();
      break;
  }
}

function exportPlan() {
  const dataUrl = state.imageProcessor.exportPNG();
  if (!dataUrl) {
    showToast('No plan to export', 'error');
    return;
  }

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `evacuation-plan-${Date.now()}.png`;
  link.click();

  showToast('Plan exported as PNG', 'success');
}

function showTab(tab, panel) {
  // Hide all tabs in this panel
  panel.querySelectorAll('.tab-content').forEach(el => {
    el.classList.remove('active');
  });

  // Hide all tab buttons
  panel.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  const tabContent = panel.querySelector(`#tab-${tab}`);
  if (tabContent) {
    tabContent.classList.add('active');
  }

  // Highlight selected button
  event.target.classList.add('active');
}

function showHelp() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-head">
        <h1>How to Use Evacua</h1>
      </div>
      <div class="modal-body">
        <h3>Getting Started</h3>
        <ol>
          <li><strong>Upload a floor plan</strong> - Drag and drop an image, PDF, or video of your space</li>
          <li><strong>Add safety markers</strong> - Click icon buttons to place emergency equipment</li>
          <li><strong>Draw evacuation routes</strong> - Use arrow tools to draw escape paths</li>
          <li><strong>Export your map</strong> - Download as PNG for printing or sharing</li>
        </ol>

        <h3>Tools</h3>
        <ul>
          <li><strong>🚪 Emergency Exit</strong> - Mark all exits</li>
          <li><strong>→ Primary Route</strong> - Main evacuation path</li>
          <li><strong>⇢ Alt Route</strong> - Secondary escape route</li>
          <li><strong>📍 Assembly Point</strong> - Muster location</li>
          <li><strong>🧯 Fire Extinguisher</strong> - Equipment location</li>
          <li><strong>🩹 First Aid</strong> - Medical supplies</li>
          <li><strong>⚠️ Hazard</strong> - Dangerous areas</li>
          <li><strong>👤 Person</strong> - Occupant locations</li>
        </ul>

        <h3>Keyboard Shortcuts</h3>
        <ul>
          <li><strong>+/-</strong> - Zoom in/out</li>
          <li><strong>0</strong> - Fit to screen</li>
          <li><strong>Delete</strong> - Remove selected element</li>
        </ul>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Got it!</button>
      </div>
    </div>
  `;

  document.getElementById('modal-host').appendChild(modal);
}

function showToast(message, type = 'info') {
  const host = document.getElementById('toast-host');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  host.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
