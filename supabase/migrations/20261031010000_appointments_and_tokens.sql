-- Etapa 2: reglas de los turnos y emisión de tokens de calificación.

-- Un turno solo cambia mientras está agendado. Completado o cancelado es final.
create function private.check_appointment_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status <> 'scheduled'
     and (new.status, new.barber_id, new.scheduled_at, new.completed_at)
         is distinct from (old.status, old.barber_id, old.scheduled_at, old.completed_at) then
    raise exception 'El turno ya está % y no se puede modificar', old.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger appointments_check_change
  before update on public.appointments
  for each row execute function private.check_appointment_change();

-- El barbero tiene que trabajar en el local del turno. Es security definer para
-- comprobarlo con los datos reales; el acceso al local lo sigue decidiendo RLS.
create function private.check_barber_works_at_location()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.barber_locations bl
    where bl.barber_id = new.barber_id and bl.location_id = new.location_id
  ) then
    raise exception 'El barbero no trabaja en ese local'
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger appointments_check_barber_location
  before insert or update of barber_id, location_id on public.appointments
  for each row execute function private.check_barber_works_at_location();

-- Emite (o reemplaza) el token de un turno completado y devuelve su vencimiento.
-- El servidor genera el token, guarda acá solo el hash y manda el token en el link.
-- Reemplazar invalida el link anterior. Todos los rechazos usan el mismo mensaje
-- para no revelar si el turno existe, es de otro local o ya fue calificado.
create function public.issue_rating_token(
  p_appointment_id uuid,
  p_token_hash text,
  p_channel public.rating_channel
)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  v_expires_at timestamptz := now() + interval '72 hours';
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Hash de token inválido' using errcode = 'invalid_parameter_value';
  end if;

  if not exists (
    select 1 from public.appointments a
    where a.id = p_appointment_id
      and a.status = 'completed'
      and private.can_operate(a.location_id)
      and not exists (select 1 from public.ratings r where r.appointment_id = a.id)
  ) then
    raise exception 'No se puede enviar la calificación para este turno'
      using errcode = 'no_data_found';
  end if;

  insert into public.rating_tokens (appointment_id, token_hash, channel, expires_at)
  values (p_appointment_id, p_token_hash, p_channel, v_expires_at)
  on conflict (appointment_id) do update
    set token_hash = excluded.token_hash,
        channel = excluded.channel,
        expires_at = excluded.expires_at,
        used_at = null,
        created_at = now();

  return v_expires_at;
end;
$$;

revoke all on function public.issue_rating_token(uuid, text, public.rating_channel) from public, anon;
grant execute on function public.issue_rating_token(uuid, text, public.rating_channel) to authenticated;
