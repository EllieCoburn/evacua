import { ImageProcessor } from './image-processor.js';
import { Overlay } from './overlay.js';
import { ICONS, preloadIcons } from './icon-library.js';
import { visionRequest, warmupVision, sourceToImageData } from './vision-client.js';
import {
  renderPlanCanvas, renderTraceCanvas, findComponentAt,
  findOpeningAt, addWallToPlan, nearestWallOrientation
} from './plan-render.js';

const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = {
  imageProcessor: null,
  overlay: null,
  currentPlan: null,
  originalImage: null,   // what the user uploaded (Image)
  cleanPlan: null,       // reconstructed plan (canvas)
  vectorPlan: null,      // { walls, doors, width, height } — the geometry
  vectorOpts: { minWallLen: 20, bridgeGap: 5 },
  view: 'clean',
  planInfo: {
    title: 'EMERGENCY EVACUATION PLAN',
    address: '',
    floor: '',
    footer1: 'IN CASE OF FIRE USE STAIRS — DO NOT USE ELEVATOR',
    footer2: 'IN CASE OF EMERGENCY DIAL 911',
    show: true,
  },
};

function init() {
  setupCanvases();
  setupEventListeners();
  setupToolButtons();
  setupConvertControls();
  setupPlanInfo();

  preloadIcons().then(() => {
    buildIconPalette();
    state.overlay.render();
    console.log('Evacua initialized');
  });

  // Warm up the vision engine in the background so the first upload
  // reconstructs without waiting on the download
  warmupVision();
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
  state.overlay.planInfo = state.planInfo;
  state.overlay.onWallErase = (pos) => eraseWallAt(pos);
}

// ---- Processing overlay ----

const processing = { pct: 0, lastRealUpdate: 0, heartbeat: null };

function showProcessing(label) {
  const overlay = document.getElementById('processing-overlay');
  if (overlay) overlay.hidden = false;
  processing.pct = 0;
  processing.lastRealUpdate = Date.now();
  paintProgress(0, label);

  // Heartbeat: if no real progress event arrives for a moment, creep the
  // bar forward slightly so the user always sees the app is alive
  clearInterval(processing.heartbeat);
  processing.heartbeat = setInterval(() => {
    if (Date.now() - processing.lastRealUpdate > 1000 && processing.pct < 95) {
      processing.pct = Math.min(processing.pct + 0.4, 95);
      paintProgress(processing.pct, null);
    }
  }, 500);
}

function setProgress(pct, label) {
  // Real event: never move backwards past heartbeat creep
  processing.pct = Math.max(processing.pct, Math.max(0, Math.min(100, pct)));
  processing.lastRealUpdate = Date.now();
  paintProgress(processing.pct, label);
}

function paintProgress(pct, label) {
  const fill = document.getElementById('processing-fill');
  const pctEl = document.getElementById('processing-pct');
  const labelEl = document.getElementById('processing-label');
  if (fill) fill.style.width = pct + '%';
  if (pctEl) pctEl.textContent = Math.round(pct) + '%';
  if (label && labelEl) labelEl.textContent = label;
}

function hideProcessing() {
  clearInterval(processing.heartbeat);
  processing.heartbeat = null;
  const overlay = document.getElementById('processing-overlay');
  if (overlay) overlay.hidden = true;
}

