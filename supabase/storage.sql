-- ============================================================
-- InvoiceFlow AI — Supabase Storage (private `invoices` bucket)
-- SHARED-PROJECT SAFE: policy names are bucket-prefixed so they never
-- collide with the other 4 apps' storage policies on storage.objects.
-- Run this whole file in SQL Editor (bucket creation included).
-- (Or Dashboard → Storage → New bucket → name: invoices, PRIVATE,
--  10MB limit, allowed MIME: application/pdf,image/png,image/jpeg,image/webp)
-- File layout used by the app: invoices/<user_id>/<invoice_id>/<filename>
-- ============================================================

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

drop policy if exists "invoices_storage_insert_own" on storage.objects;
create policy "invoices_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "invoices_storage_select_own" on storage.objects;
create policy "invoices_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "invoices_storage_update_own" on storage.objects;
create policy "invoices_storage_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "invoices_storage_delete_own" on storage.objects;
create policy "invoices_storage_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);
