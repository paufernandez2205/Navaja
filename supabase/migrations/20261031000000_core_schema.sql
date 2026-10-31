-- Etapa 1: modelo de datos, roles y aislamiento entre dueños.
--
-- Cada dueño es un "tenant". Toda tabla con datos de un dueño lleva tenant_id,
-- y las claves foráneas compuestas (tenant_id, id) impiden que un registro
-- apunte a un local o barbero de otro dueño, aunque el código tenga un error.
-- El acceso de cada usuario lo decide la base con Row Level Security (RLS).

create schema if not exists private;

create type public.member_role as enum ('owner', 'manager', 'staff');
create type public.appointment_status as enum ('scheduled', 'completed', 'cancelled');
create type public.rating_channel as enum ('whatsapp', 'qr');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  google_review_url text check (google_review_url ~ '^https://'),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);

-- Los barberos no tienen usuario: son una ficha con nombre y foto.
create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create table public.barber_locations (
  tenant_id uuid not null,
  barber_id uuid not null,
  location_id uuid not null,
  primary key (barber_id, location_id),
  foreign key (tenant_id, barber_id) references public.barbers (tenant_id, id) on delete cascade,
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete cascade
);

-- owner: ve todos los locales del tenant (location_id vacío).
-- manager: ve solo su local. staff: carga turnos y envía calificaciones en su local.
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete cascade,
  check ((role = 'owner') = (location_id is null)),
  unique nulls not distinct (user_id, tenant_id, location_id, role)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  location_id uuid not null,
  barber_id uuid not null,
  scheduled_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  is_walk_in boolean not null default false,
  completed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete cascade,
  foreign key (tenant_id, barber_id) references public.barbers (tenant_id, id),
  check ((status = 'completed') = (completed_at is not null)),
  unique (id, tenant_id, location_id, barber_id)
);

create index appointments_location_scheduled_idx on public.appointments (location_id, scheduled_at);
create index appointments_barber_scheduled_idx on public.appointments (barber_id, scheduled_at);