// Reconstruct the floor plan from the original upload and swap it in as the
// base. All analysis runs in the vision worker (background thread) so the
// UI stays responsive; progress is shown in the overlay.
async function reconstructPlan({ silent = false } = {}) {
  if (!state.originalImage) {
    if (!silent) showToast('Upload a floor plan first', 'error');
    return false;
  }

  showProcessing('Preparing image…');

  try {
    const srcW = state.originalImage.naturalWidth || state.originalImage.width;
    const srcH = state.originalImage.naturalHeight || state.originalImage.height;

    let plan = null;
    try {
      const { imageData, scale } = sourceToImageData(state.originalImage, 1600);
      const result = await visionRequest(
        'vectorize',
        {
          width: imageData.width,
          height: imageData.height,
          buffer: imageData.data.buffer,
          opts: state.vectorOpts
        },
        (pct, label) => setProgress(pct, label),
        [imageData.data.buffer],
        120000 // hard cap (incl. engine download on slow networks): may never hang
      );

      // Scale geometry from working resolution to source coordinates
      const inv = 1 / scale;
      for (const comp of result.components) {
        for (const ring of comp.rings) {
          for (const p of ring) { p.x *= inv; p.y *= inv; }
        }
      }
      for (const d of result.doors) { d.x *= inv; d.y *= inv; d.length *= inv; }
      for (const win of result.windows) { win.x *= inv; win.y *= inv; win.length *= inv; }
      result.wallThickness *= inv;
      result.width = srcW;
      result.height = srcH;

      plan = { mode: 'cv', ...result };
    } catch (err) {
      console.warn('Vision engine reconstruction failed:', err);
    }

    if (plan && plan.wallCount >= 2) {
      state.vectorPlan = plan;
      state.cleanPlan = renderPlanCanvas(plan);
      state.view = 'clean';
      state.imageProcessor.currentImage = state.cleanPlan;
      state.imageProcessor.fitToScreen();
      state.imageProcessor.render();
      state.overlay.render();
      updateViewToggle();
      updateVectorStats(plan, false);
      if (!silent) showToast(planSummary(plan), 'success');
      return true;
    }

    // Fallback: simple traced version (also computed in the worker)
    setProgress(30, 'Tracing plan outline…');
    const { imageData: traceData } = sourceToImageData(state.originalImage, 1800);
    const trace = await visionRequest(
      'trace',
      { width: traceData.width, height: traceData.height, buffer: traceData.data.buffer },
      (pct, label) => setProgress(pct, label),
      [traceData.data.buffer],
      60000
    );

    state.vectorPlan = plan; // may be null or a too-sparse plan
    state.cleanPlan = renderTraceCanvas(trace);
    state.view = 'clean';
    state.imageProcessor.currentImage = state.cleanPlan;
    state.imageProcessor.fitToScreen();
    state.imageProcessor.render();
    state.overlay.render();
    updateViewToggle();
    updateVectorStats(plan, true);
    if (!silent) {
      showToast('Not enough wall structure found — showing a traced version instead', 'info');
    }
    return false;
  } finally {
    hideProcessing();
  }
}

function planSummary(plan) {
  const parts = [`Reconstructed ${plan.wallCount} wall sections`];
  if (plan.doors?.length) parts.push(`${plan.doors.length} doors`);
  if (plan.windows?.length) parts.push(`${plan.windows.length} windows`);
  return parts.join(', ');
}

function updateVectorStats(plan, fellBack) {
  const el = document.getElementById('vector-stats');
  if (!el) return;
  if (!plan) {
    el.textContent = fellBack
      ? 'Reconstruction unavailable — showing a traced version. Try Reconstruct again once online.'
      : '';
  } else if (fellBack) {
    el.textContent = `Found only ${plan.wallCount} wall sections — showing a traced version instead. Try lowering Minimum Wall Length.`;
  } else {
    el.textContent = `${plan.wallCount} wall sections, ${plan.doors?.length || 0} doors, ` +
      `${plan.windows?.length || 0} windows. Use the Wall Eraser to remove any false walls.`;
  }
}

function eraseWallAt(pos) {
  const plan = state.vectorPlan;
  if (!plan || !plan.components) return;

  const { imageX, imageY } = state.imageProcessor.canvasToImageCoords(pos.x, pos.y);

  // Doors/windows are smaller targets — check them before walls
  const opening = findOpeningAt(plan, imageX, imageY);
  if (opening) {
    (opening.kind === 'door' ? plan.doors : plan.windows).splice(opening.index, 1);
    refreshPlanCanvas();
    return;
  }

  const idx = findComponentAt(plan, imageX, imageY);
  if (idx === -1) return;

  plan.components.splice(idx, 1);
  plan.wallCount = plan.components.length;
  refreshPlanCanvas();
}

function setupPlanInfo() {
  const fields = [
    ['plan-title', 'title'],
    ['plan-address', 'address'],
    ['plan-floor', 'floor'],
    ['plan-footer1', 'footer1'],
    ['plan-footer2', 'footer2'],
  ];

  for (const [id, key] of fields) {
    const input = document.getElementById(id);
    if (!input) continue;
    // Seed defaults from the HTML values
    state.planInfo[key] = input.value;
    input.addEventListener('input', () => {
      state.planInfo[key] = input.value;
      state.overlay.render();
    });
  }

  const frameToggle = document.getElementById('opt-frame');
  if (frameToggle) {
    state.planInfo.show = frameToggle.checked;
    frameToggle.addEventListener('change', () => {
      state.planInfo.show = frameToggle.checked;
      state.overlay.render();
    });
  }
}

