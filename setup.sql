-- MHE Dashboard: shared storage. Paste into Supabase > SQL Editor > Run. Safe to re-run.

create table if not exists public.kv (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.kv enable row level security;

-- Only signed-in users can read or write. Nobody without a login can see anything.
drop policy if exists "kv read"   on public.kv;
drop policy if exists "kv insert" on public.kv;
drop policy if exists "kv update" on public.kv;
create policy "kv read"   on public.kv for select to authenticated using (true);
create policy "kv insert" on public.kv for insert to authenticated with check (true);
create policy "kv update" on public.kv for update to authenticated using (true) with check (true);

-- Live updates between devices
do $$ begin
  alter publication supabase_realtime add table public.kv;
exception when duplicate_object then null;
end $$;
