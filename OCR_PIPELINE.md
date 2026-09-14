# OCR PIPELINE

Browser-side OCR provides text for the AI model (and a verification/audit trail).
Code: `src/utils/ocr.js` + `src/utils/imagePreprocess.js`. All free, no keys.

## Stages

```
Upload file
 ├── PDF? → PDF.js render (first 3 pages @ scale 2, white background)
 │           → per page: [optional OpenCV preprocess] → Tesseract.js OCR
 │           → join with "--- Page N ---" markers; page-1 JPEG → model image
 └── Image → FileReader data URL → [optional OpenCV preprocess] → Tesseract.js
             → original resized to ≤1568px JPEG → model image
Output: { ocrText, ocrConfidence, previewDataUrl, multimodalBase64, mimeType,
          pages, truncatedPages, preprocessMethod }
```

## Components

- **PDF.js** (`pdfjs-dist`): renders pages to canvas; worker loaded from the pinned
  `unpkg.com/pdfjs-dist@4.4.168` URL. PDFs beyond 3 pages are OCR'd partially and flagged
  via `truncatedPages` (extendable — the event metadata records page counts).
- **Tesseract.js** (English, in-browser worker, reused across files): returns text +
  mean confidence (0–100). `terminateOcrWorker()` exists for cleanup; the worker is
  otherwise kept warm for batch uploads.
- **OpenCV.js** (optional, CDN `docs.opencv.org/4.8.0/opencv.js`): grayscale → Gaussian
  blur → adaptive Gaussian threshold. Loaded lazily with an 8s cap; **any failure falls
  back to canvas-only resize**, so uploads never break offline or behind blockers.
  The applied method is recorded (`opencv-adaptive-threshold` vs `canvas-resize*`) and
  stored in the `processed` event metadata.
- **Canvas resizing**: longest side ≤2200px for OCR input, ≤1568px JPEG (q0.85) for the
  model image — keeps `/api/process` payloads under the ~6MB guard.

## Confidence and flags

- Mean Tesseract confidence flows to `/api/process` as `ocrConfidence`.
- `< 60` (or very short OCR with no image) adds `OCR_UNCERTAIN` server-side.
- Raw text is persisted per invoice (`raw_ocr_text`) and shown verbatim in review.

## Limits and trade-offs

- Handwriting, photos with glare, and sub-150-DPI scans OCR poorly — the pipeline says so
  (`OCR_UNCERTAIN`, low confidence) instead of guessing.
- Deskew is intentionally light (resize + contrast + threshold); heavy geometric correction
  was impractical without native OpenCV builds and hurt more than it helped on phone photos.
- PDFs are image-rendered even when they contain embedded text (uniform path, no extra
  parser dependency); a future improvement is trying embedded-text extraction first.
