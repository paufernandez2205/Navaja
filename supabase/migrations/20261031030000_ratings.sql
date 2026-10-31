-- Etapa 3: el cliente califica desde el link, sin login.
--
-- El cliente no tiene usuario, así que no puede tocar las tablas. Todo pasa por
-- estas funciones, que reciben el hash del token (lo calcula el servidor) y
-- responden igual ante cualquier link inválido: inexistente, vencido, usado,
-- turno no completado o ya calificado. Así no se revela el motivo.

-- Defensa extra: aunque alguien inserte por otro camino, solo se califican
-- turnos completados.
create function private.check_rating_appointment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.appointments a
    where a.id = new.appointment_id and a.status = 'completed'
  ) then
    raise exception 'Solo se califican turnos completados' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger ratings_check_appointment
  before insert on public.ratings
  for each row execute function private.check_rating_appointment();

-- Token válido → turno al que corresponde. Si no es válido, null.
create function private.valid_token_appointment(p_token_hash text, p_lock boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_appointment_id uuid;
begin
  if p_lock then
    select t.appointment_id into v_appointment_id
    from public.rating_tokens t
    where t.token_hash = p_token_hash
    for update;
  else
    select t.appointment_id into v_appointment_id
    from public.rating_tokens t
    where t.token_hash = p_token_hash;
  end if;

  if v_appointment_id is null then
    return null;
  end if;

  if exists (
    select 1
    from public.rating_tokens t
    join public.appointments a on a.id = t.appointment_id
    where t.appointment_id = v_appointment_id
      and t.used_at is null
      and t.expires_at > now()
      and a.status = 'completed'
      and not exists (select 1 from public.ratings r where r.appointment_id = a.id)
  ) then
    return v_appointment_id;
  end if;
  return null;
end;
$$;

-- Lo que muestra la pantalla del cliente: local y barbero. Sin datos personales.
create function public.get_rating_context(p_token_hash text)
returns table (location_name text, barber_name text, barber_photo_url text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_appointment_id uuid := private.valid_token_appointment(p_token_hash, false);
begin
  return query
    select l.name, b.name, b.photo_url
    from public.appointments a
    join public.locations l on l.id = a.location_id
    join public.barbers b on b.id = a.barber_id
    where a.id = v_appointment_id;
end;
$$;

-- Guarda la calificación y quema el token. Devuelve el id de la calificación,
-- que el cliente usa para ir a Google desde la pantalla final.
create function public.submit_rating(p_token_hash text, p_stars integer, p_comment text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_appointment_id uuid;
  v_comment text := nullif(btrim(p_comment), '');
  v_rating_id uuid;
begin
  if p_stars is null or p_stars not between 1 and 5 then
    raise exception 'Las estrellas van de 1 a 5' using errcode = 'invalid_parameter_value';
  end if;
  if char_length(v_comment) > 500 then
    raise exception 'El comentario puede tener hasta 500 caracteres' using errcode = 'invalid_parameter_value';
  end if;

  v_appointment_id := private.valid_token_appointment(p_token_hash, true);
  if v_appointment_id is null then
    raise exception 'Este link ya no es válido' using errcode = 'no_data_found';
  end if;

  insert into public.ratings (appointment_id, tenant_id, location_id, barber_id, stars, comment)
  select a.id, a.tenant_id, a.location_id, a.barber_id, p_stars, v_comment
  from public.appointments a
  where a.id = v_appointment_id
  returning id into v_rating_id;

  update public.rating_tokens set used_at = now() where appointment_id = v_appointment_id;

  return v_rating_id;
end;
$$;

-- Registra el clic en "Dejanos tu reseña en Google" y devuelve el link del local.
-- Se ofrece a todos por igual, sin importar las estrellas (prohibido el review gating).
create function public.record_google_click(p_rating_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
begin
  select l.google_review_url into v_url
  from public.ratings r
  join public.locations l on l.id = r.location_id
  where r.id = p_rating_id;

  if v_url is null then
    return null;
  end if;

  insert into public.google_clicks (rating_id) values (p_rating_id);
  return v_url;
end;
$$;

revoke all on function private.valid_token_appointment(text, boolean) from public, anon, authenticated;
revoke all on function public.get_rating_context(text) from public;
revoke all on function public.submit_rating(text, integer, text) from public;
revoke all on function public.record_google_click(uuid) from public;
grant execute on function public.get_rating_context(text) to anon, authenticated;
grant execute on function public.submit_rating(text, integer, text) to anon, authenticated;
grant execute on function public.record_google_click(uuid) to anon, authenticated;
