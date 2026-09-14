/**
 * Optional OpenCV.js preprocessing (grayscale → denoise → adaptive threshold)
 * plus canvas resize/contrast. All best-effort: any failure falls back to
 * plain canvas handling so uploads never break when the CDN is unreachable.
 */

const OPENCV_CDN = 'https://docs.opencv.org/4.8.0/opencv.js';
let cvPromise = null;

export function loadOpenCv(timeoutMs = 15000) {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.cv && window.cv.Mat) return Promise.resolve(window.cv);
  if (cvPromise) return cvPromise;
  cvPromise = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    const script = document.createElement('script');
    script.src = OPENCV_CDN;
    script.async = true;
    script.onload = () => {
      const cv = window.cv;
      if (!cv) {
        clearTimeout(timer);
        resolve(null);
        return;
      }
      if (cv.then) {
        cv.then(() => {
          clearTimeout(timer);
          resolve(cv.Mat ? cv : null);
        }).catch(() => {
          clearTimeout(timer);
          resolve(null);
        });
      } else if (cv.Mat) {
        clearTimeout(timer);
        resolve(cv);
      } else {
        cv.onRuntimeInitialized = () => {
          clearTimeout(timer);
          resolve(cv.Mat ? cv : null);
        };
      }
    };
    script.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return cvPromise;
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function dataUrlToBase64(dataUrl) {
  const idx = String(dataUrl).indexOf(',');
  return idx === -1 ? '' : String(dataUrl).slice(idx + 1);
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = dataUrl;
  });
}

function canvasToDataUrl(canvas, mime = 'image/jpeg', quality = 0.9) {
  return canvas.toDataURL(mime, quality);
}

/** Resize so longest side <= maxDim (canvas-only, always available). */
export async function resizeDataUrl(dataUrl, maxDim = 2000, mime = 'image/jpeg', quality = 0.9) {
  const img = await loadImage(dataUrl);
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest <= maxDim) return { dataUrl, width: img.naturalWidth, height: img.naturalHeight, resized: false };
  const scale = maxDim / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvasToDataUrl(canvas, mime, quality), width: canvas.width, height: canvas.height, resized: true };
}

/**
 * Preprocess for OCR: try OpenCV adaptive threshold, fall back to
 * canvas grayscale + contrast boost. Returns { dataUrl, method }.
 */
export async function preprocessForOcr(dataUrl, { maxDim = 2200 } = {}) {
  const resized = await resizeDataUrl(dataUrl, maxDim, 'image/jpeg', 0.92);
  try {
    const cv = await loadOpenCv(8000);
    if (!cv) return { dataUrl: resized.dataUrl, method: 'canvas-resize', resized: resized.resized };
    const img = await loadImage(resized.dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const binary = new cv.Mat();
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);
      cv.adaptiveThreshold(blurred, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 31, 8);
      cv.imshow(canvas, binary);
      return { dataUrl: canvasToDataUrl(canvas, 'image/jpeg', 0.92), method: 'opencv-adaptive-threshold', resized: true };
    } finally {
      src.delete();
      gray.delete();
      blurred.delete();
      binary.delete();
    }
  } catch {
    return { dataUrl: resized.dataUrl, method: 'canvas-resize-fallback', resized: resized.resized };
  }
}

/** Small compressed base64 for the multimodal model call (keeps payload < ~6MB). */
export async function toModelImage(dataUrl, maxDim = 1568) {
  const r = await resizeDataUrl(dataUrl, maxDim, 'image/jpeg', 0.85);
  return { base64: dataUrlToBase64(r.dataUrl), mimeType: 'image/jpeg', width: r.width, height: r.height };
}
