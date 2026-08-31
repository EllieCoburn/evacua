// Image upload and processing

export class ImageProcessor {
  constructor(imageCanvas, overlayCanvas) {
    this.imageCanvas = imageCanvas;
    this.overlayCanvas = overlayCanvas;
    this.imageCtx = imageCanvas.getContext('2d');
    this.overlayCtx = overlayCanvas.getContext('2d');
    
    this.currentImage = null;
    this.detectionOverlay = null; // red wall-highlight canvas, drawn over the image
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.minZoom = 0.1;
    this.maxZoom = 5;
  }

  async loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const dataUrl = e.target.result;
          const img = new Image();

          img.onload = () => {
            try {
              this.currentImage = img;

              console.log('Image loaded, dimensions:', {
                width: img.width,
                height: img.height
              });

              // Get container
              const container = this.imageCanvas.parentElement;
              if (!container) {
                throw new Error('Canvas container not found');
              }

              const containerWidth = container.offsetWidth;
              const containerHeight = container.offsetHeight;

              console.log('Setting canvas to:', {
                width: containerWidth,
                height: containerHeight
              });

              // Set canvas dimensions
              this.imageCanvas.width = containerWidth;
              this.imageCanvas.height = containerHeight;
              this.overlayCanvas.width = containerWidth;
              this.overlayCanvas.height = containerHeight;

              console.log('Canvas dimensions set:', {
                imageCanvas: {
                  width: this.imageCanvas.width,
                  height: this.imageCanvas.height
                },
                overlayCanvas: {
                  width: this.overlayCanvas.width,
                  height: this.overlayCanvas.height
                }
              });

              // Fit and render
              this.fitToScreen();
              this.render();

              console.log('Image rendered successfully');
              resolve(img);
            } catch (err) {
              console.error('Error during image setup:', err);
              reject(err);
            }
          };

          img.onerror = () => {
            console.error('Image failed to load from data URL');
            reject(new Error('Could not load image - file may be corrupted or unsupported'));
          };

          img.src = dataUrl;

          // Timeout if image takes too long to load
          setTimeout(() => {
            if (!img.complete) {
              reject(new Error('Image load timeout - try a smaller file'));
            }
          }, 10000);
        } catch (err) {
          console.error('Error in reader onload:', err);
          reject(err);
        }
      };

      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        reject(new Error('Could not read file - ensure it is a valid image'));
      };

      reader.onprogress = (e) => {
        const percent = Math.round((e.loaded / e.total) * 100);
        console.log(`Loading: ${percent}%`);
      };

      try {
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('Error starting file read:', err);
        reject(new Error('Could not read file'));
      }
    });
  }

  fitToScreen() {
    if (!this.currentImage) return;

    const containerWidth = this.imageCanvas.width;
    const containerHeight = this.imageCanvas.height;
    
    const imgRatio = this.currentImage.width / this.currentImage.height;
    const containerRatio = containerWidth / containerHeight;

    if (imgRatio > containerRatio) {
      this.zoom = (containerWidth * 0.9) / this.currentImage.width;
    } else {
      this.zoom = (containerHeight * 0.9) / this.currentImage.height;
    }

    const scaledWidth = this.currentImage.width * this.zoom;
    const scaledHeight = this.currentImage.height * this.zoom;

    this.panX = (containerWidth - scaledWidth) / 2;
    this.panY = (containerHeight - scaledHeight) / 2;
  }

  zoomIn(factor = 1.25) {
    this.zoom = Math.min(this.zoom * factor, this.maxZoom);
    this.render();
  }

  zoomOut(factor = 1.25) {
    this.zoom = Math.max(this.zoom / factor, this.minZoom);
    this.render();
  }

  pan(dx, dy) {
    this.panX += dx;
    this.panY += dy;
    this.render();
  }

  render() {
    if (!this.currentImage) return;

    const width = this.imageCanvas.width;
    const height = this.imageCanvas.height;

    // Clear canvases
    this.imageCtx.clearRect(0, 0, width, height);

    // Draw image
    const scaledWidth = this.currentImage.width * this.zoom;
    const scaledHeight = this.currentImage.height * this.zoom;

    this.imageCtx.drawImage(
      this.currentImage,
      this.panX,
      this.panY,
      scaledWidth,
      scaledHeight
    );

    // Wall-detection highlight, drawn with the same transform as the image
    // so it stays aligned at any zoom/pan
    if (this.detectionOverlay) {
      this.imageCtx.drawImage(
        this.detectionOverlay,
        this.panX,
        this.panY,
        scaledWidth,
        scaledHeight
      );
    }

    // Draw grid if needed
    this.drawGrid();
  }

  drawGrid() {
    if (!this.imageCtx) return;

    const gridSize = 20;
    const width = this.imageCanvas.width;
    const height = this.imageCanvas.height;

    this.imageCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.imageCtx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x < width; x += gridSize) {
      this.imageCtx.beginPath();
      this.imageCtx.moveTo(x, 0);
      this.imageCtx.lineTo(x, height);
      this.imageCtx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < height; y += gridSize) {
      this.imageCtx.beginPath();
      this.imageCtx.moveTo(0, y);
      this.imageCtx.lineTo(width, y);
      this.imageCtx.stroke();
    }
  }

  canvasToImageCoords(canvasX, canvasY) {
    const imageX = (canvasX - this.panX) / this.zoom;
    const imageY = (canvasY - this.panY) / this.zoom;

    return { imageX, imageY };
  }

  imageToCanvasCoords(imageX, imageY) {
    const canvasX = imageX * this.zoom + this.panX;
    const canvasY = imageY * this.zoom + this.panY;
    return { canvasX, canvasY };
  }

  exportPNG() {
    if (!this.currentImage) return null;

    // Create temporary canvas with merged content
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.imageCanvas.width;
    tempCanvas.height = this.imageCanvas.height;

    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this.imageCanvas, 0, 0);
    tempCtx.drawImage(this.overlayCanvas, 0, 0);

    return tempCanvas.toDataURL('image/png');
  }
}
