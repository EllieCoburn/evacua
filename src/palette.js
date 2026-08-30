// Color and style palette
export class Palette {
  constructor() {
    this.colors = {
      primary: '#e74c3c',
      success: '#27ae60',
      warning: '#f39c12',
      info: '#3498db',
      dark: '#2c3e50',
      light: '#ecf0f1',
    };
    
    this.symbols = {
      rect: { label: 'Room', color: '#bdc3c7' },
      circle: { label: 'Column', color: '#95a5a6' },
      door: { label: 'Door', color: '#34495e' },
      person: { label: 'Person', color: '#3498db' },
      assembly: { label: 'Assembly Point', color: '#f39c12' },
      hazard: { label: 'Hazard', color: '#e74c3c' },
      escape: { label: 'Escape Route', color: '#e74c3c' },
    };
  }
  
  getColor(key) {
    return this.colors[key] || '#000';
  }
  
  getSymbol(key) {
    return this.symbols[key] || { label: 'Unknown', color: '#999' };
  }
}
