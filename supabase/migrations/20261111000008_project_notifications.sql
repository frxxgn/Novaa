-- =============================================================================
-- NOVALIUS · 0008 · Avisos al cliente cuando hay novedades visibles en su proyecto
-- =============================================================================
create or replace function public.notify_project_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_name text;
  v_title text;
  v_body text;
begin
  if not coalesce(new.visible_to_client, false) then
    return new;
  end if;
  select c.user_id, cp.name into v_user, v_name
    from public.customer_projects cp
    join public.customers c on c.id = cp.customer_id
   where cp.id = new.project_id and cp.visible_to_client;
  if v_user is null then
    return new;
  end if;
  if tg_table_name = 'project_updates' then
    v_title := 'Novedad en ' || v_name;
    v_body := left(new.body, 280);
  else
    v_title := 'Nuevo archivo en ' || v_name;
    v_body := new.file_name;
  end if;
  insert into public.notifications (recipient_id, type, title, body, link)
  values (v_user, 'project_update', v_title, v_body, '/cuenta/proyectos/' || new.project_id);
  return new;
end;
$$;

create trigger project_updates_notify after insert on public.project_updates
  for each row execute function public.notify_project_client();
create trigger project_files_notify after insert on public.project_files
  for each row execute function public.notify_project_client();
revoke execute on function public.notify_project_client() from public, anon, authenticated;

-- Equipo disponible para asignaciones (CRM, tareas). Solo para personal.
create or replace function public.list_staff()
returns table (id uuid, email text, full_name text, roles text[])
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.email::text, p.full_name, array_agg(ur.role::text order by ur.role)
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  where ur.role in ('team', 'admin') and not p.is_disabled and public.is_staff()
  group by p.id, p.email, p.full_name
  order by p.full_name, p.email;
$$;
revoke execute on function public.list_staff() from public, anon;
grant execute on function public.list_staff() to authenticated;
