-- =============================================================================
-- NOVALIUS · 0003 · Nova, tarifas, presupuestos, leads/CRM, clientes y proyectos
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Nova: configuración (fila única) y base de conocimiento
-- -----------------------------------------------------------------------------
create table public.chatbot_settings (
  id         smallint primary key default 1 check (id = 1),
  config     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create trigger chatbot_settings_touch before update on public.chatbot_settings
  for each row execute function public.touch_updated_at();
create trigger audit_chatbot_settings after insert or update or delete on public.chatbot_settings
  for each row execute function public.audit_trigger();

create table public.chatbot_knowledge (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 1 and 160),
  category   text not null default 'general',
  content    text not null check (char_length(content) between 1 and 8000),
  is_active  boolean not null default true,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create index chatbot_knowledge_active_idx on public.chatbot_knowledge(is_active, position);
create trigger chatbot_knowledge_touch before update on public.chatbot_knowledge
  for each row execute function public.touch_updated_at();
create trigger audit_chatbot_knowledge after insert or update or delete on public.chatbot_knowledge
  for each row execute function public.audit_trigger();

-- Configuración pública de Nova (nunca expone instrucciones internas)
create or replace function public.get_public_nova_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', coalesce(config ->> 'name', 'Nova'),
    'avatar_url', coalesce(config ->> 'avatar_url', ''),
    'welcome_message', coalesce(config ->> 'welcome_message', ''),
    'starter_questions', coalesce(config -> 'starter_questions', '[]'::jsonb),
    'ai_disclosure', coalesce(config ->> 'ai_disclosure', ''),
    'business_hours', coalesce(config -> 'business_hours', '{}'::jsonb),
    'enabled', coalesce((config ->> 'enabled')::boolean, true),
    'allow_attachments', false
  )
  from public.chatbot_settings where id = 1;
$$;

-- -----------------------------------------------------------------------------
-- Conversaciones y mensajes (escritura exclusiva desde la API)
-- -----------------------------------------------------------------------------
create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete set null,
  access_hash      text not null,
  channel          text not null default 'web' check (channel in ('web', 'contact', 'admin_test')),
  mode             text not null default 'ai' check (mode in ('ai', 'guided')),
  status           text not null default 'open' check (status in ('open', 'closed', 'handoff', 'blocked')),
  title            text not null default '',
  summary          text not null default '',
  lead_id          uuid,
  quote_id         uuid,
  guided_state     jsonb not null default '{}'::jsonb,
  metadata         jsonb not null default '{}'::jsonb,
  message_count    integer not null default 0,
  tokens_in        integer not null default 0,
  tokens_out       integer not null default 0,
  ip_hash          text not null default '',
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index conversations_user_idx on public.conversations(user_id, last_message_at desc);
create index conversations_last_idx on public.conversations(last_message_at desc);
create index conversations_status_idx on public.conversations(status);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system', 'event')),
  content         text not null default '',
  payload         jsonb not null default '{}'::jsonb,
  api_content     jsonb,
  tokens_in       integer not null default 0,
  tokens_out      integer not null default 0,
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- Tarifas: reglas de cálculo editables y referencias de mercado con procedencia
-- -----------------------------------------------------------------------------
create table public.pricing_rules (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z0-9_]+$'),
  category    text not null check (category in ('base', 'page', 'feature', 'complexity', 'design', 'timeline', 'maintenance', 'margin', 'discount', 'limit')),
  label       text not null check (char_length(label) between 1 and 120),
  description text not null default '',
  unit        text not null check (unit in ('fixed', 'per_unit', 'multiplier', 'percent', 'monthly')),
  min_amount  numeric(12, 2) not null default 0 check (min_amount >= 0),
  max_amount  numeric(12, 2) not null default 0 check (max_amount >= min_amount),
  value       numeric(8, 4) not null default 1 check (value >= 0),
  applies_to  text[] not null default '{}',
  is_active   boolean not null default true,
  position    integer not null default 0,
  metadata    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);
