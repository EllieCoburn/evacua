// Smart wall detection using edge detection

export class WallDetector {
  constructor(imageProcessor) {
    this.imageProcessor = imageProcessor;
    this.detectedWalls = null;
    this.sensitivity = 0.3;
    this.blurRadius = 2;
  }

  detect() {
    if (!this.imageProcessor.currentImage) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = this.imageProcessor.currentImage;

    canvas.width = img.width;
    canvas.height = img.height;

    // Draw image
    ctx.drawImage(img, 0, 0);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale
    const gray = this.toGrayscale(data, canvas.width, canvas.height);

    // Apply blur to reduce noise
    const blurred = this.gaussianBlur(gray, canvas.width, canvas.height, this.blurRadius);

    // Detect edges using Sobel operator
    const edges = this.sobelEdgeDetection(blurred, canvas.width, canvas.height);

    // Threshold to binary
    const thresholded = this.threshold(edges, this.sensitivity);

    // Create visualization canvas
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = canvas.width;
    wallCanvas.height = canvas.height;
    const wallCtx = wallCanvas.getContext('2d');

    const wallImageData = wallCtx.createImageData(canvas.width, canvas.height);
    const wallData = wallImageData.data;

    // Convert thresholded data to RGBA
    for (let i = 0; i < thresholded.length; i++) {
      const value = thresholded[i];
      wallData[i * 4] = value;     // R
      wallData[i * 4 + 1] = value; // G
      wallData[i * 4 + 2] = value; // B
      wallData[i * 4 + 3] = 255;   // A
    }

    wallCtx.putImageData(wallImageData, 0, 0);

    this.detectedWalls = wallCanvas;
    return wallCanvas;
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

  renderDetection(canvas) {
    if (!this.detectedWalls) return;

    const ctx = canvas.getContext('2d');
    ctx.globalAlpha = 0.6;
    ctx.drawImage(this.detectedWalls, 0, 0);
    ctx.globalAlpha = 1;
  }

  extractWallLines() {
    if (!this.detectedWalls) return [];

    // Simple line extraction - find connected components of edges
    const canvas = this.detectedWalls;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const lines = [];
    const visited = new Set();

    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 128 && !visited.has(i)) {
        // Start of an edge
        const line = this.traceEdge(data, canvas.width, canvas.height, i, visited);
        if (line.length > 20) { // Filter out noise
          lines.push(line);
        }
      }
    }

    return lines;
  }

  traceEdge(data, width, height, startIdx, visited) {
    const points = [];
    const stack = [startIdx];
    const pixelWidth = width * 4;

    while (stack.length > 0) {
      const idx = stack.pop();
      
      if (visited.has(idx)) continue;
      visited.add(idx);

      if (data[idx] > 128) {
        const pixelIdx = idx / 4;
        const x = pixelIdx % width;
        const y = Math.floor(pixelIdx / width);
        points.push({ x, y });

        // Check neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = (ny * width + nx) * 4;
              if (!visited.has(nIdx)) {
                stack.push(nIdx);
              }
            }
          }
        }
      }
    }

    return points;
  }
}
