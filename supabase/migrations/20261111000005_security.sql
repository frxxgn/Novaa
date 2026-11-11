-- =============================================================================
-- NOVALIUS · 0005 · Seguridad: privilegios mínimos, RLS y almacenamiento
-- =============================================================================
-- Reglas:
--   1. Se revocan TODOS los privilegios por defecto de anon/authenticated.
--   2. Se conceden solo las operaciones necesarias, tabla a tabla.
--   3. RLS activo en todas las tablas; las políticas deciden el alcance.
--   4. Las operaciones sensibles (Nova, presupuestos, juegos, cupones, leads
--      públicos, analíticas) solo las escribe la API con service_role.
-- =============================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Activar RLS en todas las tablas
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- service_role (API) conserva acceso completo y omite RLS (bypassrls)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- -----------------------------------------------------------------------------
-- Funciones invocables
-- -----------------------------------------------------------------------------
-- Las políticas públicas evalúan estas funciones también para anon (devuelven false)
grant execute on function public.has_role(public.app_role) to anon, authenticated;
grant execute on function public.has_permission(text) to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.my_access() to authenticated;
grant execute on function public.setting_permission(text) to anon, authenticated;
grant execute on function public.is_project_client(uuid) to anon, authenticated;
grant execute on function public.get_published_page(text) to anon, authenticated;
grant execute on function public.get_public_nova_config() to anon, authenticated;
grant execute on function public.page_draft_snapshot(uuid) to authenticated;
grant execute on function public.publish_page(uuid, text) to authenticated;
grant execute on function public.unpublish_page(uuid) to authenticated;
grant execute on function public.restore_page_version(uuid) to authenticated;
grant execute on function public.duplicate_page(uuid, text, text) to authenticated;
grant execute on function public.reorder_page_sections(uuid, uuid[]) to authenticated;
grant execute on function public.publish_design(text) to authenticated;
grant execute on function public.restore_design_version(uuid) to authenticated;
grant execute on function public.convert_lead_to_customer(uuid) to authenticated;
grant execute on function public.link_customer_account(uuid, uuid) to authenticated;
grant execute on function public.redeem_coupon(text, uuid, uuid, numeric, text) to authenticated;
grant execute on function public.validate_coupon(text) to authenticated;
grant execute on function public.my_game_history() to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.admin_dashboard(integer) to authenticated;
grant execute on function public.analytics_summary(timestamptz, timestamptz) to authenticated;
grant execute on function public.challenge_stats() to authenticated;
grant execute on function public.apply_retention() to authenticated;
grant execute on function public.log_action(text, text, text, jsonb) to authenticated;
-- check_rate_limit, expire_coupons y funciones de trigger: solo service_role.

-- =============================================================================
-- Roles y permisos
-- =============================================================================
grant select on public.roles, public.permissions, public.role_permissions to authenticated;
grant insert, delete on public.role_permissions to authenticated;
grant select, insert, delete on public.user_roles to authenticated;

create policy roles_read on public.roles for select to authenticated using (true);
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy role_permissions_read on public.role_permissions for select to authenticated using (true);
create policy role_permissions_admin_insert on public.role_permissions for insert to authenticated
  with check (public.has_role('admin') and role <> 'admin');
create policy role_permissions_admin_delete on public.role_permissions for delete to authenticated
  using (public.has_role('admin') and role <> 'admin');

create policy user_roles_read on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('users.manage'));
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check (public.has_permission('users.manage'));
create policy user_roles_delete on public.user_roles for delete to authenticated
  using (public.has_permission('users.manage'));

-- =============================================================================
-- Perfiles: cada usuario el suyo; personal autorizado puede consultar
-- =============================================================================
grant select on public.profiles to authenticated;
grant update (full_name, company, phone, avatar_url, locale, marketing_opt_in) on public.profiles to authenticated;

create policy profiles_read on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.has_permission('users.manage')
    or public.has_permission('crm.read')
    or public.has_permission('projects.manage')
  );
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- =============================================================================
-- Auditoría: solo lectura para quien tenga audit.read. Nadie edita ni borra.
-- =============================================================================
grant select on public.audit_logs to authenticated;
create policy audit_logs_read on public.audit_logs for select to authenticated
  using (public.has_permission('audit.read'));

-- rate_limits: sin acceso desde el cliente (solo service_role)