create index pricing_rules_category_idx on public.pricing_rules(category, position);
create trigger pricing_rules_touch before update on public.pricing_rules
  for each row execute function public.touch_updated_at();
create trigger audit_pricing_rules after insert or update or delete on public.pricing_rules
  for each row execute function public.audit_trigger();

create table public.pricing_references (
  id           uuid primary key default gen_random_uuid(),
  source_name  text not null check (char_length(source_name) between 2 and 160),
  source_url   text not null default '' check (source_url = '' or source_url ~* '^https?://'),
  retrieved_at date not null,
  project_type text not null default 'web',
  min_amount   numeric(12, 2) check (min_amount >= 0),
  max_amount   numeric(12, 2) check (max_amount >= 0),
  summary      text not null default '',
  is_active    boolean not null default true,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create trigger audit_pricing_references after insert or update or delete on public.pricing_references
  for each row execute function public.audit_trigger();

-- -----------------------------------------------------------------------------
-- Presupuestos orientativos (calculados SIEMPRE en servidor)
-- -----------------------------------------------------------------------------
create type public.quote_status as enum ('estimate', 'saved', 'proposal_requested', 'sent', 'accepted', 'rejected', 'expired');

create table public.quotes (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique,
  user_id         uuid references public.profiles(id) on delete set null,
  claim_hash      text,
  conversation_id uuid references public.conversations(id) on delete set null,
  lead_id         uuid,
  status          public.quote_status not null default 'estimate',
  project_type    text not null,
  title           text not null default '',
  requirements    jsonb not null default '{}'::jsonb,
  total_min       numeric(12, 2) not null check (total_min >= 0),
  total_max       numeric(12, 2) not null check (total_max >= total_min),
  monthly_min     numeric(12, 2) not null default 0,
  monthly_max     numeric(12, 2) not null default 0,
  currency        text not null default 'EUR',
  factors         jsonb not null default '[]'::jsonb,
  included        jsonb not null default '[]'::jsonb,
  optional        jsonb not null default '[]'::jsonb,
  disclaimer      text not null default '',
  references_used jsonb not null default '[]'::jsonb,
  rules_snapshot  jsonb not null default '{}'::jsonb,
  source          text not null default 'nova' check (source in ('nova', 'form', 'admin')),
  valid_until     date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index quotes_user_idx on public.quotes(user_id, created_at desc);
create index quotes_created_idx on public.quotes(created_at desc);
create trigger quotes_touch before update on public.quotes
  for each row execute function public.touch_updated_at();

create table public.quote_items (
  id         uuid primary key default gen_random_uuid(),
  quote_id   uuid not null references public.quotes(id) on delete cascade,
  kind       text not null check (kind in ('base', 'page', 'feature', 'design', 'complexity', 'timeline', 'maintenance', 'margin', 'discount', 'optional')),
  rule_key   text not null default '',
  label      text not null,
  detail     text not null default '',
  quantity   numeric(10, 2) not null default 1,
  min_amount numeric(12, 2) not null,
  max_amount numeric(12, 2) not null,
  is_optional boolean not null default false,
  position   integer not null default 0
);
create index quote_items_quote_idx on public.quote_items(quote_id, position);

-- -----------------------------------------------------------------------------
-- CRM: leads, notas y eventos (historial)
-- -----------------------------------------------------------------------------
create type public.lead_status as enum ('new', 'contacted', 'negotiation', 'won', 'lost');

create table public.leads (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 1 and 120),
  company           text not null default '' check (char_length(company) <= 160),
  email             extensions.citext not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone             text not null default '' check (char_length(phone) <= 40),
  whatsapp_opt_in   boolean not null default false,
  project_type      text not null default '',
  needs             text not null default '' check (char_length(needs) <= 6000),
  budget_range      text not null default '',
  timeline          text not null default '',
  estimated_min     numeric(12, 2),
  estimated_max     numeric(12, 2),
  quote_id          uuid references public.quotes(id) on delete set null,
  conversation_id   uuid references public.conversations(id) on delete set null,
  user_id           uuid references public.profiles(id) on delete set null,
  source            text not null default 'contact_form' check (source in ('nova', 'contact_form', 'quote', 'template', 'challenge', 'manual')),
  source_detail     text not null default '',
  status            public.lead_status not null default 'new',
  assigned_to       uuid references public.profiles(id) on delete set null,
  lost_reason       text not null default '',
  final_value       numeric(12, 2),
  consent_at        timestamptz,
  consent_version   text not null default '',
  utm               jsonb not null default '{}'::jsonb,
  last_contacted_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index leads_status_idx on public.leads(status, created_at desc);
create index leads_assigned_idx on public.leads(assigned_to);
create index leads_email_idx on public.leads(email);
create index leads_created_idx on public.leads(created_at desc);
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

alter table public.quotes add constraint quotes_lead_fk foreign key (lead_id) references public.leads(id) on delete set null;
alter table public.conversations add constraint conversations_lead_fk foreign key (lead_id) references public.leads(id) on delete set null;
alter table public.conversations add constraint conversations_quote_fk foreign key (quote_id) references public.quotes(id) on delete set null;

create table public.lead_notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null default auth.uid(),
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index lead_notes_lead_idx on public.lead_notes(lead_id, created_at desc);

create table public.lead_events (
  id         bigint generated always as identity primary key,
  lead_id    uuid not null references public.leads(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  type       text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index lead_events_lead_idx on public.lead_events(lead_id, created_at desc);

create or replace function public.track_lead_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.lead_events (lead_id, actor_id, type, data)
    values (new.id, v_actor, 'created', jsonb_build_object('source', new.source, 'status', new.status));
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.lead_events (lead_id, actor_id, type, data)
    values (new.id, v_actor, 'status_changed', jsonb_build_object('from', old.status, 'to', new.status));
    if new.status = 'contacted' and new.last_contacted_at is null then
      new.last_contacted_at := now();
    end if;
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.lead_events (lead_id, actor_id, type, data)
    values (new.id, v_actor, 'assigned', jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to));
  end if;
  if (to_jsonb(new) - array['status', 'assigned_to', 'updated_at', 'last_contacted_at'])
     is distinct from (to_jsonb(old) - array['status', 'assigned_to', 'updated_at', 'last_contacted_at']) then
    insert into public.lead_events (lead_id, actor_id, type, data)
    values (new.id, v_actor, 'updated', '{}'::jsonb);
  end if;
  return new;
end;
$$;
create trigger leads_track_insert after insert on public.leads
  for each row execute function public.track_lead_changes();
create trigger leads_track_update before update on public.leads
  for each row execute function public.track_lead_changes();

create or replace function public.track_lead_notes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lead_events (lead_id, actor_id, type, data)
  values (new.lead_id, (select auth.uid()), 'note', jsonb_build_object('note_id', new.id));
  return new;
end;
$$;
create trigger lead_notes_track after insert on public.lead_notes
  for each row execute function public.track_lead_notes();

-- -----------------------------------------------------------------------------
-- Clientes y proyectos de cliente (portal privado)
-- -----------------------------------------------------------------------------
create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references public.profiles(id) on delete set null,
  lead_id      uuid references public.leads(id) on delete set null,
  name         text not null check (char_length(name) between 1 and 160),
  contact_name text not null default '',
  email        extensions.citext not null,
  phone        text not null default '',
  tax_id       text not null default '',
  notes        text not null default '',
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index customers_email_idx on public.customers(email);
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();
create trigger audit_customers after insert or update or delete on public.customers
  for each row execute function public.audit_trigger();

create type public.project_status as enum ('planning', 'in_progress', 'review', 'completed', 'paused', 'cancelled');

create table public.customer_projects (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers(id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 160),
  description       text not null default '',
  status            public.project_status not null default 'planning',
  progress          smallint not null default 0 check (progress between 0 and 100),
  start_date        date,
  due_date          date,
  quote_id          uuid references public.quotes(id) on delete set null,
  visible_to_client boolean not null default true,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index customer_projects_customer_idx on public.customer_projects(customer_id);
create index customer_projects_status_idx on public.customer_projects(status);
create trigger customer_projects_touch before update on public.customer_projects
  for each row execute function public.touch_updated_at();
create trigger audit_customer_projects after insert or update or delete on public.customer_projects
  for each row execute function public.audit_trigger();

create table public.project_phases (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.customer_projects(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  status      text not null default 'pending' check (status in ('pending', 'active', 'done')),
  start_date  date,
  due_date    date,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index project_phases_project_idx on public.project_phases(project_id, position);

create table public.project_tasks (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.customer_projects(id) on delete cascade,
  phase_id          uuid references public.project_phases(id) on delete set null,
  title             text not null check (char_length(title) between 1 and 200),
  description       text not null default '',
  status            text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  assignee_id       uuid references public.profiles(id) on delete set null,
  due_date          date,
  visible_to_client boolean not null default true,
  position          integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index project_tasks_project_idx on public.project_tasks(project_id, position);
create trigger project_tasks_touch before update on public.project_tasks
  for each row execute function public.touch_updated_at();

create table public.project_files (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.customer_projects(id) on delete cascade,
  storage_path      text not null unique,
  file_name         text not null,
  mime_type         text not null,
  size_bytes        bigint not null check (size_bytes > 0),
  visible_to_client boolean not null default true,
  uploaded_by       uuid references auth.users(id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now()
);
create index project_files_project_idx on public.project_files(project_id, created_at desc);

create table public.project_updates (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.customer_projects(id) on delete cascade,
  author_id         uuid references public.profiles(id) on delete set null default auth.uid(),
  body              text not null check (char_length(body) between 1 and 4000),
  visible_to_client boolean not null default true,
  created_at        timestamptz not null default now()
);
create index project_updates_project_idx on public.project_updates(project_id, created_at desc);

-- ¿El usuario actual es el cliente propietario del proyecto?
create or replace function public.is_project_client(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.customer_projects cp
    join public.customers c on c.id = cp.customer_id
    where cp.id = p_project_id
      and cp.visible_to_client
      and c.user_id = (select auth.uid())
  );
$$;

-- Conversión de lead en cliente (y alta de rol customer si tiene cuenta)
create or replace function public.convert_lead_to_customer(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads;
  v_customer uuid;
  v_user uuid;
begin
  if not (public.has_permission('crm.write') and public.has_permission('customers.manage')) then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  select * into v_lead from public.leads where id = p_lead_id;
  if v_lead.id is null then
    raise exception 'Lead no encontrado' using errcode = 'P0002';
  end if;

  v_user := coalesce(v_lead.user_id, (select id from public.profiles where email = v_lead.email limit 1));

  select id into v_customer from public.customers
   where (v_user is not null and user_id = v_user) or lead_id = p_lead_id
   limit 1;

  if v_customer is null then
    insert into public.customers (user_id, lead_id, name, contact_name, email, phone, created_by)
    values (v_user, v_lead.id, coalesce(nullif(v_lead.company, ''), v_lead.name), v_lead.name,
            v_lead.email, v_lead.phone, (select auth.uid()))
    returning id into v_customer;
  end if;

  if v_user is not null then
    insert into public.user_roles (user_id, role) values (v_user, 'customer') on conflict do nothing;
  end if;

  update public.leads set status = 'won' where id = p_lead_id and status <> 'won';
  insert into public.lead_events (lead_id, actor_id, type, data)
  values (p_lead_id, (select auth.uid()), 'converted', jsonb_build_object('customer_id', v_customer));
  return v_customer;
end;
$$;

-- Vincular un cliente existente a una cuenta de usuario
create or replace function public.link_customer_account(p_customer_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('customers.manage') then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  update public.customers set user_id = p_user_id where id = p_customer_id;
  if p_user_id is not null then
    insert into public.user_roles (user_id, role) values (p_user_id, 'customer') on conflict do nothing;
  end if;
end;
$$;
