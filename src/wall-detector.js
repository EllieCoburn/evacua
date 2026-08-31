// Smart wall detection using edge detection

export class WallDetector {
  constructor(imageProcessor) {
    this.imageProcessor = imageProcessor;
    this.detectedWalls = null;
    this.sensitivity = 0.3;
    this.blurRadius = 2;
  }

  detect() {
    const img = this.imageProcessor.currentImage;
    if (!img) return null;

    // Work at a capped resolution so re-detection stays fast
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const scale = Math.min(1, 1400 / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);

    const gray = this.toGrayscale(imageData.data, w, h);
    const blurred = this.gaussianBlur(gray, w, h, this.blurRadius);
    const edges = this.sobelEdgeDetection(blurred, w, h);
    const thresholded = this.threshold(edges, this.sensitivity);

    // Keep the binary mask for extraction
    this.binary = thresholded;
    this.binWidth = w;
    this.binHeight = h;

    // Visualization: detected walls as semi-transparent red over the plan,
    // everything else fully transparent
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = w;
    wallCanvas.height = h;
    const wallCtx = wallCanvas.getContext('2d');
    const wallImageData = wallCtx.createImageData(w, h);
    const wallData = wallImageData.data;

    for (let i = 0; i < thresholded.length; i++) {
      if (thresholded[i] > 128) {
        wallData[i * 4] = 220;      // R
        wallData[i * 4 + 1] = 38;   // G
        wallData[i * 4 + 2] = 38;   // B
        wallData[i * 4 + 3] = 190;  // A — translucent so the plan shows through
      }
      // else: leave fully transparent
    }

    wallCtx.putImageData(wallImageData, 0, 0);

    this.detectedWalls = wallCanvas;
    return wallCanvas;
  }

  // Turn the detected walls into a clean black-on-white plan canvas
  toPlanCanvas() {
    if (!this.binary) return null;

    const w = this.binWidth;
    const h = this.binHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const out = ctx.createImageData(w, h);
    const od = out.data;

    for (let i = 0; i < this.binary.length; i++) {
      const p = i * 4;
      if (this.binary[i] > 128) {
        od[p] = 26; od[p + 1] = 26; od[p + 2] = 26; od[p + 3] = 255;
      } else {
        od[p] = 255; od[p + 1] = 255; od[p + 2] = 255; od[p + 3] = 255;
      }
    }

    ctx.putImageData(out, 0, 0);
    return canvas;
  }

  clear() {
    this.detectedWalls = null;
    this.binary = null;
  }

  toGrayscale(data, width, height) {
    const gray = new Uint8ClampedArray(width * height);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Luminosity method
      const value = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      gray[i / 4] = value;
    }

    return gray;
  }

  gaussianBlur(data, width, height, radius) {
    const kernel = this.createGaussianKernel(radius);
    const output = new Uint8ClampedArray(width * height);

    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let sum = 0;
        let weight = 0;

        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kIdx = (ky + radius) * (radius * 2 + 1) + (kx + radius);
            
            sum += data[idx] * kernel[kIdx];
            weight += kernel[kIdx];
          }
        }

        output[y * width + x] = Math.round(sum / weight);
      }
    }

    return output;
  }

  createGaussianKernel(radius) {
    const size = radius * 2 + 1;
    const kernel = new Array(size * size);
    const sigma = radius / 2;

    let sum = 0;
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
        kernel[(y + radius) * size + (x + radius)] = value;
        sum += value;
      }
    }

    // Normalize
    for (let i = 0; i < kernel.length; i++) {
      kernel[i] /= sum;
    }

    return kernel;
  }

  sobelEdgeDetection(data, width, height) {
    const edges = new Uint8ClampedArray(width * height);

    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kIdx = (ky + 1) * 3 + (kx + 1);

            gx += data[idx] * sobelX[kIdx];
            gy += data[idx] * sobelY[kIdx];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = Math.min(255, magnitude);
      }
    }

    return edges;
  }

  threshold(data, level) {
    const threshold = Math.round(255 * (1 - level));
    const binary = new Uint8ClampedArray(data.length);

    for (let i = 0; i < data.length; i++) {
      binary[i] = data[i] > threshold ? 255 : 0;
    }

    return binary;
  }

  setSensitivity(value) {
    this.sensitivity = Math.max(0.1, Math.min(0.9, value));
  }

  setBlurRadius(value) {
    this.blurRadius = Math.max(1, Math.min(5, Math.round(value)));
  }

}