-- =============================================================================
-- CMS
-- =============================================================================
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
create policy site_settings_public_read on public.site_settings for select to anon, authenticated
  using (is_public or public.has_permission(public.setting_permission(key)));
create policy site_settings_write on public.site_settings for insert to authenticated
  with check (public.has_permission(public.setting_permission(key)));
create policy site_settings_update on public.site_settings for update to authenticated
  using (public.has_permission(public.setting_permission(key)))
  with check (public.has_permission(public.setting_permission(key)));

grant select on public.design_settings to anon, authenticated;
grant insert, update on public.design_settings to authenticated;
create policy design_public_read on public.design_settings for select to anon, authenticated
  using (status = 'published' or public.has_permission('design.manage'));
create policy design_insert on public.design_settings for insert to authenticated
  with check (public.has_permission('design.manage') and status = 'draft');
create policy design_update on public.design_settings for update to authenticated
  using (public.has_permission('design.manage') and status = 'draft')
  with check (public.has_permission('design.manage') and status = 'draft');

-- Tablas de contenido con publicación simple (is_published / is_visible)
grant select on public.navigation_items, public.services, public.projects, public.templates,
                public.faqs, public.media_assets, public.translations to anon, authenticated;
grant insert, update, delete on public.navigation_items, public.services, public.projects, public.templates,
                public.faqs, public.media_assets, public.translations to authenticated;

create policy nav_read on public.navigation_items for select to anon, authenticated
  using (is_visible or public.has_permission('content.manage'));
create policy nav_write on public.navigation_items for all to authenticated
  using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

create policy services_read on public.services for select to anon, authenticated
  using (is_published or public.has_permission('content.manage'));
create policy services_write on public.services for all to authenticated
  using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

create policy projects_read on public.projects for select to anon, authenticated
  using (is_published or public.has_permission('content.manage'));
create policy projects_write on public.projects for all to authenticated
  using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

create policy templates_read on public.templates for select to anon, authenticated
  using (is_published or public.has_permission('content.manage'));
create policy templates_write on public.templates for all to authenticated
  using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

create policy faqs_read on public.faqs for select to anon, authenticated
  using (is_published or public.has_permission('content.manage'));
create policy faqs_write on public.faqs for all to authenticated
  using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

create policy media_read on public.media_assets for select to anon, authenticated using (true);
create policy media_write on public.media_assets for all to authenticated
  using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

create policy translations_read on public.translations for select to anon, authenticated using (true);
create policy translations_write on public.translations for all to authenticated
  using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

-- Páginas: lectura pública solo de páginas publicadas
grant select on public.pages to anon, authenticated;
grant insert, update, delete on public.pages to authenticated;
create policy pages_read on public.pages for select to anon, authenticated
  using (published_version_id is not null or public.has_permission('content.manage'));
create policy pages_insert on public.pages for insert to authenticated
  with check (public.has_permission('content.manage') and not is_system);
create policy pages_update on public.pages for update to authenticated
  using (public.has_permission('content.manage'))
  with check (public.has_permission('content.manage'));
create policy pages_delete on public.pages for delete to authenticated
  using (public.has_permission('content.manage') and not is_system);

-- Evitar que el cliente cambie campos controlados por funciones
create or replace function public.guard_pages_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and current_user = 'authenticated' then
    if new.published_version_id is distinct from old.published_version_id then
      raise exception 'Usa publish_page() para publicar' using errcode = '42501';
    end if;
    if new.is_system is distinct from old.is_system then
      raise exception 'No se puede cambiar is_system' using errcode = '42501';
    end if;
    if old.is_system and new.path is distinct from old.path then
      raise exception 'No se puede cambiar la ruta de una página del sistema' using errcode = '42501';
    end if;
    new.updated_by := (select auth.uid());
    if new.seo is distinct from old.seo or new.title is distinct from old.title or new.i18n is distinct from old.i18n then
      new.has_unpublished_changes := true;
    end if;
  end if;
  return new;
end;
$$;
create trigger pages_guard before update on public.pages
  for each row execute function public.guard_pages_update();

grant select, insert, update, delete on public.page_sections to authenticated;
create policy page_sections_staff on public.page_sections for all to authenticated
  using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

