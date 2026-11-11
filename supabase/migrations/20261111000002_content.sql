-- =============================================================================
-- NOVALIUS · 0002 · CMS: ajustes, diseño, navegación, páginas, contenido, medios,
--                    traducciones
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ajustes globales (clave → JSON). is_public decide si la web pública los lee.
-- -----------------------------------------------------------------------------
create table public.site_settings (
  key         text primary key check (key ~ '^[a-z_]+$'),
  value       jsonb not null default '{}'::jsonb,
  is_public   boolean not null default false,
  description text not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();
create trigger audit_site_settings after insert or update or delete on public.site_settings
  for each row execute function public.audit_trigger();

-- Permiso necesario para editar cada clave
create or replace function public.setting_permission(p_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_key
    when 'challenge' then 'games.manage'
    when 'notifications' then 'notifications.manage'
    when 'pricing' then 'pricing.manage'
    else 'settings.manage'
  end;
$$;

-- -----------------------------------------------------------------------------
-- Diseño global (tokens + animaciones) con borrador, publicación e historial
-- -----------------------------------------------------------------------------
create type public.version_status as enum ('draft', 'published', 'archived');

create table public.design_settings (
  id           uuid primary key default gen_random_uuid(),
  status       public.version_status not null default 'draft',
  tokens       jsonb not null default '{}'::jsonb,
  animations   jsonb not null default '{}'::jsonb,
  note         text not null default '',
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null
);
create unique index design_settings_one_draft on public.design_settings(status) where status = 'draft';
create unique index design_settings_one_published on public.design_settings(status) where status = 'published';
create index design_settings_published_at_idx on public.design_settings(published_at desc);
create trigger design_settings_touch before update on public.design_settings
  for each row execute function public.touch_updated_at();
create trigger audit_design_settings after insert or update or delete on public.design_settings
  for each row execute function public.audit_trigger();

-- -----------------------------------------------------------------------------
-- Navegación (cabecera, pie, legal, redes)
-- -----------------------------------------------------------------------------
create table public.navigation_items (
  id         uuid primary key default gen_random_uuid(),
  menu       text not null check (menu in ('header', 'footer', 'legal', 'social')),
  label      text not null check (char_length(label) between 1 and 80),
  href       text not null check (char_length(href) between 1 and 500 and href !~* '^\s*javascript:'),
  group_label text not null default '',
  position   integer not null default 0,
  is_visible boolean not null default true,
  is_cta     boolean not null default false,
  i18n       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index navigation_items_menu_idx on public.navigation_items(menu, position);
create trigger navigation_items_touch before update on public.navigation_items
  for each row execute function public.touch_updated_at();
create trigger audit_navigation_items after insert or update or delete on public.navigation_items
  for each row execute function public.audit_trigger();

-- -----------------------------------------------------------------------------
-- Páginas gestionables
--   page_sections  = borrador editable (estructura de la página)
--   page_versions  = instantáneas publicadas (historial y restauración)
-- -----------------------------------------------------------------------------
create table public.pages (
  id                   uuid primary key default gen_random_uuid(),
  path                 text not null unique check (path ~ '^/([a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*)?$'),
  title                text not null check (char_length(title) between 1 and 160),
  kind                 text not null default 'standard' check (kind in ('landing', 'standard', 'legal', 'system')),
  is_system            boolean not null default false,
  seo                  jsonb not null default '{}'::jsonb,
  i18n                 jsonb not null default '{}'::jsonb,
  published_version_id uuid,
  has_unpublished_changes boolean not null default true,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id) on delete set null,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users(id) on delete set null
);
create trigger pages_touch before update on public.pages
  for each row execute function public.touch_updated_at();
create trigger audit_pages after insert or update or delete on public.pages
  for each row execute function public.audit_trigger();

create table public.page_sections (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references public.pages(id) on delete cascade,
  type       text not null check (type ~ '^[a-z_]+$'),
  label      text not null default '',
  props      jsonb not null default '{}'::jsonb,
  style      jsonb not null default '{}'::jsonb,
  position   integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index page_sections_page_idx on public.page_sections(page_id, position);
create trigger page_sections_touch before update on public.page_sections
  for each row execute function public.touch_updated_at();

-- Cualquier cambio en las secciones marca la página como pendiente de publicar
create or replace function public.mark_page_dirty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pages
     set has_unpublished_changes = true,
         updated_by = coalesce((select auth.uid()), updated_by)
   where id = coalesce(new.page_id, old.page_id);
  return coalesce(new, old);
end;
$$;
create trigger page_sections_dirty after insert or update or delete on public.page_sections
  for each row execute function public.mark_page_dirty();

create table public.page_versions (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid not null references public.pages(id) on delete cascade,
  version      integer not null,
  snapshot     jsonb not null,
  note         text not null default '',
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  unique (page_id, version)
);
create index page_versions_page_idx on public.page_versions(page_id, version desc);

alter table public.pages
  add constraint pages_published_version_fk
  foreign key (published_version_id) references public.page_versions(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Servicios
-- -----------------------------------------------------------------------------
create table public.services (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text not null check (char_length(title) between 1 and 120),
  tagline      text not null default '',
  summary      text not null default '',
  problem      text not null default '',
  benefits     jsonb not null default '[]'::jsonb,
  features     jsonb not null default '[]'::jsonb,
  examples     jsonb not null default '[]'::jsonb,
  icon         text not null default 'sparkles',
  visual       text not null default 'orbit',
  accent       text not null default '',
  cta_label    text not null default 'Solicitar presupuesto',
  project_type text not null default 'web',
  seo          jsonb not null default '{}'::jsonb,
  i18n         jsonb not null default '{}'::jsonb,
  position     integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index services_position_idx on public.services(position);
create trigger services_touch before update on public.services
  for each row execute function public.touch_updated_at();
create trigger audit_services after insert or update or delete on public.services
  for each row execute function public.audit_trigger();

-- -----------------------------------------------------------------------------
-- Portfolio (proyectos públicos). is_concept identifica demos conceptuales.
-- -----------------------------------------------------------------------------
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text not null check (char_length(title) between 1 and 160),
  client_label text not null default '',
  is_concept   boolean not null default true,
  category     text not null default '',
  summary      text not null default '',
  challenge    text not null default '',
  solution     text not null default '',
  outcome      text not null default '',
  features     jsonb not null default '[]'::jsonb,
  stack        jsonb not null default '[]'::jsonb,
  cover_url    text not null default '',
  gallery      jsonb not null default '[]'::jsonb,
  video_url    text not null default '',
  demo_url     text not null default '',
  accent       text not null default '',
  year         integer check (year between 2000 and 2100),
  seo          jsonb not null default '{}'::jsonb,
  i18n         jsonb not null default '{}'::jsonb,
  position     integer not null default 0,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index projects_position_idx on public.projects(position);
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger audit_projects after insert or update or delete on public.projects
  for each row execute function public.audit_trigger();

-- -----------------------------------------------------------------------------
-- Plantillas sectoriales (demos funcionales)
-- -----------------------------------------------------------------------------
create table public.templates (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null check (char_length(name) between 1 and 120),
  category     text not null,
  description  text not null default '',
  features     jsonb not null default '[]'::jsonb,
  demo_key     text not null check (demo_key ~ '^[a-z_]+$'),
  theme        jsonb not null default '{}'::jsonb,
  content      jsonb not null default '{}'::jsonb,
  screenshots  jsonb not null default '[]'::jsonb,
  i18n         jsonb not null default '{}'::jsonb,
  position     integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index templates_position_idx on public.templates(position);
create trigger templates_touch before update on public.templates
  for each row execute function public.touch_updated_at();
create trigger audit_templates after insert or update or delete on public.templates
  for each row execute function public.audit_trigger();

-- -----------------------------------------------------------------------------
-- Preguntas frecuentes
-- -----------------------------------------------------------------------------
create table public.faqs (
  id           uuid primary key default gen_random_uuid(),
  scope        text not null default 'general' check (scope in ('general', 'service', 'challenge', 'account')),
  service_id   uuid references public.services(id) on delete cascade,
  question     text not null check (char_length(question) between 3 and 300),
  answer       text not null check (char_length(answer) between 1 and 4000),
  i18n         jsonb not null default '{}'::jsonb,
  position     integer not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (scope <> 'service' or service_id is not null)
);
create index faqs_scope_idx on public.faqs(scope, service_id, position);
create trigger faqs_touch before update on public.faqs
  for each row execute function public.touch_updated_at();
create trigger audit_faqs after insert or update or delete on public.faqs
  for each row execute function public.audit_trigger();

-- -----------------------------------------------------------------------------
-- Biblioteca de medios (Supabase Storage, bucket público "media")
-- -----------------------------------------------------------------------------
create table public.media_assets (
  id          uuid primary key default gen_random_uuid(),
  bucket      text not null default 'media',
  path        text not null,
  public_url  text not null,
  kind        text not null check (kind in ('image', 'video', 'document')),
  mime_type   text not null,
  size_bytes  bigint not null check (size_bytes > 0),
  width       integer,
  height      integer,
  alt         text not null default '',
  title       text not null default '',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (bucket, path)
);
create index media_assets_created_idx on public.media_assets(created_at desc);

-- -----------------------------------------------------------------------------
-- Traducciones de interfaz (sistema centralizado: clave + idioma)
-- -----------------------------------------------------------------------------
create table public.translations (
  key        text not null check (key ~ '^[a-z0-9_.]+$'),
  locale     text not null check (locale ~ '^[a-z]{2}$'),
  value      text not null,
  updated_at timestamptz not null default now(),
  primary key (key, locale)
);
create trigger translations_touch before update on public.translations
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Funciones del editor: publicar, restaurar, duplicar, reordenar
-- -----------------------------------------------------------------------------
create or replace function public.page_draft_snapshot(p_page_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', p.title,
    'path', p.path,
    'kind', p.kind,
    'seo', p.seo,
    'i18n', p.i18n,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'type', s.type, 'label', s.label, 'props', s.props,
        'style', s.style, 'is_visible', s.is_visible
      ) order by s.position, s.created_at)
      from public.page_sections s where s.page_id = p.id
    ), '[]'::jsonb)
  )
  from public.pages p where p.id = p_page_id;
$$;

create or replace function public.publish_page(p_page_id uuid, p_note text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
  v_id uuid;
begin
  if not public.has_permission('content.publish') then
    raise exception 'Permiso denegado: content.publish' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pages where id = p_page_id) then
    raise exception 'Página no encontrada' using errcode = 'P0002';
  end if;

  select coalesce(max(version), 0) + 1 into v_version from public.page_versions where page_id = p_page_id;

  insert into public.page_versions (page_id, version, snapshot, note, published_by)
  values (p_page_id, v_version, public.page_draft_snapshot(p_page_id), left(coalesce(p_note, ''), 300), (select auth.uid()))
  returning id into v_id;

  update public.pages
     set published_version_id = v_id,
         has_unpublished_changes = false,
         updated_by = (select auth.uid())
   where id = p_page_id;

  return v_id;
end;
$$;

create or replace function public.unpublish_page(p_page_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('content.publish') then
    raise exception 'Permiso denegado: content.publish' using errcode = '42501';
  end if;
  if exists (select 1 from public.pages where id = p_page_id and is_system) then
    raise exception 'Las páginas del sistema no se pueden despublicar' using errcode = '42501';
  end if;
  update public.pages set published_version_id = null, has_unpublished_changes = true where id = p_page_id;
end;
$$;

-- Restaura una versión publicada como borrador (no publica automáticamente)
create or replace function public.restore_page_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page uuid;
  v_snap jsonb;
  v_section jsonb;
  v_pos integer := 0;
begin
  if not public.has_permission('content.manage') then
    raise exception 'Permiso denegado: content.manage' using errcode = '42501';
  end if;
  select page_id, snapshot into v_page, v_snap from public.page_versions where id = p_version_id;
  if v_page is null then
    raise exception 'Versión no encontrada' using errcode = 'P0002';
  end if;

  delete from public.page_sections where page_id = v_page;
  for v_section in select * from jsonb_array_elements(coalesce(v_snap -> 'sections', '[]'::jsonb)) loop
    insert into public.page_sections (page_id, type, label, props, style, position, is_visible)
    values (v_page, v_section ->> 'type', coalesce(v_section ->> 'label', ''),
            coalesce(v_section -> 'props', '{}'::jsonb), coalesce(v_section -> 'style', '{}'::jsonb),
            v_pos, coalesce((v_section ->> 'is_visible')::boolean, true));
    v_pos := v_pos + 1;
  end loop;

  update public.pages
     set seo = coalesce(v_snap -> 'seo', seo),
         title = coalesce(v_snap ->> 'title', title),
         i18n = coalesce(v_snap -> 'i18n', i18n),
         has_unpublished_changes = true
   where id = v_page;
end;
$$;

create or replace function public.duplicate_page(p_page_id uuid, p_path text, p_title text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new uuid;
begin
  if not public.has_permission('content.manage') then
    raise exception 'Permiso denegado: content.manage' using errcode = '42501';
  end if;
  insert into public.pages (path, title, kind, seo, i18n, created_by, updated_by)
  select p_path, p_title, case when kind = 'system' then 'standard' else kind end,
         seo, i18n, (select auth.uid()), (select auth.uid())
  from public.pages where id = p_page_id
  returning id into v_new;

  if v_new is null then
    raise exception 'Página no encontrada' using errcode = 'P0002';
  end if;

  insert into public.page_sections (page_id, type, label, props, style, position, is_visible)
  select v_new, type, label, props, style, position, is_visible
  from public.page_sections where page_id = p_page_id;

  return v_new;
end;
$$;

create or replace function public.reorder_page_sections(p_page_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i integer;
begin
  if not public.has_permission('content.manage') then
    raise exception 'Permiso denegado: content.manage' using errcode = '42501';
  end if;
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    update public.page_sections set position = i - 1 where id = p_ids[i] and page_id = p_page_id;
  end loop;
end;
$$;

-- Lectura pública de una página publicada por ruta
create or replace function public.get_published_page(p_path text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'version', v.version,
    'published_at', v.published_at,
    'page', v.snapshot
  )
  from public.pages p
  join public.page_versions v on v.id = p.published_version_id
  where p.path = p_path;
$$;

-- Diseño: publicar borrador, restaurar versión
create or replace function public.publish_design(p_note text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.design_settings;
  v_id uuid;
begin
  if not public.has_permission('design.manage') then
    raise exception 'Permiso denegado: design.manage' using errcode = '42501';
  end if;
  select * into v_draft from public.design_settings where status = 'draft';
  if v_draft.id is null then
    raise exception 'No hay borrador de diseño' using errcode = 'P0002';
  end if;

  update public.design_settings set status = 'archived' where status = 'published';
  insert into public.design_settings (status, tokens, animations, note, created_by, published_at, published_by)
  values ('published', v_draft.tokens, v_draft.animations, left(coalesce(p_note, ''), 300),
          (select auth.uid()), now(), (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.restore_design_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_src public.design_settings;
begin
  if not public.has_permission('design.manage') then
    raise exception 'Permiso denegado: design.manage' using errcode = '42501';
  end if;
  select * into v_src from public.design_settings where id = p_version_id;
  if v_src.id is null then
    raise exception 'Versión no encontrada' using errcode = 'P0002';
  end if;
  update public.design_settings
     set tokens = v_src.tokens, animations = v_src.animations, updated_by = (select auth.uid())
   where status = 'draft';
end;
$$;
