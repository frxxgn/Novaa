-- =============================================================================
-- NOVALIUS · 0007 · Funciones internas del Challenge (solo service_role)
-- =============================================================================

create or replace function public.record_question_result(p_question_id uuid, p_correct boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.game_questions
     set times_shown = times_shown + 1,
         times_correct = times_correct + case when p_correct then 1 else 0 end
   where id = p_question_id;
$$;

revoke execute on function public.record_question_result(uuid, boolean) from public, anon, authenticated;
grant execute on function public.record_question_result(uuid, boolean) to service_role;

-- Inicio de día en la zona horaria del negocio (límites diarios de intentos)
create or replace function public.business_day_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (date_trunc('day', now() at time zone 'Europe/Madrid') at time zone 'Europe/Madrid');
$$;
grant execute on function public.business_day_start() to service_role;
