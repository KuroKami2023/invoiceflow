-- ============================================================
-- InvoiceFlow AI — Supabase PostgreSQL schema + RLS
-- SHARED-PROJECT SAFE: all 5 portfolio apps share ONE Supabase project.
-- Run in: Supabase Dashboard → SQL Editor (paste + Run). Safe in ANY order.
-- NOTE: processing history lives in invoice_processing_runs (NOT the generic
-- `processing_runs`, which collides with DocLens AI's document table).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- profiles (SHARED across all 5 apps — DO NOT diverge) ----------
-- InvoiceFlow has no profile UI, but the shared auth trigger needs the table
-- to exist with the superset shape so signups never fail.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text default '',
  headline text default '',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text default '';
alter table public.profiles add column if not exists headline text default '';
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- ---------- Tables ----------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text,
  original_filename text,
  supplier text default '',
  invoice_number text default '',
  invoice_date date,
  due_date date,
  currency text default '',
  subtotal numeric(14,2),
  tax numeric(14,2),
  tax_rate numeric(7,3),
  total numeric(14,2),
  purchase_order text,
  payment_terms text,
  raw_ocr_text text,
  ai_extraction jsonb default '{}'::jsonb,
  confidence integer default 0 check (confidence >= 0 and confidence <= 100),
  status text not null default 'needs_review'
    check (status in ('uploaded','processing','needs_review','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text default '',
  quantity numeric(14,4),
  unit_price numeric(14,4),
  tax numeric(14,2),
  total numeric(14,2)
);
create index if not exists idx_line_items_invoice on public.invoice_line_items(invoice_id);

create table if not exists public.invoice_processing_runs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  processing_type text not null default 'ai_extraction'
    check (processing_type in ('ai_extraction','ocr_only','reprocess','demo')),
  status text not null default 'started'
    check (status in ('started','succeeded','failed')),
  duration_ms integer,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists idx_invoice_runs_invoice on public.invoice_processing_runs(invoice_id);

-- One-time migration for DBs created before the shared-project rename:
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'processing_runs')
     and exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'processing_runs'
               and column_name = 'invoice_id') then
    insert into public.invoice_processing_runs
      (id, invoice_id, processing_type, status, duration_ms, error_message, created_at)
    select id, invoice_id, processing_type, status, duration_ms, error_message, created_at
    from public.processing_runs
    on conflict (id) do nothing;
  end if;
end $$;

create table if not exists public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (event_type in ('created','processed','approved','rejected','updated','reprocessed','exported','deleted')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_events_invoice on public.invoice_events(invoice_id);

create index if not exists idx_invoices_user on public.invoices(user_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_supplier on public.invoices(supplier);
create index if not exists idx_invoices_number on public.invoices(invoice_number);
create index if not exists idx_invoices_date on public.invoices(invoice_date);

-- ---------- updated_at trigger ----------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ---------- auto-create profile on signup (SHARED — identical in all 5 schemas) ----------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.invoice_processing_runs enable row level security;
alter table public.invoice_events enable row level security;

-- profiles: own row only (shared table — same policies as the other 4 apps)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- invoices: users access only their own rows
drop policy if exists "invoices_select_own" on public.invoices;
create policy "invoices_select_own" on public.invoices
  for select using (auth.uid() = user_id);

drop policy if exists "invoices_insert_own" on public.invoices;
create policy "invoices_insert_own" on public.invoices
  for insert with check (auth.uid() = user_id);

drop policy if exists "invoices_update_own" on public.invoices;
create policy "invoices_update_own" on public.invoices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "invoices_delete_own" on public.invoices;
create policy "invoices_delete_own" on public.invoices
  for delete using (auth.uid() = user_id);

-- line items: access follows parent invoice ownership
drop policy if exists "line_items_select_own" on public.invoice_line_items;
create policy "line_items_select_own" on public.invoice_line_items
  for select using (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );

drop policy if exists "line_items_insert_own" on public.invoice_line_items;
create policy "line_items_insert_own" on public.invoice_line_items
  for insert with check (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );

drop policy if exists "line_items_update_own" on public.invoice_line_items;
create policy "line_items_update_own" on public.invoice_line_items
  for update using (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );

drop policy if exists "line_items_delete_own" on public.invoice_line_items;
create policy "line_items_delete_own" on public.invoice_line_items
  for delete using (
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );

-- invoice_processing_runs: readable/insertable via owned invoice
drop policy if exists "invoice_runs_select_own" on public.invoice_processing_runs;
create policy "invoice_runs_select_own" on public.invoice_processing_runs
  for select using (
    invoice_id is null or
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );

drop policy if exists "invoice_runs_insert_own" on public.invoice_processing_runs;
create policy "invoice_runs_insert_own" on public.invoice_processing_runs
  for insert with check (
    invoice_id is null or
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );

-- invoice_events: same ownership pattern
drop policy if exists "events_select_own" on public.invoice_events;
create policy "events_select_own" on public.invoice_events
  for select using (
    invoice_id is null or
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );

drop policy if exists "events_insert_own" on public.invoice_events;
create policy "events_insert_own" on public.invoice_events
  for insert with check (
    invoice_id is null or
    exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid())
  );

-- ---------- Storage ----------
-- Storage lives in supabase/storage.sql (same folder). Run that file after
-- this one — it creates the PRIVATE `invoices` bucket and the
-- bucket-prefixed policies (shared-project safe).
-- File layout convention used by the app:  invoices/<user_id>/<invoice_id>/<filename>
