// Undo/redo manager
export class History {
  constructor() {
    this.states = [];
    this.current = -1;
  }
  
  push(state = null) {
    // Remove any redo history after current position
    this.states = this.states.slice(0, this.current + 1);
    
    // Push new state
    this.states.push(state || Date.now());
    this.current++;
  }
  
  canUndo() {
    return this.current > 0;
  }
  
  canRedo() {
    return this.current < this.states.length - 1;
  }
  
  undo() {
    if (this.canUndo()) {
      this.current--;
    }
  }
  
  redo() {
    if (this.canRedo()) {
      this.current++;
    }
  }
  
  reset() {
    this.states = [];
    this.current = -1;
  }
}
