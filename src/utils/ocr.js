/**
 * OCR pipeline: Tesseract.js for images + PDF.js page rendering for PDFs.
 * Produces OCR text (fallback/verification) + a compact image for Nemotron.
 */
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { preprocessForOcr, toModelImage } from './imagePreprocess.js';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

const MAX_PDF_PAGES = 3;

let workerPromise = null;

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng');
      return worker;
    })();
  }
  const worker = await workerPromise;
  return worker;
}

export async function runOcrOnImage(dataUrl, onProgress) {
  const worker = await getWorker(onProgress);
  const result = await worker.recognize(dataUrl, {}, {
    // tesseract.js v5 logger is configured at createWorker; per-call progress omitted
  });
  if (onProgress) onProgress({ status: 'recognizing', progress: 1 });
  const text = result?.data?.text || '';
  const confidence = typeof result?.data?.confidence === 'number' ? Math.round(result.data.confidence) : null;
  return { text: text.trim(), confidence };
}

export async function renderPdfToImages(file, { scale = 2, maxPages = MAX_PDF_PAGES } = {}) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  const count = Math.min(pdf.numPages, maxPages);
  for (let n = 1; n <= count; n += 1) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({ pageNumber: n, dataUrl: canvas.toDataURL('image/jpeg', 0.92), width: canvas.width, height: canvas.height });
    page.cleanup();
  }
  await pdf.destroy();
  return { pages, totalPages: pdf.numPages };
}

/**
 * Full pipeline for one file.
 * Returns { ocrText, ocrConfidence, previewDataUrl, multimodalBase64, mimeType, pages, preprocessMethod }
 */
export async function processFileForOcr(file, { onProgress, usePreprocessing = true } = {}) {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const emit = (msg, progress) => {
    if (onProgress) onProgress({ status: msg, progress });
  };

  if (isPdf) {
    emit('Rendering PDF pages…', 0.1);
    const { pages, totalPages } = await renderPdfToImages(file);
    if (!pages.length) throw new Error('Could not render PDF pages');
    const texts = [];
    let confSum = 0;
    let confCount = 0;
    for (const p of pages) {
      emit(`Running OCR on page ${p.pageNumber}…`, 0.2 + (0.6 * p.pageNumber) / pages.length);
      let target = p.dataUrl;
      let method = 'none';
      if (usePreprocessing) {
        try {
          const pre = await preprocessForOcr(p.dataUrl);
          target = pre.dataUrl;
          method = pre.method;
        } catch {
          // keep original render
        }
      }
      const r = await runOcrOnImage(target, onProgress);
      texts.push(`--- Page ${p.pageNumber} ---\n${r.text}`);
      if (typeof r.confidence === 'number') {
        confSum += r.confidence;
        confCount += 1;
      }
      if (p.pageNumber === 1) {
        var firstMethod = method;
      }
    }
    emit('Compressing image for AI…', 0.9);
    const model = await toModelImage(pages[0].dataUrl);
    return {
      ocrText: texts.join('\n\n').trim(),
      ocrConfidence: confCount ? Math.round(confSum / confCount) : null,
      previewDataUrl: pages[0].dataUrl,
      multimodalBase64: model.base64,
      mimeType: 'image/jpeg',
      pages: totalPages,
      truncatedPages: totalPages > pages.length,
      preprocessMethod: firstMethod || 'none',
    };
  }

  // Image path
  emit('Reading image…', 0.1);
  const original = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
  let ocrTarget = original;
  let method = 'none';
  if (usePreprocessing) {
    emit('Preprocessing image…', 0.3);
    try {
      const pre = await preprocessForOcr(original);
      ocrTarget = pre.dataUrl;
      method = pre.method;
    } catch {
      // keep original
    }
  }
  emit('Running OCR…', 0.5);
  const r = await runOcrOnImage(ocrTarget, onProgress);
  emit('Compressing image for AI…', 0.9);
  const model = await toModelImage(original);
  return {
    ocrText: r.text,
    ocrConfidence: r.confidence,
    previewDataUrl: original,
    multimodalBase64: model.base64,
    mimeType: 'image/jpeg',
    pages: 1,
    truncatedPages: false,
    preprocessMethod: method,
  };
}

export async function terminateOcrWorker() {
  if (workerPromise) {
    try {
      const w = await workerPromise;
      await w.terminate();
    } catch {
      // ignore
    }
    workerPromise = null;
  }
}
