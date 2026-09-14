# PRODUCT.md — InvoiceFlow

## Product truth
AI plus OCR invoice capture with human-in-the-loop review: in-browser
Tesseract.js OCR with PDF page rendering (10MB max, 10 files per batch),
Nemotron vision extraction (supplier, number, dates, currency, amounts, line
items) with 0-100 confidence, explicit validation flags (never silent edits),
duplicate scoring, approve/reject with per-invoice event log, CSV/JSON export,
synthetic demo dataset. No accounting sync (no QuickBooks/Xero). English OCR.
Private per-account ledger, sign-in required.
Routes: `/dashboard`, `/register`, `/login`, `/demo`.
Landing anchors (stable): `#top`, `#features`, `#pipeline`, `#faq`.
Primary CTA labels (stable): "Get started" / "Open ledger", "Sign in",
"Try the demo dataset".
