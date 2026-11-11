-- =============================================================================
-- NOVALIUS · 0001 · Núcleo: extensiones, roles, permisos, perfiles y utilidades
-- =============================================================================
-- Principios:
--   * Los roles NUNCA se leen del navegador: viven en public.user_roles y solo
--     se consultan con funciones SECURITY DEFINER evaluadas en el servidor.
--   * Mínimo privilegio: cada tabla revoca los permisos por defecto y concede
--     solo lo necesario (ver 0007_security.sql).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('user', 'customer', 'team', 'admin');

-- -----------------------------------------------------------------------------
-- Utilidad: updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfiles (1:1 con auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            extensions.citext not null,
  full_name        text not null default '' check (char_length(full_name) <= 120),
  company          text not null default '' check (char_length(company) <= 160),
  phone            text not null default '' check (char_length(phone) <= 40),
  avatar_url       text not null default '' check (char_length(avatar_url) <= 500),
  locale           text not null default 'es' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  marketing_opt_in boolean not null default false,
  is_disabled      boolean not null default false,
  last_seen_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index profiles_email_idx on public.profiles(email);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Roles y permisos
-- -----------------------------------------------------------------------------
create table public.roles (
  key         public.app_role primary key,
  name        text not null,
  description text not null default '',
  rank        smallint not null unique
);

create table public.permissions (
  key         text primary key check (key ~ '^[a-z]+(\.[a-z_]+)+$'),
  "group"     text not null,
  description text not null
);

create table public.role_permissions (
  role       public.app_role not null references public.roles(key) on delete cascade,
  permission text not null references public.permissions(key) on delete cascade,
  primary key (role, permission)
);

create table public.user_roles (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.app_role not null references public.roles(key),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index user_roles_role_idx on public.user_roles(role);

-- -----------------------------------------------------------------------------
-- Funciones de autorización (evaluadas en servidor, nunca en el cliente)
-- -----------------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = (select auth.uid())
      and ur.role = p_role
      and not p.is_disabled
  );
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id and not p.is_disabled
    left join public.role_permissions rp
      on rp.role = ur.role and rp.permission = p_permission
    where ur.user_id = (select auth.uid())
      and (ur.role = 'admin' or rp.permission is not null)
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('team') or public.has_role('admin');
$$;

-- Permisos efectivos del usuario actual (para pintar la interfaz; el servidor
-- vuelve a comprobarlos siempre).
create or replace function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', (select auth.uid()),
    'roles', coalesce((
      select jsonb_agg(ur.role order by r.rank)
      from public.user_roles ur join public.roles r on r.key = ur.role
      where ur.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'permissions', case
      when public.has_role('admin') then (select coalesce(jsonb_agg(key order by key), '[]'::jsonb) from public.permissions)
      else coalesce((
        select jsonb_agg(distinct rp.permission)
        from public.user_roles ur
        join public.role_permissions rp on rp.role = ur.role
        join public.profiles p on p.id = ur.user_id and not p.is_disabled
        where ur.user_id = (select auth.uid())
      ), '[]'::jsonb)
    end
  );
$$;

-- -----------------------------------------------------------------------------
-- Alta automática de perfil y rol base al registrarse
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, company)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    left(coalesce(new.raw_user_meta_data ->> 'company', ''), 160)
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantener el email del perfil sincronizado con Auth
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Protecciones de roles
--   * Solo un administrador puede conceder o retirar el rol admin.
--   * No se puede retirar el último administrador.
--   * Nadie puede modificar sus propios roles desde la API.
-- -----------------------------------------------------------------------------
create or replace function public.guard_user_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_role public.app_role := coalesce(new.role, old.role);
  v_user uuid := coalesce(new.user_id, old.user_id);
begin
  -- Operaciones internas (service_role / migraciones) no tienen auth.uid()
  if v_actor is null then
    return coalesce(new, old);
  end if;

  if v_user = v_actor then
    raise exception 'No puedes modificar tus propios roles' using errcode = '42501';
  end if;

  if v_role = 'admin' and not public.has_role('admin') then
    raise exception 'Solo un administrador puede gestionar el rol de administrador' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' and old.role = 'admin' then
    if (select count(*) from public.user_roles where role = 'admin') <= 1 then
      raise exception 'No se puede retirar el último administrador' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.granted_by := v_actor;
    new.granted_at := now();
  end if;

  return coalesce(new, old);
end;
$$;

create trigger user_roles_guard
  before insert or update or delete on public.user_roles
  for each row execute function public.guard_user_roles();

-- -----------------------------------------------------------------------------
-- Auditoría genérica
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  old_data    jsonb,
  new_data    jsonb,
  context     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity, entity_id);
create index audit_logs_actor_idx on public.audit_logs(actor_id);

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_email text;
  v_id text;
  v_old jsonb;
  v_new jsonb;
begin
  if v_actor is not null then
    select email::text into v_email from public.profiles where id = v_actor;
  end if;

  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;

  -- No registrar cambios vacíos (solo updated_at)
  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then
    return new;
  end if;

  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'key', v_old ->> 'key',
                   v_new ->> 'user_id', v_old ->> 'user_id');

  insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, old_data, new_data)
  values (v_actor, v_email, lower(tg_op), tg_table_name, v_id, v_old, v_new);

  return coalesce(new, old);
end;
$$;

create trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function public.audit_trigger();
create trigger audit_role_permissions after insert or update or delete on public.role_permissions
  for each row execute function public.audit_trigger();

-- Registro manual de acciones desde la API (accesos administrativos, etc.)
create or replace function public.log_action(p_action text, p_entity text, p_entity_id text, p_context jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'Autenticación requerida' using errcode = '42501';
  end if;
  if not public.is_staff() then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  select email::text into v_email from public.profiles where id = (select auth.uid());
  insert into public.audit_logs (actor_id, actor_email, action, entity, entity_id, context)
  values ((select auth.uid()), v_email, left(p_action, 60), left(p_entity, 60), left(p_entity_id, 120), coalesce(p_context, '{}'::jsonb));
end;
$$;

-- -----------------------------------------------------------------------------
-- Limitación de peticiones (rate limiting) usada por la API con service_role
-- -----------------------------------------------------------------------------
create table public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);
create index rate_limits_window_idx on public.rate_limits(window_start);

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits as rl (key, window_start, hits)
  values (left(p_key, 200), v_window, 1)
  on conflict (key, window_start) do update set hits = rl.hits + 1
  returning hits into v_hits;

  -- Limpieza oportunista de ventanas antiguas
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return v_hits <= p_limit;
end;
$$;