function setupConvertControls() {
  const vectorizeBtn = document.getElementById('vectorize-btn');
  const minWallSlider = document.getElementById('minwall-slider');
  const bridgeSlider = document.getElementById('bridge-slider');

  vectorizeBtn.addEventListener('click', () => {
    showToast('Analyzing floor plan structure...', 'info');
    setTimeout(() => reconstructPlan(), 30);
  });

  minWallSlider.addEventListener('input', (e) => {
    document.getElementById('minwall-value').textContent =
      e.target.value + 'px — lower keeps more detail, higher removes clutter';
  });
  minWallSlider.addEventListener('change', (e) => {
    state.vectorOpts.minWallLen = parseInt(e.target.value);
    if (state.vectorPlan) reconstructPlan({ silent: true });
  });

  bridgeSlider.addEventListener('input', (e) => {
    document.getElementById('bridge-value').textContent =
      e.target.value + 'px — joins broken lines; keep low to preserve doorways';
  });
  bridgeSlider.addEventListener('change', (e) => {
    state.vectorOpts.bridgeGap = parseInt(e.target.value);
    if (state.vectorPlan) reconstructPlan({ silent: true });
  });

  // ---- Plan editing tools: walls, doors, windows, scale ----

  const PLAN_TOOL_HINTS = {
    wall: 'Add Wall: drag on the map to draw a wall (near-straight lines snap)',
    door: 'Add Door: click on a wall to place a door',
    window: 'Add Window: click on a wall to place a window',
    erase: 'Erase: click any wall, door, or window to remove it',
    scale: 'Set Scale: click two points a known distance apart',
  };

  document.querySelectorAll('.plan-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.planTool;
      const activating = !btn.classList.contains('active');

      document.querySelectorAll('[data-tool], .icon-btn, .plan-tool').forEach(b => b.classList.remove('active'));

      if (!activating) {
        state.activePlanTool = null;
        state.overlay.setTool('select');
        return;
      }

      if (tool !== 'scale' && (!state.vectorPlan || !state.vectorPlan.components)) {
        showToast('Reconstruct a floor plan first', 'error');
        return;
      }
      if (!state.originalImage) {
        showToast('Upload a floor plan first', 'error');
        return;
      }

      btn.classList.add('active');
      state.activePlanTool = tool;
      state.scaleDraft = null;

      if (tool === 'wall') state.overlay.setTool('add-plan-wall');
      else if (tool === 'erase') state.overlay.setTool('erase-wall');
      else state.overlay.setTool('plan-click');

      showToast(PLAN_TOOL_HINTS[tool], 'info');
    });
  });

  // Leaving plan-tool mode via any other tool clears the highlights
  window.addEventListener('tool-changed', (e) => {
    if (!['erase-wall', 'add-plan-wall', 'plan-click'].includes(e.detail)) {
      document.querySelectorAll('.plan-tool').forEach(b => b.classList.remove('active'));
      state.activePlanTool = null;
    }
  });

  state.overlay.onPlanWallAdd = (start, end) => {
    const plan = state.vectorPlan;
    if (!plan || !plan.components) return;
    const a = state.imageProcessor.canvasToImageCoords(start.x, start.y);
    const b = state.imageProcessor.canvasToImageCoords(end.x, end.y);
    if (addWallToPlan(plan, a.imageX, a.imageY, b.imageX, b.imageY)) {
      refreshPlanCanvas();
    }
  };

  state.overlay.onPlanClick = (pos) => {
    const { imageX, imageY } = state.imageProcessor.canvasToImageCoords(pos.x, pos.y);

    if (state.activePlanTool === 'scale') {
      handleScaleClick(imageX, imageY);
      return;
    }

    const plan = state.vectorPlan;
    if (!plan || !plan.components) return;

    if (state.activePlanTool === 'door' || state.activePlanTool === 'window') {
      const o = nearestWallOrientation(plan, imageX, imageY);
      const t = plan.wallThickness || 8;
      const opening = { x: imageX, y: imageY, length: t * 4, o };
      if (state.activePlanTool === 'door') plan.doors.push(opening);
      else plan.windows.push(opening);
      refreshPlanCanvas();
      showToast(`${state.activePlanTool === 'door' ? 'Door' : 'Window'} added — erase and re-place to adjust`, 'success');
    }
  };
}

function handleScaleClick(imageX, imageY) {
  if (!state.scaleDraft) {
    state.scaleDraft = { x: imageX, y: imageY };
    showToast('Now click the second point', 'info');
    return;
  }

  const distPx = Math.hypot(imageX - state.scaleDraft.x, imageY - state.scaleDraft.y);
  state.scaleDraft = null;
  if (distPx < 4) {
    showToast('Points are too close together — try again', 'error');
    return;
  }

  const answer = window.prompt('Real-world distance between the two points (e.g. "10 ft" or "3 m"):', '10 ft');
  if (!answer) return;

  const match = answer.trim().match(/^([\d.]+)\s*([a-zA-Z]*)$/);
  const value = match ? parseFloat(match[1]) : NaN;
  if (!match || !isFinite(value) || value <= 0) {
    showToast('Could not read that distance — use a format like "10 ft"', 'error');
    return;
  }

  state.planInfo.scale = {
    pixelsPerUnit: distPx / value,
    unit: match[2] || 'ft'
  };
  state.overlay.render();
  showToast(`Scale set: a scale bar now appears on the plan (${answer.trim()})`, 'success');
}

