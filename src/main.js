import { ImageProcessor } from './image-processor.js';
import { Overlay } from './overlay.js';
import { WallDetector } from './wall-detector.js';
import { ICONS, preloadIcons, getIconImage } from './icon-library.js';
import { cleanFloorPlan } from './plan-cleaner.js';

const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = {
  imageProcessor: null,
  overlay: null,
  wallDetector: null,
  currentPlan: null,
  showDetection: false,
  originalImage: null,   // what the user uploaded (Image)
  cleanPlan: null,       // auto-converted outline (canvas)
  view: 'clean',
};

function init() {
  setupCanvases();
  setupEventListeners();
  setupToolButtons();
  setupDetectionControls();

  preloadIcons().then(() => {
    buildIconPalette();
    state.overlay.render();
    console.log('Evacua initialized');
  });
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
  const fileInput = document.getElementById('file-input');
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('File selected:', file.name, file.size, file.type);
      await loadImage(file);
    }
    e.target.value = '';
  });

  const uploadZone = document.getElementById('upload-zone');
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.style.backgroundColor = 'rgba(37, 99, 235, 0.1)';
  });

  uploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.style.backgroundColor = '';
  });

  uploadZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.style.backgroundColor = '';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      console.log('File dropped:', file.name, file.size, file.type);
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
    // Don't hijack keys while typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

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
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.overlay.selectedElement) {
        e.preventDefault();
        state.overlay.removeElement(state.overlay.selectedElement);
        state.overlay.selectElement(null);
      }
    } else if (e.key.startsWith('Arrow') && state.overlay.selectedElement?.x !== undefined) {
      // Nudge the selected icon into the perfect spot: 1px, or 10px with Shift
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const el = state.overlay.selectedElement;
      if (e.key === 'ArrowLeft') el.x -= step;
      if (e.key === 'ArrowRight') el.x += step;
      if (e.key === 'ArrowUp') el.y -= step;
      if (e.key === 'ArrowDown') el.y += step;
      state.overlay.render();
    }
  });

  // After placing an icon the overlay switches itself back to select mode —
  // reflect that in the palette and tool buttons
  window.addEventListener('tool-changed', (e) => {
    document.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === e.detail);
    });
  });

  window.addEventListener('element-selected', (e) => {
    updatePropsPanel(e.detail);
  });
}

function updatePropsPanel(element) {
  const panel = document.getElementById('props-panel');
  if (!panel) return;

  if (!element) {
    panel.innerHTML = '<p style="color: var(--c-fg-muted); font-size: 12px;">Select an element to view/edit properties</p>';
    return;
  }

  panel.innerHTML = '';

  const title = document.createElement('h4');
  title.textContent = ICONS[element.type]?.name || 'Element';
  title.style.cssText = 'margin: 0 0 12px; font-size: 13px;';
  panel.appendChild(title);

  // Icons get a size slider and a label field; routes get delete only
  if (element.scale !== undefined) {
    const sizeLabel = document.createElement('label');
    sizeLabel.style.cssText = 'display: block; margin-bottom: 12px; font-size: 12px;';
    sizeLabel.textContent = 'Size';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0.4';
    slider.max = '3';
    slider.step = '0.05';
    slider.value = String(element.scale);
    slider.style.cssText = 'width: 100%; margin-top: 4px;';
    slider.addEventListener('input', () => {
      element.scale = parseFloat(slider.value);
      state.overlay.render();
    });
    sizeLabel.appendChild(slider);
    panel.appendChild(sizeLabel);

    const labelLabel = document.createElement('label');
    labelLabel.style.cssText = 'display: block; margin-bottom: 12px; font-size: 12px;';
    labelLabel.textContent = 'Label (shown under the symbol)';
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.placeholder = 'e.g. EXIT 2';
    labelInput.value = element.label || '';
    labelInput.style.cssText = 'width: 100%; margin-top: 4px; padding: 6px; box-sizing: border-box;';
    labelInput.addEventListener('input', () => {
      element.label = labelInput.value;
      state.overlay.render();
    });
    labelLabel.appendChild(labelInput);
    panel.appendChild(labelLabel);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'btn';
  delBtn.textContent = 'Delete';
  delBtn.style.cssText = 'width: 100%; color: #dc2626;';
  delBtn.addEventListener('click', () => {
    state.overlay.removeElement(element);
    state.overlay.selectElement(null);
  });
  panel.appendChild(delBtn);
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

function buildIconPalette() {
  const palette = document.getElementById('icon-palette');
  if (!palette) return;

  palette.innerHTML = '';

  for (const [key, icon] of Object.entries(ICONS)) {
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.dataset.icon = key;
    btn.title = icon.name;

    const preview = document.createElement('span');
    preview.className = 'icon-preview';
    preview.innerHTML = icon.svg;

    const label = document.createElement('span');
    label.textContent = icon.name;

    btn.appendChild(preview);
    btn.appendChild(label);

    btn.addEventListener('click', () => {
      document.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (icon.isRoute) {
        state.overlay.currentIconType = key;
        state.overlay.setTool('draw-arrow');
        showToast(`Click points along the ${icon.name.toLowerCase()}, double-click to finish`, 'info');
      } else {
        state.overlay.setIconTool(key);
        showToast(`Click the map to place: ${icon.name}`, 'info');
      }
    });

    palette.appendChild(btn);
  }
}

// Render the first page of a PDF to a PNG blob using pdf.js
async function pdfToImageBlob(file) {
  if (!window.pdfjsLib) {
    throw new Error('PDF support did not load — check your connection and refresh the page');
  }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);

  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2200 / Math.max(base.width, base.height), 4);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not render the PDF page');
  return { blob, numPages: pdf.numPages };
}

