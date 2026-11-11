-- =============================================================================
-- NOVALIUS · 0004 · Novalius Challenge, cupones, notificaciones, analíticas,
--                    privacidad y métricas del panel
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Banco de preguntas (las respuestas correctas NUNCA salen del servidor)
-- -----------------------------------------------------------------------------
create table public.game_questions (
  id            uuid primary key default gen_random_uuid(),
  category      text not null check (category in ('tecnologia', 'cultura', 'logica', 'ciencia', 'internet', 'curiosidades', 'creatividad')),
  difficulty    smallint not null check (difficulty between 1 and 3),
  question      text not null check (char_length(question) between 5 and 300),
  options       jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 5),
  correct_index smallint not null check (correct_index >= 0),
  explanation   text not null default '',
  is_active     boolean not null default true,
  times_shown   integer not null default 0,
  times_correct integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (correct_index < jsonb_array_length(options))
);
create index game_questions_active_idx on public.game_questions(is_active, difficulty, category);
create trigger game_questions_touch before update on public.game_questions
  for each row execute function public.touch_updated_at();

create table public.game_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  game         text not null check (game in ('quiz', 'tictactoe')),
  status       text not null default 'active' check (status in ('active', 'won', 'lost', 'draw', 'expired', 'abandoned')),
  difficulty   text not null default 'normal',
  state        jsonb not null default '{}'::jsonb,
  score        integer not null default 0,
  started_at   timestamptz not null default now(),
  deadline_at  timestamptz,
  finished_at  timestamptz,
  duration_ms  integer,
  flagged      boolean not null default false,
  flag_reason  text not null default '',
  coupon_id    uuid,
  ip_hash      text not null default '',
  created_at   timestamptz not null default now()
);
create index game_sessions_user_idx on public.game_sessions(user_id, created_at desc);
create index game_sessions_game_idx on public.game_sessions(game, status, created_at desc);
create unique index game_sessions_one_active on public.game_sessions(user_id, game) where status = 'active';

create table public.game_answers (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.game_sessions(id) on delete cascade,
  question_id   uuid references public.game_questions(id) on delete set null,
  position      smallint not null,
  chosen_index  smallint,
  is_correct    boolean not null,
  served_at     timestamptz not null,
  answered_at   timestamptz not null default now(),
  unique (session_id, position)
);
create index game_answers_question_idx on public.game_answers(question_id);

-- -----------------------------------------------------------------------------
-- Cupones (código generado en servidor, un cupón de reto por cuenta)
-- -----------------------------------------------------------------------------
create table public.coupons (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code ~ '^[A-Z0-9-]{8,32}$'),
  user_id           uuid references public.profiles(id) on delete cascade,
  percent           numeric(5, 2) not null check (percent > 0 and percent <= 50),
  source            text not null default 'challenge' check (source in ('challenge', 'manual')),
  source_session_id uuid references public.game_sessions(id) on delete set null,
  status            text not null default 'available' check (status in ('available', 'used', 'expired', 'revoked')),
  conditions        text not null default '',
  expires_at        timestamptz not null,
  used_at           timestamptz,
  revoked_at        timestamptz,
  revoked_reason    text not null default '',
  created_at        timestamptz not null default now()
);
create unique index coupons_one_challenge_per_user on public.coupons(user_id) where source = 'challenge';
create index coupons_status_idx on public.coupons(status, expires_at);
create trigger audit_coupons after insert or update or delete on public.coupons
  for each row execute function public.audit_trigger();

alter table public.game_sessions add constraint game_sessions_coupon_fk foreign key (coupon_id) references public.coupons(id) on delete set null;

create table public.coupon_redemptions (
  id                uuid primary key default gen_random_uuid(),
  coupon_id         uuid not null unique references public.coupons(id) on delete cascade,
  redeemed_by       uuid references auth.users(id) on delete set null default auth.uid(),
  quote_id          uuid references public.quotes(id) on delete set null,
  project_id        uuid references public.customer_projects(id) on delete set null,
  amount_discounted numeric(12, 2),
  notes             text not null default '',
  created_at        timestamptz not null default now()
);

-- Marca como caducados los cupones vencidos
create or replace function public.expire_coupons()
returns integer
language sql
security definer
set search_path = ''
as $$
  with updated as (
    update public.coupons set status = 'expired'
     where status = 'available' and expires_at < now()
    returning 1
  )
  select count(*)::integer from updated;
$$;