grant select on public.page_versions to anon, authenticated;
create policy page_versions_read on public.page_versions for select to anon, authenticated
  using (
    exists (select 1 from public.pages p where p.published_version_id = page_versions.id)
    or public.has_permission('content.manage')
  );

-- =============================================================================
-- Nova
-- =============================================================================
grant select, insert, update on public.chatbot_settings to authenticated;
create policy chatbot_settings_staff on public.chatbot_settings for all to authenticated
  using (public.has_permission('nova.manage')) with check (public.has_permission('nova.manage'));

grant select, insert, update, delete on public.chatbot_knowledge to authenticated;
create policy chatbot_knowledge_staff on public.chatbot_knowledge for all to authenticated
  using (public.has_permission('nova.manage')) with check (public.has_permission('nova.manage'));

grant select on public.conversations, public.messages to authenticated;
grant update (status, summary) on public.conversations to authenticated;
create policy conversations_read on public.conversations for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('nova.conversations.read'));
create policy conversations_staff_update on public.conversations for update to authenticated
  using (public.has_permission('nova.conversations.read')) with check (public.has_permission('nova.conversations.read'));
create policy messages_read on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and (c.user_id = (select auth.uid()) or public.has_permission('nova.conversations.read'))
  ));

-- =============================================================================
-- Tarifas (no públicas: el cálculo se hace en servidor)
-- =============================================================================
grant select, insert, update, delete on public.pricing_rules, public.pricing_references to authenticated;
create policy pricing_rules_staff on public.pricing_rules for all to authenticated
  using (public.has_permission('pricing.manage')) with check (public.has_permission('pricing.manage'));
create policy pricing_references_staff on public.pricing_references for all to authenticated
  using (public.has_permission('pricing.manage')) with check (public.has_permission('pricing.manage'));

-- =============================================================================
-- Presupuestos: el usuario ve los suyos; CRM ve todos. Inserción solo API.
-- =============================================================================
grant select on public.quotes, public.quote_items to authenticated;
grant update (status, title, valid_until) on public.quotes to authenticated;
create policy quotes_read on public.quotes for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('crm.read'));
create policy quotes_staff_update on public.quotes for update to authenticated
  using (public.has_permission('crm.write')) with check (public.has_permission('crm.write'));
create policy quote_items_read on public.quote_items for select to authenticated
  using (exists (
    select 1 from public.quotes q where q.id = quote_items.quote_id
      and (q.user_id = (select auth.uid()) or public.has_permission('crm.read'))
  ));

-- =============================================================================
-- CRM
-- =============================================================================
grant select, insert, update, delete on public.leads to authenticated;
create policy leads_read on public.leads for select to authenticated using (public.has_permission('crm.read'));
create policy leads_insert on public.leads for insert to authenticated with check (public.has_permission('crm.write'));
create policy leads_update on public.leads for update to authenticated
  using (public.has_permission('crm.write')) with check (public.has_permission('crm.write'));
create policy leads_delete on public.leads for delete to authenticated using (public.has_role('admin'));

grant select, insert, delete on public.lead_notes to authenticated;
create policy lead_notes_read on public.lead_notes for select to authenticated using (public.has_permission('crm.read'));
create policy lead_notes_insert on public.lead_notes for insert to authenticated
  with check (public.has_permission('crm.write') and author_id = (select auth.uid()));
create policy lead_notes_delete on public.lead_notes for delete to authenticated
  using (author_id = (select auth.uid()) or public.has_role('admin'));

grant select on public.lead_events to authenticated;
create policy lead_events_read on public.lead_events for select to authenticated using (public.has_permission('crm.read'));

-- =============================================================================
-- Clientes y proyectos (aislamiento estricto por cliente)
-- =============================================================================
grant select, insert, update, delete on public.customers to authenticated;
create policy customers_read on public.customers for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('customers.manage') or public.has_permission('projects.manage') or public.has_permission('crm.read'));
create policy customers_write on public.customers for all to authenticated
  using (public.has_permission('customers.manage')) with check (public.has_permission('customers.manage'));

grant select, insert, update, delete on public.customer_projects, public.project_phases, public.project_tasks,
                                         public.project_files, public.project_updates to authenticated;

create policy cp_read on public.customer_projects for select to authenticated
  using (public.has_permission('projects.manage') or public.is_project_client(id));
create policy cp_write on public.customer_projects for all to authenticated
  using (public.has_permission('projects.manage')) with check (public.has_permission('projects.manage'));