async function loadImage(file) {
  try {
    // Validate file
    if (!file) {
      throw new Error('No file selected');
    }

    console.log('Loading file:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');

    if (!isPdf && !file.type.startsWith('image/')) {
      throw new Error(`Unsupported file type: ${file.type || 'unknown'}. Upload an image or PDF.`);
    }

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File is too large. Maximum 50MB allowed.');
    }

    let loadSource = file;
    if (isPdf) {
      showToast('Converting PDF...', 'info');
      const { blob, numPages } = await pdfToImageBlob(file);
      loadSource = blob;
      if (numPages > 1) {
        showToast(`PDF has ${numPages} pages — using page 1`, 'info');
      }
    } else {
      showToast('Loading image...', 'info');
    }

    // Show editor before loading to ensure container has dimensions
    const uploadZone = document.getElementById('upload-zone');
    const editorContainer = document.getElementById('editor-container');
    const canvases = editorContainer.querySelector('.image-viewer-container');

    uploadZone.style.display = 'none';
    editorContainer.style.display = 'flex';

    // Give the DOM a moment to render
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify container has dimensions
    const containerWidth = canvases.offsetWidth;
    const containerHeight = canvases.offsetHeight;

    console.log('Container dimensions:', { width: containerWidth, height: containerHeight });

    if (containerWidth === 0 || containerHeight === 0) {
      throw new Error('Canvas container has no dimensions. Please try again.');
    }

    // Load the image
    await state.imageProcessor.loadImage(loadSource);
    state.originalImage = state.imageProcessor.currentImage;

    // Hide detection controls
    document.getElementById('detection-controls').style.display = 'none';

    // Auto-convert to a clean floor plan outline
    showToast('Converting to clean floor plan...', 'info');
    await new Promise(resolve => setTimeout(resolve, 30)); // let the toast paint

    try {
      state.cleanPlan = cleanFloorPlan(state.originalImage);
      state.view = 'clean';
      state.imageProcessor.currentImage = state.cleanPlan;
      state.imageProcessor.fitToScreen();
      state.imageProcessor.render();
      updateViewToggle();
      showToast('Converted! Add your symbols — or press "Original" to compare.', 'success');
    } catch (cleanErr) {
      console.error('Auto-clean failed, showing original:', cleanErr);
      state.cleanPlan = null;
      state.view = 'original';
      updateViewToggle();
      showToast('Floor plan loaded (couldn\'t auto-clean this one)', 'info');
    }

    // Render overlay
    state.overlay.render();

    console.log('File loaded successfully');
  } catch (err) {
    console.error('Image load error:', err);

    // Show editor again on error so user can retry
    document.getElementById('upload-zone').style.display = 'flex';
    document.getElementById('editor-container').style.display = 'none';

    showToast(`Upload failed: ${err.message}`, 'error');
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
    case 'toggle-view':
      toggleView();
      break;
  }
}

