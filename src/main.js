import { Canvas } from './canvas.js';
import { UI } from './ui.js';
import { History } from './history.js';
import { Plans } from './plans.js';
import { ToolManager } from './tools.js';
import { Palette } from './palette.js';
import { initSupabase } from './supabase.js';
import { Auth } from './auth.js';

// Global app state
const state = {
  canvas: null,
  ui: null,
  history: null,
  tools: null,
  palette: null,
  plans: null,
  auth: null,
  supabase: null,
  
  selected: null,
  mode: 'select',
  zoom: 1,
  panX: 0,
  panY: 0,
  grid: true,
  snap: true,
  showDims: true,
  userPlans: [],
};

// Bootstrap the app
async function init() {
  // Create core managers
  state.history = new History();
  state.palette = new Palette();
  state.plans = new Plans(state);
  state.canvas = new Canvas(document.getElementById('stage'), state);
  state.tools = new ToolManager(state);
  state.ui = new UI(state);
  
  // Initialize Supabase
  state.supabase = await initSupabase();
  state.auth = new Auth(state);
  
  // Initialize
  state.canvas.init();
  state.tools.init();
  state.ui.init();
  
  // Try to restore session
  if (state.supabase) {
    await state.auth.restoreSession();
  }
  
  // Wire up global handlers
  setupGlobalHandlers();
  
  // Create a new blank plan
  state.plans.new();
  
  console.log('Evacua initialized');
}

function setupGlobalHandlers() {
  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const isMod = e.ctrlKey || e.metaKey;
    
    switch (true) {
      case isMod && e.key === 'n':
        e.preventDefault();
        handleAction('new');
        break;
      case isMod && e.key === 'o':
        e.preventDefault();
        handleAction('open');
        break;
      case isMod && e.key === 's':
        e.preventDefault();
        handleAction('save');
        break;
      case isMod && e.key === 'z' && !e.shiftKey:
        e.preventDefault();
        handleAction('undo');
        break;
      case isMod && (e.key === 'z' || e.key === 'y') && e.shiftKey:
        e.preventDefault();
        handleAction('redo');
        break;
      case isMod && e.key === 'p':
        e.preventDefault();
        handleAction('print');
        break;
      case e.key === '-' || e.key === '_':
        e.preventDefault();
        handleAction('zoom-out');
        break;
      case e.key === '+' || e.key === '=':
        e.preventDefault();
        handleAction('zoom-in');
        break;
      case e.key === '0':
        e.preventDefault();
        handleAction('zoom-fit');
        break;
      case e.key === 'Escape':
        e.preventDefault();
        state.tools.selectTool('select');
        state.canvas.deselect();
        break;
      case e.key === 'Delete' || e.key === 'Backspace':
        if (state.selected) {
          e.preventDefault();
          state.plans.remove(state.selected);
          state.canvas.deselect();
        }
        break;
    }
  });
  
  // Action buttons
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (btn) {
      const action = btn.dataset.act;
      handleAction(action);
    }
    
    // Auth button
    const authBtn = e.target.closest('[data-auth]');
    if (authBtn) {
      e.preventDefault();
      if (state.supabase?.user) {
        state.auth.signOut();
      } else {
        state.auth.showAuthModal();
      }
    }
  });
  
  // Panel toggles
  document.addEventListener('click', e => {
    if (e.target.matches('[data-tab]')) {
      const tab = e.target.dataset.tab;
      state.ui.showPanel(tab);
    }
  });
  
  // Options checkboxes
  document.getElementById('opt-grid').addEventListener('change', e => {
    state.grid = e.target.checked;
    state.canvas.render();
  });
  
  document.getElementById('opt-snap').addEventListener('change', e => {
    state.snap = e.target.checked;
  });
  
  document.getElementById('opt-dims').addEventListener('change', e => {
    state.showDims = e.target.checked;
    state.canvas.render();
  });
  
  // File input for opening plans
  document.getElementById('file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (file) {
      await state.plans.open(file);
    }
    e.target.value = '';
  });
}

// Main action dispatcher
function handleAction(action) {
  console.log('Action:', action);
  
  switch (action) {
    case 'new':
      if (confirm('Start a new plan? Unsaved changes will be lost.')) {
        state.plans.new();
      }
      break;
      
    case 'templates':
      state.ui.showTemplatesDialog();
      break;
      
    case 'open':
      document.getElementById('file-input').click();
      break;
      
    case 'save':
      if (state.supabase?.user) {
        state.plans.saveToCloud();
      } else {
        state.plans.save();
      }
      break;
      
    case 'undo':
      if (state.history.canUndo()) {
        state.history.undo();
        state.canvas.render();
      }
      break;
      
    case 'redo':
      if (state.history.canRedo()) {
        state.history.redo();
        state.canvas.render();
      }
      break;
      
    case 'print':
      state.canvas.printPDF();
      break;
      
    case 'export':
      state.canvas.exportPNG();
      break;
      
    case 'help':
      state.ui.showHelpDialog();
      break;
      
    case 'zoom-in':
      state.canvas.zoom(state.zoom * 1.25);
      break;
      
    case 'zoom-out':
      state.canvas.zoom(state.zoom / 1.25);
      break;
      
    case 'zoom-fit':
      state.canvas.fitToScreen();
      break;
      
    case 'toggle-left':
      state.ui.togglePanel('left');
      break;
  }
}

// Export for tools
window.app = { state, handleAction };

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
