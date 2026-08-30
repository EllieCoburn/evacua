# Evacua — Fire Escape Plan Maker

A user-friendly web application for creating professional fire escape and emergency evacuation plans. Draw clear, printable evacuation maps for offices, childcare centers, retail spaces, and other facilities without needing CAD skills.

## Features

### Drawing Tools
- **Rooms & Spaces** — Draw rectangular areas representing rooms, hallways, and spaces
- **Walls & Obstacles** — Line tool for walls, columns, and other barriers
- **Doors** — Mark regular and emergency exits with rotation support
- **Escape Routes** — Draw highlighted evacuation paths clearly
- **Hazards** — Identify fire, chemical, and electrical hazards
- **Occupants** — Mark where people are located
- **Assembly Points** — Designate emergency meeting areas
- **Labels** — Add text annotations anywhere

### Editing & Refinement
- **Undo/Redo** — Full undo/redo history
- **Grid & Snap** — Precise 1-foot grid with optional snapping
- **Zoom Controls** — Zoom in/out and fit-to-screen
- **Properties Panel** — Edit colors, labels, and object properties
- **Selection Tool** — Click to select and drag to move objects

### Planning & Validation
- **Plan Information** — Store plan name, location, and description
- **Safety Checker** — Built-in checklist validating:
  - Assembly point defined
  - Multiple escape routes
  - Occupant positions marked
  - Hazards identified
- **Print-Ready Output** — Export as PDF or high-quality PNG

### File Management
- **Save/Open** — Store plans as `.evac` files (JSON-based)
- **Templates** — Start from pre-made building layouts (coming soon)
- **Export** — Print, save as PDF, or export as PNG image

## Quick Start

1. Open `index.html` in a modern web browser
2. Click tools on the left to draw your building layout
3. Use the Right panel to edit selected objects
4. Check the Safety Check tab to validate your plan
5. Print or export when ready

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New plan |
| `Ctrl+O` | Open plan |
| `Ctrl+S` | Save plan |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+P` | Print/PDF |
| `+` | Zoom in |
| `−` | Zoom out |
| `0` | Fit to screen |
| `Esc` | Deselect |
| `Delete` | Delete selected |

## Architecture

```
src/
├── main.js          # App bootstrap & action dispatcher
├── canvas.js        # Canvas rendering & interaction
├── shapes.js        # Drawable objects (Rect, Circle, Door, etc.)
├── tools.js         # Drawing tools (Select, Rect, Circle, etc.)
├── ui.js            # UI management & panels
├── history.js       # Undo/redo manager
├── plans.js         # Plan file I/O
└── palette.js       # Color & symbol definitions

styles/
└── app.css          # Complete application styling
```

## File Format

Plans are saved as `.evac` files (JSON format). Example:

```json
{
  "version": 1,
  "name": "Office First Floor",
  "location": "123 Main St, Suite 200",
  "description": "Emergency evacuation plan",
  "createdAt": "2024-08-30T...",
  "objects": [
    {
      "type": "rect",
      "x": 100,
      "y": 100,
      "width": 150,
      "height": 100,
      "label": "Conference Room",
      "fillColor": "#bdc3c7"
    }
  ]
}
```

## Future Enhancements

- [ ] Building templates (office, daycare, retail, etc.)
- [ ] Multiple floors/levels support
- [ ] Measurement tools (distance, area)
- [ ] Symbol library (stairs, elevators, bathrooms, etc.)
- [ ] Collaboration & sharing
- [ ] Mobile-responsive design
- [ ] OCR building import from photos
- [ ] Integration with emergency response systems
- [ ] Animated evacuation simulation

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari 14+
- Requires JavaScript enabled

## License

Created by Evacua. Build smarter emergency plans.

---

**Made for safety.** Evacua helps organizations create clear, professional evacuation plans quickly and easily — because good emergency preparedness saves lives.
