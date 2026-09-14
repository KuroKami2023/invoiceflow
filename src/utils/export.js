/** CSV + JSON export helpers. */

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function invoicesToCsv(invoices = []) {
  const header = [
    'id',
    'supplier',
    'invoice_number',
    'invoice_date',
    'due_date',
    'currency',
    'subtotal',
    'tax',
    'tax_rate',
    'total',
    'purchase_order',
    'payment_terms',
    'confidence',
    'status',
    'validation_flags',
    'created_at',
  ];
  const lines = [header.join(',')];
  for (const inv of invoices) {
    lines.push(
      [
        inv.id,
        inv.supplier,
        inv.invoice_number,
        inv.invoice_date,
        inv.due_date,
        inv.currency,
        inv.subtotal,
        inv.tax,
        inv.tax_rate,
        inv.total,
        inv.purchase_order,
        inv.payment_terms,
        inv.confidence,
        inv.status,
        Array.isArray(inv.ai_extraction?.validation_flags)
          ? inv.ai_extraction.validation_flags.join('|')
          : '',
        inv.created_at,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}

export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportInvoicesCsv(invoices) {
  downloadFile(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, invoicesToCsv(invoices), 'text/csv');
}

export function exportInvoicesJson(invoices) {
  downloadFile(
    `invoices-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(invoices, null, 2),
    'application/json',
  );
}