-- Canje atómico (solo personal con coupons.manage)
create or replace function public.redeem_coupon(p_code text, p_quote_id uuid default null, p_project_id uuid default null, p_amount numeric default null, p_notes text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coupon public.coupons;
begin
  if not public.has_permission('coupons.manage') then
    raise exception 'Permiso denegado: coupons.manage' using errcode = '42501';
  end if;

  select * into v_coupon from public.coupons where code = upper(trim(p_code)) for update;
  if v_coupon.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_coupon.status = 'available' and v_coupon.expires_at < now() then
    update public.coupons set status = 'expired' where id = v_coupon.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if v_coupon.status <> 'available' then
    return jsonb_build_object('ok', false, 'reason', v_coupon.status);
  end if;

  update public.coupons set status = 'used', used_at = now() where id = v_coupon.id;
  insert into public.coupon_redemptions (coupon_id, quote_id, project_id, amount_discounted, notes)
  values (v_coupon.id, p_quote_id, p_project_id, p_amount, left(coalesce(p_notes, ''), 500));

  return jsonb_build_object('ok', true, 'coupon_id', v_coupon.id, 'percent', v_coupon.percent, 'user_id', v_coupon.user_id);
end;
$$;

-- Validación sin canje
create or replace function public.validate_coupon(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_coupon public.coupons;
begin
  if not public.has_permission('coupons.manage') then
    raise exception 'Permiso denegado: coupons.manage' using errcode = '42501';
  end if;
  select * into v_coupon from public.coupons where code = upper(trim(p_code));
  if v_coupon.id is null then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;
  return jsonb_build_object(
    'valid', v_coupon.status = 'available' and v_coupon.expires_at >= now(),
    'reason', case when v_coupon.status = 'available' and v_coupon.expires_at < now() then 'expired' else v_coupon.status end,
    'percent', v_coupon.percent,
    'expires_at', v_coupon.expires_at,
    'user_email', (select email::text from public.profiles where id = v_coupon.user_id)
  );
end;
$$;

-- Historial de partidas del usuario (sin estado interno)
create or replace function public.my_game_history()
returns table (id uuid, game text, status text, difficulty text, score integer, started_at timestamptz, finished_at timestamptz, duration_ms integer)
language sql
stable
security definer
set search_path = ''
as $$
  select id, game, status, difficulty, score, started_at, finished_at, duration_ms
  from public.game_sessions
  where user_id = (select auth.uid())
  order by created_at desc
  limit 50;
$$;

-- -----------------------------------------------------------------------------
-- Notificaciones internas (una fila por destinatario) y registro de entregas
-- -----------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type         text not null,
  title        text not null,
  body         text not null default '',
  link         text not null default '',
  data         jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications(recipient_id, read_at, created_at desc);

create table public.notification_deliveries (
  id                  uuid primary key default gen_random_uuid(),
  event               text not null,
  channel             text not null check (channel in ('email', 'whatsapp', 'internal')),
  recipient           text not null default '',
  status              text not null check (status in ('sent', 'failed', 'skipped')),
  provider            text not null default '',
  provider_message_id text not null default '',
  detail              text not null default '',
  entity              text not null default '',
  entity_id           text not null default '',
  created_at          timestamptz not null default now()
);
create index notification_deliveries_created_idx on public.notification_deliveries(created_at desc);

-- Solo se puede marcar como leída (columna read_at)
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language sql
security definer
set search_path = ''
as $$
  with updated as (
    update public.notifications set read_at = now()
     where recipient_id = (select auth.uid())
       and read_at is null
       and (p_ids is null or id = any(p_ids))
    returning 1
  )
  select count(*)::integer from updated;
$$;

-- -----------------------------------------------------------------------------
-- Analíticas propias (sin IP, sin cookies; solo con consentimiento)
-- -----------------------------------------------------------------------------
create table public.analytics_events (
  id         bigint generated always as identity primary key,
  name       text not null check (name ~ '^[a-z_]+$'),
  path       text not null default '',
  session_id text not null default '',
  user_id    uuid references auth.users(id) on delete set null,
  props      jsonb not null default '{}'::jsonb,
  referrer   text not null default '',
  device     text not null default '' check (device in ('', 'mobile', 'tablet', 'desktop')),
  created_at timestamptz not null default now()
);
create index analytics_events_created_idx on public.analytics_events(created_at desc);
create index analytics_events_name_idx on public.analytics_events(name, created_at desc);

-- -----------------------------------------------------------------------------
-- Solicitudes de privacidad (RGPD)
-- -----------------------------------------------------------------------------
create table public.privacy_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  email        extensions.citext not null,
  type         text not null check (type in ('access', 'deletion', 'rectification')),
  status       text not null default 'pending' check (status in ('pending', 'completed', 'rejected')),
  details      text not null default '',
  resolution   text not null default '',
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references auth.users(id) on delete set null
);
create index privacy_requests_status_idx on public.privacy_requests(status, created_at desc);
create trigger audit_privacy_requests after insert or update or delete on public.privacy_requests
  for each row execute function public.audit_trigger();

-- -----------------------------------------------------------------------------
-- Retención de datos configurable (site_settings.privacy)
-- -----------------------------------------------------------------------------
create or replace function public.apply_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb := coalesce((select value from public.site_settings where key = 'privacy'), '{}'::jsonb);
  v_conv_days integer := coalesce((v_cfg ->> 'conversation_retention_days')::integer, 365);
  v_analytics_days integer := coalesce((v_cfg ->> 'analytics_retention_days')::integer, 395);
  v_conv integer;
  v_events integer;
begin
  if (select auth.uid()) is not null and not public.has_permission('settings.manage') then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
  with d as (
    delete from public.conversations c
     where c.last_message_at < now() - make_interval(days => v_conv_days)
       and c.lead_id is null
    returning 1
  ) select count(*) into v_conv from d;
  with d as (
    delete from public.analytics_events where created_at < now() - make_interval(days => v_analytics_days)
    returning 1
  ) select count(*) into v_events from d;
  delete from public.rate_limits where window_start < now() - interval '2 days';
  return jsonb_build_object('conversations_deleted', v_conv, 'analytics_deleted', v_events);
end;
$$;

-- -----------------------------------------------------------------------------
-- Métricas del panel (datos reales de la base de datos)
-- -----------------------------------------------------------------------------
create or replace function public.admin_dashboard(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := date_trunc('day', now()) - make_interval(days => greatest(1, least(p_days, 365)) - 1);
  v_result jsonb;
begin
  if not public.has_permission('dashboard.view') then
    raise exception 'Permiso denegado: dashboard.view' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'range_days', p_days,
    'leads_total', (select count(*) from public.leads),
    'leads_new', (select count(*) from public.leads where status = 'new'),
    'leads_period', (select count(*) from public.leads where created_at >= v_from),
    'leads_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from public.leads group by status) s),
    'leads_by_source', (select coalesce(jsonb_object_agg(source, n), '{}'::jsonb) from (select source, count(*) n from public.leads where created_at >= v_from group by source) s),
    'won', (select count(*) from public.leads where status = 'won'),
    'lost', (select count(*) from public.leads where status = 'lost'),
    'pipeline_min', (select coalesce(sum(estimated_min), 0) from public.leads where status in ('new', 'contacted', 'negotiation')),
    'pipeline_max', (select coalesce(sum(estimated_max), 0) from public.leads where status in ('new', 'contacted', 'negotiation')),
    'users_total', (select count(*) from public.profiles),
    'users_period', (select count(*) from public.profiles where created_at >= v_from),
    'customers_total', (select count(*) from public.customers),
    'quotes_period', (select count(*) from public.quotes where created_at >= v_from),
    'proposals_requested', (select count(*) from public.quotes where status = 'proposal_requested'),
    'projects_active', (select count(*) from public.customer_projects where status in ('planning', 'in_progress', 'review')),
    'projects_completed', (select count(*) from public.customer_projects where status = 'completed'),
    'conversations_period', (select count(*) from public.conversations where created_at >= v_from),
    'messages_period', (select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id where m.created_at >= v_from and m.role = 'user'),
    'visits_period', (select count(distinct session_id) from public.analytics_events where name = 'page_view' and created_at >= v_from),
    'pageviews_period', (select count(*) from public.analytics_events where name = 'page_view' and created_at >= v_from),
    'games_period', (select count(*) from public.game_sessions where created_at >= v_from),
    'coupons_issued', (select count(*) from public.coupons),
    'coupons_used', (select count(*) from public.coupons where status = 'used'),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', to_char(d, 'YYYY-MM-DD'),
        'leads', (select count(*) from public.leads where created_at >= d and created_at < d + interval '1 day'),
        'conversations', (select count(*) from public.conversations where created_at >= d and created_at < d + interval '1 day'),
        'visits', (select count(distinct session_id) from public.analytics_events where name = 'page_view' and created_at >= d and created_at < d + interval '1 day'),
        'quotes', (select count(*) from public.quotes where created_at >= d and created_at < d + interval '1 day')
      ) order by d), '[]'::jsonb)
      from generate_series(v_from, date_trunc('day', now()), interval '1 day') d
    ),
    'alerts', jsonb_build_object(
      'stale_new_leads', (select count(*) from public.leads where status = 'new' and created_at < now() - interval '24 hours'),
      'unassigned_leads', (select count(*) from public.leads where assigned_to is null and status in ('new', 'contacted', 'negotiation')),
      'overdue_projects', (select count(*) from public.customer_projects where due_date < current_date and status in ('planning', 'in_progress', 'review')),
      'pending_privacy_requests', (select count(*) from public.privacy_requests where status = 'pending'),
      'flagged_games', (select count(*) from public.game_sessions where flagged and created_at >= v_from)
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.analytics_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('analytics.read') then
    raise exception 'Permiso denegado: analytics.read' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'visits', (select count(distinct session_id) from public.analytics_events where name = 'page_view' and created_at between p_from and p_to),
    'pageviews', (select count(*) from public.analytics_events where name = 'page_view' and created_at between p_from and p_to),
    'top_pages', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select path, count(*) as views from public.analytics_events
        where name = 'page_view' and created_at between p_from and p_to
        group by path order by views desc limit 12) t),
    'cta_clicks', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(props ->> 'id', 'cta') as id, count(*) as clicks from public.analytics_events
        where name = 'cta_click' and created_at between p_from and p_to
        group by 1 order by clicks desc limit 12) t),
    'devices', (select coalesce(jsonb_object_agg(device, n), '{}'::jsonb) from (
        select coalesce(nullif(device, ''), 'desconocido') device, count(distinct session_id) n from public.analytics_events
        where name = 'page_view' and created_at between p_from and p_to group by 1) d),
    'referrers', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select referrer, count(*) as visits from public.analytics_events
        where name = 'page_view' and referrer <> '' and created_at between p_from and p_to
        group by referrer order by visits desc limit 8) t),
    'conversations', (select count(*) from public.conversations where created_at between p_from and p_to),
    'quotes', (select count(*) from public.quotes where created_at between p_from and p_to),
    'forms', (select count(*) from public.leads where source = 'contact_form' and created_at between p_from and p_to),
    'leads', (select count(*) from public.leads where created_at between p_from and p_to),
    'won', (select count(*) from public.leads where status = 'won' and updated_at between p_from and p_to),
    'games', (select coalesce(jsonb_object_agg(game, n), '{}'::jsonb) from (
        select game, count(*) n from public.game_sessions where created_at between p_from and p_to group by game) g),
    'game_wins', (select count(*) from public.game_sessions where status = 'won' and created_at between p_from and p_to),
    'coupons_issued', (select count(*) from public.coupons where created_at between p_from and p_to),
    'coupons_used', (select count(*) from public.coupons where used_at between p_from and p_to),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'),
        'visits', (select count(distinct session_id) from public.analytics_events where name = 'page_view' and created_at >= d and created_at < d + interval '1 day'),
        'pageviews', (select count(*) from public.analytics_events where name = 'page_view' and created_at >= d and created_at < d + interval '1 day'),
        'leads', (select count(*) from public.leads where created_at >= d and created_at < d + interval '1 day')
      ) order by d), '[]'::jsonb)
      from generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day') d)
  );
end;
$$;

-- Estadísticas del Challenge
create or replace function public.challenge_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('games.manage') then
    raise exception 'Permiso denegado: games.manage' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'sessions', (select coalesce(jsonb_object_agg(game || ':' || status, n), '{}'::jsonb) from (
       select game, status, count(*) n from public.game_sessions group by game, status) s),
    'players', (select count(distinct user_id) from public.game_sessions),
    'flagged', (select count(*) from public.game_sessions where flagged),
    'avg_quiz_ms', (select coalesce(round(avg(duration_ms)), 0) from public.game_sessions where game = 'quiz' and status in ('won', 'lost')),
    'questions', (select coalesce(jsonb_agg(q order by q.shown desc), '[]'::jsonb) from (
       select id, question, category, difficulty, times_shown as shown, times_correct as correct,
              case when times_shown > 0 then round(100.0 * times_correct / times_shown) else null end as accuracy
       from public.game_questions order by times_shown desc limit 200) q),
    'coupons', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (
       select status, count(*) n from public.coupons group by status) c)
  );
end;
$$;