create policy phases_read on public.project_phases for select to authenticated
  using (public.has_permission('projects.manage') or public.is_project_client(project_id));
create policy phases_write on public.project_phases for all to authenticated
  using (public.has_permission('projects.manage')) with check (public.has_permission('projects.manage'));

create policy tasks_read on public.project_tasks for select to authenticated
  using (public.has_permission('projects.manage') or (visible_to_client and public.is_project_client(project_id)));
create policy tasks_write on public.project_tasks for all to authenticated
  using (public.has_permission('projects.manage')) with check (public.has_permission('projects.manage'));

create policy files_read on public.project_files for select to authenticated
  using (public.has_permission('projects.manage') or (visible_to_client and public.is_project_client(project_id)));
create policy files_write on public.project_files for all to authenticated
  using (public.has_permission('projects.manage')) with check (public.has_permission('projects.manage'));

create policy updates_read on public.project_updates for select to authenticated
  using (public.has_permission('projects.manage') or (visible_to_client and public.is_project_client(project_id)));
create policy updates_write on public.project_updates for all to authenticated
  using (public.has_permission('projects.manage')) with check (public.has_permission('projects.manage'));

-- =============================================================================
-- Challenge y cupones
-- =============================================================================
grant select, insert, update, delete on public.game_questions to authenticated;
create policy questions_staff on public.game_questions for all to authenticated
  using (public.has_permission('games.manage')) with check (public.has_permission('games.manage'));

grant select on public.game_sessions, public.game_answers to authenticated;
create policy sessions_staff_read on public.game_sessions for select to authenticated using (public.has_permission('games.manage'));
create policy answers_staff_read on public.game_answers for select to authenticated using (public.has_permission('games.manage'));

grant select on public.coupons to authenticated;
grant update (status, revoked_at, revoked_reason, expires_at, conditions) on public.coupons to authenticated;
create policy coupons_read on public.coupons for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('coupons.manage'));
create policy coupons_staff_update on public.coupons for update to authenticated
  using (public.has_permission('coupons.manage')) with check (public.has_permission('coupons.manage'));

grant select on public.coupon_redemptions to authenticated;
create policy redemptions_read on public.coupon_redemptions for select to authenticated
  using (public.has_permission('coupons.manage') or exists (
    select 1 from public.coupons c where c.id = coupon_redemptions.coupon_id and c.user_id = (select auth.uid())
  ));

-- =============================================================================
-- Notificaciones, analíticas y privacidad
-- =============================================================================
grant select, delete on public.notifications to authenticated;
create policy notifications_own on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (recipient_id = (select auth.uid()));

grant select on public.notification_deliveries to authenticated;
create policy deliveries_read on public.notification_deliveries for select to authenticated
  using (public.has_permission('notifications.manage'));

grant select on public.analytics_events to authenticated;
create policy analytics_read on public.analytics_events for select to authenticated
  using (public.has_permission('analytics.read'));

grant select on public.privacy_requests to authenticated;
grant update (status, resolution, resolved_at, resolved_by) on public.privacy_requests to authenticated;
create policy privacy_read on public.privacy_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('users.manage'));
create policy privacy_update on public.privacy_requests for update to authenticated
  using (public.has_permission('users.manage')) with check (public.has_permission('users.manage'));

-- =============================================================================
-- Almacenamiento
--   media          → público (web): solo content.manage sube/borra
--   project-files  → privado: personal de proyectos y el cliente del proyecto
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 20971520,
   array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm', 'application/pdf']),
  ('project-files', 'project-files', false, 52428800,
   array['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/zip',
         'text/plain', 'text/csv', 'video/mp4',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy media_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'media');
create policy media_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.has_permission('content.manage'));
create policy media_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.has_permission('content.manage'));
create policy media_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.has_permission('content.manage'));

-- Ruta obligatoria: {project_id}/{archivo}
create policy project_files_read on storage.objects for select to authenticated
  using (
    bucket_id = 'project-files' and (
      public.has_permission('projects.manage')
      or exists (
        select 1 from public.project_files f
        where f.storage_path = storage.objects.name
          and f.visible_to_client
          and public.is_project_client(f.project_id)
      )
    )
  );
create policy project_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and public.has_permission('projects.manage'));
create policy project_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and public.has_permission('projects.manage'));