-- El teléfono va aparte para que el dueño y el encargado nunca puedan leerlo.
-- phone_hmac es una huella del número para el antifraude (se calcula en el servidor).
create table public.appointment_contacts (
  appointment_id uuid primary key references public.appointments (id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_hmac text,
  created_at timestamptz not null default now()
);

create index appointment_contacts_phone_hmac_idx on public.appointment_contacts (phone_hmac);

-- Un token por turno. Solo se guarda el hash; el token en claro viaja en el link.
create table public.rating_tokens (
  appointment_id uuid primary key references public.appointments (id) on delete cascade,
  token_hash text not null unique,
  channel public.rating_channel not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- La clave foránea compuesta garantiza que local y barbero coincidan con el turno.
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique,
  tenant_id uuid not null,
  location_id uuid not null,
  barber_id uuid not null,
  stars smallint not null check (stars between 1 and 5),
  comment text check (comment is null or (char_length(comment) <= 500 and btrim(comment) <> '')),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (appointment_id, tenant_id, location_id, barber_id)
    references public.appointments (id, tenant_id, location_id, barber_id) on delete cascade
);

create index ratings_location_created_idx on public.ratings (location_id, created_at);
create index ratings_barber_created_idx on public.ratings (barber_id, created_at);

create table public.google_clicks (
  id bigint generated always as identity primary key,
  rating_id uuid not null references public.ratings (id) on delete cascade,
  clicked_at timestamptz not null default now()
);

create index google_clicks_rating_idx on public.google_clicks (rating_id);

-- ---------------------------------------------------------------------------
-- Funciones de permisos (en un esquema privado, fuera de la API pública).
-- Son security definer para poder leer memberships sin recursión de RLS.
-- ---------------------------------------------------------------------------

create function private.is_tenant_member(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.tenant_id = p_tenant
  );
$$;

create function private.is_tenant_owner(p_tenant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.tenant_id = p_tenant and m.role = 'owner'
  );
$$;

-- Dueño del tenant o cualquier rol asignado a ese local.
create function private.can_view_location(p_location uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.locations l
    join public.memberships m on m.tenant_id = l.tenant_id
    where l.id = p_location and m.user_id = auth.uid()
      and (m.role = 'owner' or m.location_id = l.id)
  );
$$;

-- Puede ver métricas y calificaciones: dueño del tenant o encargado del local.
create function private.can_report_on(p_location uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.locations l
    join public.memberships m on m.tenant_id = l.tenant_id
    where l.id = p_location and m.user_id = auth.uid()
      and (m.role = 'owner' or (m.role = 'manager' and m.location_id = l.id))
  );
$$;

-- Puede operar el mostrador (turnos y teléfonos): recepción del local.
create function private.can_operate(p_location uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.location_id = p_location and m.role = 'staff'
  );
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Permisos por tabla. Se parte de cero y se habilita solo lo necesario.
-- ---------------------------------------------------------------------------

revoke all on
  public.tenants, public.locations, public.barbers, public.barber_locations,
  public.memberships, public.appointments, public.appointment_contacts,
  public.rating_tokens, public.ratings, public.google_clicks
from anon, authenticated;

alter table public.tenants enable row level security;
alter table public.locations enable row level security;
alter table public.barbers enable row level security;
alter table public.barber_locations enable row level security;
alter table public.memberships enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_contacts enable row level security;
alter table public.rating_tokens enable row level security;
alter table public.ratings enable row level security;
alter table public.google_clicks enable row level security;

-- tenants
grant select, update (name) on public.tenants to authenticated;
create policy tenants_select on public.tenants for select to authenticated
  using (private.is_tenant_member(id));
create policy tenants_update on public.tenants for update to authenticated
  using (private.is_tenant_owner(id)) with check (private.is_tenant_owner(id));

-- locations
grant select, insert, update, delete on public.locations to authenticated;
create policy locations_select on public.locations for select to authenticated
  using (private.can_view_location(id));
create policy locations_write on public.locations for all to authenticated
  using (private.is_tenant_owner(tenant_id)) with check (private.is_tenant_owner(tenant_id));

-- barbers
grant select, insert, update, delete on public.barbers to authenticated;
create policy barbers_select on public.barbers for select to authenticated
  using (private.is_tenant_member(tenant_id));
create policy barbers_write on public.barbers for all to authenticated
  using (private.is_tenant_owner(tenant_id)) with check (private.is_tenant_owner(tenant_id));

-- barber_locations
grant select, insert, delete on public.barber_locations to authenticated;
create policy barber_locations_select on public.barber_locations for select to authenticated
  using (private.is_tenant_member(tenant_id));
create policy barber_locations_write on public.barber_locations for all to authenticated
  using (private.is_tenant_owner(tenant_id)) with check (private.is_tenant_owner(tenant_id));

-- memberships: cada uno ve las suyas; el dueño administra las de su tenant,
-- pero no puede crear otros dueños (eso se hace al dar de alta el tenant).
grant select, insert, delete on public.memberships to authenticated;
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or private.is_tenant_owner(tenant_id));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (private.is_tenant_owner(tenant_id) and role <> 'owner');
create policy memberships_delete on public.memberships for delete to authenticated
  using (private.is_tenant_owner(tenant_id) and role <> 'owner');

-- appointments: recepción los carga; dueño y encargado solo los leen.
grant select, insert on public.appointments to authenticated;
grant update (barber_id, scheduled_at, status, completed_at) on public.appointments to authenticated;
create policy appointments_select on public.appointments for select to authenticated
  using (private.can_report_on(location_id) or private.can_operate(location_id));
create policy appointments_insert on public.appointments for insert to authenticated
  with check (private.can_operate(location_id) and created_by = auth.uid());
create policy appointments_update on public.appointments for update to authenticated
  using (private.can_operate(location_id)) with check (private.can_operate(location_id));

-- appointment_contacts: solo recepción del local. Dueño y encargado, nunca.
grant select, insert on public.appointment_contacts to authenticated;
create policy appointment_contacts_select on public.appointment_contacts for select to authenticated
  using (exists (
    select 1 from public.appointments a
    where a.id = appointment_id and private.can_operate(a.location_id)
  ));
create policy appointment_contacts_insert on public.appointment_contacts for insert to authenticated
  with check (exists (
    select 1 from public.appointments a
    where a.id = appointment_id and private.can_operate(a.location_id)
  ));

-- rating_tokens: sin acceso directo. Se manejan solo desde el servidor (etapa 2).

-- ratings: se crean solo desde el servidor (etapa 3). El dueño puede ocultarlas.
grant select, update (hidden) on public.ratings to authenticated;
create policy ratings_select on public.ratings for select to authenticated
  using (private.can_report_on(location_id));
create policy ratings_hide on public.ratings for update to authenticated
  using (private.is_tenant_owner(tenant_id)) with check (private.is_tenant_owner(tenant_id));

-- google_clicks: lectura para quien puede ver la calificación.
grant select on public.google_clicks to authenticated;
create policy google_clicks_select on public.google_clicks for select to authenticated
  using (exists (
    select 1 from public.ratings r
    where r.id = rating_id and private.can_report_on(r.location_id)
  ));