function toggleView() {
  if (!state.cleanPlan || !state.originalImage) return;

  state.view = state.view === 'clean' ? 'original' : 'clean';
  state.imageProcessor.currentImage =
    state.view === 'clean' ? state.cleanPlan : state.originalImage;

  // Clean plan may be downscaled from the original, so refit to keep alignment
  state.imageProcessor.fitToScreen();
  state.imageProcessor.render();
  state.overlay.render();
  updateViewToggle();
}

function updateViewToggle() {
  const btn = document.getElementById('view-toggle');
  if (!btn) return;
  // Button shows the view you'd switch TO
  btn.textContent = state.view === 'clean' ? 'Original' : 'Clean Plan';
  btn.title = state.view === 'clean'
    ? 'Show the original upload'
    : 'Show the converted clean plan';
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
  if (!state.imageProcessor.currentImage) {
    showToast('No plan to export', 'error');
    return;
  }

  const imageCanvas = document.getElementById('image-canvas');
  const overlayCanvas = document.getElementById('overlay-canvas');

  const out = document.createElement('canvas');
  out.width = imageCanvas.width;
  out.height = imageCanvas.height;
  const ctx = out.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(imageCanvas, 0, 0);
  ctx.drawImage(overlayCanvas, 0, 0);

  drawLegend(ctx, out.width, out.height);

  const link = document.createElement('a');
  link.href = out.toDataURL('image/png');
  link.download = `evacuation-plan-${Date.now()}.png`;
  link.click();

  showToast('Plan exported as PNG with legend', 'success');
}

// Auto-generated legend of the symbols actually used on this plan,
// like the legend block on professional evacuation signage
function drawLegend(ctx, canvasW, canvasH) {
  const used = new Map();
  for (const ic of state.overlay.icons) {
    if (ICONS[ic.type]) used.set(ic.type, ICONS[ic.type]);
  }
  for (const rt of state.overlay.routes) {
    if (ICONS[rt.type]) used.set(rt.type, ICONS[rt.type]);
  }
  if (used.size === 0) return;

  const rowH = 28;
  const pad = 12;
  const titleH = 24;
  const boxW = 200;
  const boxH = titleH + used.size * rowH + pad;
  const x = 16;
  const y = canvasH - boxH - 16;

  ctx.save();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeRect(x, y, boxW, boxH);

  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEGEND', x + pad, y + titleH / 2 + 4);
  ctx.beginPath();
  ctx.moveTo(x + pad, y + titleH);
  ctx.lineTo(x + boxW - pad, y + titleH);
  ctx.lineWidth = 1;
  ctx.stroke();

  let rowY = y + titleH + rowH / 2;
  for (const [type, icon] of used) {
    if (icon.isRoute) {
      // Line sample with arrowhead
      ctx.strokeStyle = icon.color;
      ctx.lineWidth = 3;
      ctx.setLineDash(icon.dash && icon.dash.length ? [7, 5] : []);
      ctx.beginPath();
      ctx.moveTo(x + pad, rowY);
      ctx.lineTo(x + pad + 22, rowY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = icon.color;
      ctx.beginPath();
      ctx.moveTo(x + pad + 30, rowY);
      ctx.lineTo(x + pad + 21, rowY - 5);
      ctx.lineTo(x + pad + 21, rowY + 5);
      ctx.closePath();
      ctx.fill();
    } else {
      const img = getIconImage(type);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x + pad + 2, rowY - 11, 22, 22);
      }
    }

    ctx.fillStyle = '#1a1a1a';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(icon.name.toUpperCase(), x + pad + 38, rowY + 1);
    rowY += rowH;
  }

  ctx.restore();
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
