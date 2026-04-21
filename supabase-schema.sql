-- ═══════════════════════════════════════════════════════
--  BLOOMENEUR CRM — Schema para Supabase
--  Copia y pega este SQL en: Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════

-- 1. TABLA DE LEADS
create table if not exists leads (
  id           uuid default gen_random_uuid() primary key,
  sheet_id     text unique,                    -- ID único del lead en META/Sheets
  created_at   timestamptz default now(),
  full_name    text not null,
  email        text,
  phone        text,
  source       text default 'META',            -- META | Shopify | Manual
  platform     text,                           -- fb | ig | sh
  intent       text,
  timeline     text,
  ad_name      text,
  status       text default 'New',             -- New | Hot | Maybe | Customer | Lost
  assigned_to  text,                           -- email del CS asignado
  notes        text,
  touches      jsonb default '[]'::jsonb       -- historial de contactos
);

-- 2. TABLA DE CONTACTOS (historial de cada toque)
create table if not exists contact_log (
  id          uuid default gen_random_uuid() primary key,
  lead_id     uuid references leads(id) on delete cascade,
  created_at  timestamptz default now(),
  type        text not null,     -- call | sms | mail
  result      text not null,     -- Answered | No answer | Voicemail | Sent
  cs_name     text,
  cs_email    text,
  note        text,
  date        date default current_date
);

-- 3. ROW LEVEL SECURITY — cada CS solo ve sus leads
alter table leads       enable row level security;
alter table contact_log enable row level security;

-- CS ve sus leads asignados
create policy "cs_own_leads" on leads
  for all using (assigned_to = auth.jwt()->>'email');

-- Admin (manager) ve todo
create policy "admin_all_leads" on leads
  for all using (auth.jwt()->>'role' = 'admin');

-- CS ve los contact_log de sus leads
create policy "cs_own_logs" on contact_log
  for all using (
    exists (
      select 1 from leads
      where leads.id = contact_log.lead_id
      and leads.assigned_to = auth.jwt()->>'email'
    )
  );

create policy "admin_all_logs" on contact_log
  for all using (auth.jwt()->>'role' = 'admin');

-- 4. ÍNDICES para performance
create index if not exists leads_assigned_to_idx on leads(assigned_to);
create index if not exists leads_status_idx      on leads(status);
create index if not exists leads_sheet_id_idx    on leads(sheet_id);
create index if not exists logs_lead_id_idx      on contact_log(lead_id);

-- 5. REALTIME — activa cambios en vivo
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table contact_log;

-- ═══════════════════════════════════════════════════════
--  USUARIOS — Crear en Supabase → Authentication → Users
--  Luego actualiza sus metadatos con este SQL:
-- ═══════════════════════════════════════════════════════

-- Actualiza el rol de cada usuario (reemplaza los UUIDs reales)
-- update auth.users set raw_user_meta_data = '{"role":"admin","name":"Manager"}' where email = 'admin@bloomeneur.com';
-- update auth.users set raw_user_meta_data = '{"role":"cs","name":"Jessica"}'  where email = 'jessica@bloomeneur.com';
-- update auth.users set raw_user_meta_data = '{"role":"cs","name":"Marcela"}'  where email = 'marcela@bloomeneur.com';
-- update auth.users set raw_user_meta_data = '{"role":"cs","name":"Sofia"}'    where email = 'sofia@bloomeneur.com';
