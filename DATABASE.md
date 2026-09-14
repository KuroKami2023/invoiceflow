# DATABASE

Supabase PostgreSQL (Free tier). Schema source of truth: [supabase/schema.sql](../supabase/schema.sql)
— run it once in Dashboard → SQL Editor.

## Tables

### invoices
One row per uploaded invoice. Ownership: `user_id` → `auth.users(id)`, cascade on delete.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK | owner; all RLS policies key off this |
| `file_path` | text | `invoices/<uid>/<invoiceId>/<file>` in Storage; null for OCR-only rows |
| `original_filename` | text | as uploaded |
| `supplier` | text | `""` when unknown |
| `invoice_number` | text | `""` when unknown |
| `invoice_date` | date | nullable |
| `due_date` | date | nullable |
| `currency` | text | 3-letter ISO or `""` |
| `subtotal`, `tax`, `total` | numeric(14,2) | nullable — never invented |
| `tax_rate` | numeric(7,3) | percent, nullable |
| `purchase_order`, `payment_terms` | text | nullable |
| `raw_ocr_text` | text | full OCR output for audit/verification |
| `ai_extraction` | jsonb | canonical extraction incl. `line_items`, `confidence`, `validation_flags` |
| `confidence` | int 0–100 | check constraint |
| `status` | text | `uploaded\|processing\|needs_review\|approved\|rejected` (default `needs_review`) |
| `created_at`, `updated_at` | timestamptz | `updated_at` via trigger |

### invoice_line_items
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `invoice_id` | uuid FK → invoices | cascade delete |
| `description` | text | |
| `quantity` | numeric(14,4) | nullable |
| `unit_price`, `tax`, `total` | numeric(14,4 / 14,2) | nullable |

### invoice_processing_runs
Audit of every processing attempt: `processing_type` (`ai_extraction|ocr_only|reprocess|demo`),
`status` (`started|succeeded|failed`), `duration_ms`, `error_message` (safe text only), `created_at`.

### invoice_events
Human-readable audit trail: `created|processed|approved|rejected|updated|reprocessed|exported|deleted`
+ `user_id` + `metadata` jsonb + `created_at`.

## Row Level Security

Enabled on all five tables (`profiles` is shared with the other 4 portfolio apps). Core rule: `auth.uid() = user_id` for `invoices`
(select/insert/update/delete each have their own policy). Child tables (`invoice_line_items`,
`invoice_processing_runs`, `invoice_events`) resolve ownership through the parent invoice:

```sql
exists (select 1 from public.invoices i
        where i.id = invoice_id and i.user_id = auth.uid())
```

`invoice_processing_runs` / `invoice_events` also permit `invoice_id is null` for pre-creation logging.
Verified by `tests/authorization.test.js`, which asserts both the helper behavior and that
`schema.sql` contains RLS + the `auth.uid()` rule.

## Storage

- Private bucket **`invoices`** (10MB limit, MIME allow-list
  `application/pdf,image/png,image/jpeg,image/webp`).
- Policies live in `supabase/storage.sql` (run after `schema.sql`): authenticated
  insert/select/update/delete scoped to paths whose first folder equals `auth.uid()`.
- Layout: `invoices/<user_id>/<invoice_id>/<sanitized_filename>`.
- Previews: `storage.from('invoices').download(path)` → object URL (image or PDF iframe).
  No public URLs, no signed-URL sharing. Deletes remove the Storage object best-effort.

## Common queries

Recent invoices for the signed-in user (RLS applies automatically):
```js
await supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(500);
```

Approve:
```js
await supabase.from('invoices').update({ status: 'approved' }).eq('id', id);
await supabase.from('invoice_events').insert({ invoice_id: id, event_type: 'approved', metadata: {} });
```

## Indexes

`invoices(user_id, status, supplier, invoice_number, invoice_date)`,
`invoice_line_items(invoice_id)`, `invoice_processing_runs(invoice_id)`, `invoice_events(invoice_id)`.
