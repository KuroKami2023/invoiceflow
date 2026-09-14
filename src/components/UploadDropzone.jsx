import { useRef, useState } from 'react';

export default function UploadDropzone({ onFiles, disabled, multiple = true }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) onFiles(files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={`dropzone-ledger cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 sm:p-10 ${
        dragging
          ? 'border-brand-700 bg-brand-50 shadow-ledger-lg scale-[1.01]'
          : 'border-brass-600/50 bg-white hover:border-brand-700 hover:bg-paper-50 hover:shadow-ledger'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple={multiple}
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
      <div
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full border transition-colors ${
          dragging ? 'border-brand-700 bg-brand-700 text-white' : 'border-brass-600/40 bg-paper-100 text-brand-800'
        }`}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 2.5h7l4.5 4.5V21.5H6V2.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M13 2.5V7.5H17.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9 12.5h6M9 15.5h6M9 18.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="mt-4 font-serif text-lg font-bold text-ink-900">
        {dragging ? 'Release to enter into the ledger' : 'Drag & drop invoices here, or click to browse'}
      </p>
      <p className="tnum mt-1 text-sm text-ink-500">PDF, PNG, JPG, JPEG · up to 10MB each · up to 10 files</p>
      <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-brass-600/40 bg-brass-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-brass-700">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6 3.5v5M3.8 6.2 6 8.5l2.2-2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Private to your account
      </p>
    </div>
  );
}