// Re-render the base plan canvas after a model edit
function refreshPlanCanvas() {
  const plan = state.vectorPlan;
  if (!plan) return;
  state.cleanPlan = renderPlanCanvas(plan);
  if (state.view === 'clean') {
    state.imageProcessor.currentImage = state.cleanPlan;
    state.imageProcessor.render();
    state.overlay.render();
  }
  updateVectorStats(plan, false);
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
    } else if (e.key.startsWith('Arrow') && state.overlay.selectedElement) {
      // Nudge the selected element into the perfect spot: 1px, or 10px with Shift
      const el = state.overlay.selectedElement;
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      if (typeof el.moveBy === 'function') {
        e.preventDefault();
        el.moveBy(dx, dy);
        state.overlay.render();
      } else if (el.x !== undefined) {
        e.preventDefault();
        el.x += dx;
        el.y += dy;
        state.overlay.render();
      }
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
  title.textContent = ICONS[element.type]?.name || element.typeName || 'Element';
  title.style.cssText = 'margin: 0 0 12px; font-size: 13px;';
  panel.appendChild(title);

  // Text labels: edit the text and font size
  if (element.text !== undefined) {
    const textLabel = document.createElement('label');
    textLabel.style.cssText = 'display: block; margin-bottom: 12px; font-size: 12px;';
    textLabel.textContent = 'Text';
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = element.text;
    textInput.style.cssText = 'width: 100%; margin-top: 4px; padding: 6px; box-sizing: border-box;';
    textInput.addEventListener('input', () => {
      element.text = textInput.value;
      state.overlay.render();
    });
    textLabel.appendChild(textInput);
    panel.appendChild(textLabel);

    const sizeLabel = document.createElement('label');
    sizeLabel.style.cssText = 'display: block; margin-bottom: 12px; font-size: 12px;';
    sizeLabel.textContent = 'Text Size';
    const sizeSlider = document.createElement('input');
    sizeSlider.type = 'range';
    sizeSlider.min = '10';
    sizeSlider.max = '48';
    sizeSlider.step = '1';
    sizeSlider.value = String(element.fontSize);
    sizeSlider.style.cssText = 'width: 100%; margin-top: 4px;';
    sizeSlider.addEventListener('input', () => {
      element.fontSize = parseInt(sizeSlider.value);
      state.overlay.render();
    });
    sizeLabel.appendChild(sizeSlider);
    panel.appendChild(sizeLabel);
  }

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

const TOOL_HINTS = {
  'draw-line': 'Wall Line: drag to draw a wall segment',
  'arrow': 'Arrow: drag from tail to tip',
  'text': 'Text: click the map, then type your label',
  'erase': 'Erase: click any element to delete it',
};

function setupToolButtons() {
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;

      document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.plan-tool').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      state.overlay.setTool(tool);
      if (TOOL_HINTS[tool]) showToast(TOOL_HINTS[tool], 'info');
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
      document.querySelectorAll('.plan-tool').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (icon.isRoute) {
        state.overlay.currentIconType = key;
        state.overlay.setTool('draw-arrow');
        showToast(`${icon.name}: click each turn of the path, double-click (or Enter) to finish, Esc to cancel`, 'info');
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

    // Show the original immediately, then reconstruct in the background
    // worker with the progress overlay — the UI never freezes
    state.view = 'original';
    updateViewToggle();

    try {
      await reconstructPlan({ silent: true });

      if (state.vectorPlan && state.vectorPlan.wallCount >= 2) {
        showToast(planSummary(state.vectorPlan) + ' — add your symbols, or refine in the Convert tab', 'success');
      } else {
        showToast('Converted to a traced plan — tune and re-run in the Convert tab', 'info');
      }
    } catch (convErr) {
      console.error('Auto-conversion failed, showing original:', convErr);
      state.cleanPlan = null;
      state.view = 'original';
      updateViewToggle();
      showToast('Floor plan loaded (conversion unavailable — you can still annotate the original)', 'info');
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
  // Overlay already includes annotations, title block, legend, and footer
  ctx.drawImage(overlayCanvas, 0, 0);

  const link = document.createElement('a');
  link.href = out.toDataURL('image/png');
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
