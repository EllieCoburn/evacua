import { ImageProcessor } from './image-processor.js';
import { Overlay } from './overlay.js';
import { WallDetector } from './wall-detector.js';
import { ICONS } from './icon-library.js';

const state = {
  imageProcessor: null,
  overlay: null,
  wallDetector: null,
  currentPlan: null,
  showDetection: false,
};

function init() {
  setupCanvases();
  setupEventListeners();
  setupToolButtons();
  setupIconButtons();
  setupDetectionControls();
  console.log('Evacua initialized');
}

function setupCanvases() {
  const imageCanvas = document.getElementById('image-canvas');
  const overlayCanvas = document.getElementById('overlay-canvas');

  const resizeCanvases = () => {
    imageCanvas.width = imageCanvas.offsetWidth;
    imageCanvas.height = imageCanvas.offsetHeight;
    overlayCanvas.width = overlayCanvas.offsetWidth;
    overlayCanvas.height = overlayCanvas.offsetHeight;
  };

  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);

  state.imageProcessor = new ImageProcessor(imageCanvas, overlayCanvas);
  state.overlay = new Overlay(overlayCanvas, state.imageProcessor);
  state.wallDetector = new WallDetector(state.imageProcessor);
}

function setupDetectionControls() {
  const detectBtn = document.getElementById('detect-walls-btn');
  const controls = document.getElementById('detection-controls');
  const sensitivitySlider = document.getElementById('sensitivity-slider');
  const blurSlider = document.getElementById('blur-slider');
  const showDetectionCheckbox = document.getElementById('show-detection');
  const extractBtn = document.getElementById('extract-walls-btn');
  const clearBtn = document.getElementById('clear-detection-btn');

  detectBtn.addEventListener('click', () => {
    showToast('Detecting walls... this may take a moment', 'info');
    
    setTimeout(() => {
      const detectionCanvas = state.wallDetector.detect();
      if (detectionCanvas) {
        controls.style.display = 'block';
        showToast('Walls detected! Adjust settings to refine', 'success');
        state.showDetection = true;
        renderWithDetection();
      } else {
        showToast('No image uploaded yet', 'error');
      }
    }, 100);
  });

  sensitivitySlider.addEventListener('input', (e) => {
    state.wallDetector.setSensitivity(parseFloat(e.target.value));
    document.getElementById('sensitivity-value').textContent = 
      Math.round(parseFloat(e.target.value) * 100) + '%';
    
    state.wallDetector.detect();
    if (state.showDetection) {
      renderWithDetection();
    }
  });

  blurSlider.addEventListener('input', (e) => {
    state.wallDetector.setBlurRadius(parseInt(e.target.value));
    document.getElementById('blur-value').textContent = e.target.value + 'px';
    
    state.wallDetector.detect();
    if (state.showDetection) {
      renderWithDetection();
    }
  });

  showDetectionCheckbox.addEventListener('change', (e) => {
    state.showDetection = e.target.checked;
    renderWithDetection();
  });

  extractBtn.addEventListener('click', () => {
    const lines = state.wallDetector.extractWallLines();
    showToast(`Extracted ${lines.length} wall segments. Refine manually if needed.`, 'info');
    // TODO: Convert detected lines to editable wall elements
  });

  clearBtn.addEventListener('click', () => {
    state.wallDetector.detectedWalls = null;
    state.showDetection = false;
    showDetectionCheckbox.checked = false;
    controls.style.display = 'none';
    state.imageProcessor.render();
    state.overlay.render();
    showToast('Detection cleared', 'info');
  });
}

function renderWithDetection() {
  state.imageProcessor.render();
  
  if (state.showDetection && state.wallDetector.detectedWalls) {
    const overlayCanvas = document.getElementById('overlay-canvas');
    const ctx = overlayCanvas.getContext('2d');
    state.wallDetector.renderDetection(overlayCanvas);
  }
  
  state.overlay.render();
}

function setupEventListeners() {
  document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await loadImage(file);
    }
    e.target.value = '';
  });

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

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      showTab(tab, btn.closest('.panel'));
    });
  });

  document.querySelectorAll('[data-ctrl]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ctrl = btn.dataset.ctrl;
      handleCanvasControl(ctrl);
    });
  });

  document.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.act;
      handleAction(action);
    });
  });

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
        state.overlay.currentIconType = iconType;
        state.overlay.setTool('draw-arrow');
        showToast(`Click canvas to start ${ICONS[iconType].name}`, 'info');
      } else {
        state.overlay.setIconTool(iconType);
        showToast(`Click to place ${ICONS[iconType].name}`, 'info');
      }
    });
  });
}

async function loadImage(file) {
  try {
    await state.imageProcessor.loadImage(file);
    
    document.getElementById('upload-zone').style.display = 'none';
    document.getElementById('editor-container').style.display = 'flex';
    document.getElementById('detection-controls').style.display = 'none';
    
    state.overlay.render();

    showToast('Image loaded! Use wall detection or add markers manually', 'success');
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
  panel.querySelectorAll('.tab-content').forEach(el => {
    el.classList.remove('active');
  });

  panel.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const tabContent = panel.querySelector(`#tab-${tab}`);
  if (tabContent) {
    tabContent.classList.add('active');
  }

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
          <li><strong>Upload a floor plan</strong> - Drag and drop an image of your space</li>
          <li><strong>Auto-detect walls (optional)</strong> - Click "Detect Walls" to automatically extract walls and structures</li>
          <li><strong>Add safety markers</strong> - Click icon buttons to place emergency equipment</li>
          <li><strong>Draw evacuation routes</strong> - Use arrow tools to draw escape paths</li>
          <li><strong>Export your map</strong> - Download as PNG for printing or sharing</li>
        </ol>

        <h3>Wall Detection</h3>
        <ul>
          <li>Go to <strong>Detection</strong> tab after uploading an image</li>
          <li>Click <strong>Detect Walls</strong> to analyze the image</li>
          <li>Adjust <strong>Sensitivity</strong> and <strong>Blur Radius</strong> sliders to fine-tune detection</li>
          <li>Check <strong>Show Detection Overlay</strong> to see detected walls overlaid</li>
          <li>Click <strong>Extract Detected Walls</strong> to convert to editable elements</li>
        </ul>

        <h3>Emergency Symbols</h3>
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
