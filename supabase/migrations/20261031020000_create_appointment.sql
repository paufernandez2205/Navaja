-- Etapa 2: alta de turno y teléfono en una sola transacción.
-- Corre con los permisos de quien la llama (security invoker), así que las
-- reglas de RLS siguen decidiendo quién puede cargar turnos y dónde.

create function public.create_appointment(
  p_location_id uuid,
  p_barber_id uuid,
  p_scheduled_at timestamptz,
  p_phone_e164 text,
  p_phone_hmac text,
  p_walk_in boolean
)
returns uuid
language plpgsql set search_path = '' as $$
declare
  v_tenant_id uuid;
  v_id uuid;
begin
  if not p_walk_in and p_phone_e164 is null then
    raise exception 'Falta el teléfono del cliente' using errcode = 'not_null_violation';
  end if;

  select l.tenant_id into v_tenant_id from public.locations l where l.id = p_location_id;
  if v_tenant_id is null then
    raise exception 'Local inexistente' using errcode = 'no_data_found';
  end if;

  insert into public.appointments
    (tenant_id, location_id, barber_id, scheduled_at, status, completed_at, is_walk_in, created_by)
  values (
    v_tenant_id, p_location_id, p_barber_id,
    case when p_walk_in then now() else p_scheduled_at end,
    case when p_walk_in then 'completed'::public.appointment_status else 'scheduled' end,
    case when p_walk_in then now() end,
    p_walk_in, auth.uid()
  )
  returning id into v_id;

  if p_phone_e164 is not null then
    insert into public.appointment_contacts (appointment_id, phone_e164, phone_hmac)
    values (v_id, p_phone_e164, p_phone_hmac);
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_appointment(uuid, uuid, timestamptz, text, text, boolean) from public, anon;
grant execute on function public.create_appointment(uuid, uuid, timestamptz, text, text, boolean) to authenticated;
