import type { PGlite } from "@electric-sql/pglite";

// Datos de prueba: dos dueños (A y B). A tiene dos locales (A1 y A2).
export const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
export const T = { A: id(1), B: id(2) };
export const L = { A1: id(11), A2: id(12), B1: id(21) };
export const BR = { A: id(31), B: id(32), A2only: id(33) };
export const U = {
  ownerA: id(41),
  managerA1: id(42),
  staffA1: id(43),
  ownerB: id(44),
  staffB1: id(45),
};
export const AP = { A1: id(51), A2: id(52), B1: id(53), A1open: id(54) };
export const R = { A1: id(61), A2: id(62), B1: id(63) };

export async function seed(db: PGlite): Promise<void> {
  await db.exec(`
    insert into auth.users (id) values
      ('${U.ownerA}'), ('${U.managerA1}'), ('${U.staffA1}'), ('${U.ownerB}'), ('${U.staffB1}');
    insert into public.tenants (id, name) values ('${T.A}', 'Dueño A'), ('${T.B}', 'Dueño B');
    insert into public.locations (id, tenant_id, name) values
      ('${L.A1}', '${T.A}', 'Local A1'), ('${L.A2}', '${T.A}', 'Local A2'), ('${L.B1}', '${T.B}', 'Local B1');
    insert into public.barbers (id, tenant_id, name) values
      ('${BR.A}', '${T.A}', 'Barbero A'), ('${BR.B}', '${T.B}', 'Barbero B'),
      ('${BR.A2only}', '${T.A}', 'Barbero solo A2');
    insert into public.barber_locations (tenant_id, barber_id, location_id) values
      ('${T.A}', '${BR.A}', '${L.A1}'), ('${T.A}', '${BR.A}', '${L.A2}'),
      ('${T.B}', '${BR.B}', '${L.B1}'), ('${T.A}', '${BR.A2only}', '${L.A2}');
    insert into public.memberships (user_id, tenant_id, location_id, role) values
      ('${U.ownerA}', '${T.A}', null, 'owner'),
      ('${U.managerA1}', '${T.A}', '${L.A1}', 'manager'),
      ('${U.staffA1}', '${T.A}', '${L.A1}', 'staff'),
      ('${U.ownerB}', '${T.B}', null, 'owner'),
      ('${U.staffB1}', '${T.B}', '${L.B1}', 'staff');
    insert into public.appointments (id, tenant_id, location_id, barber_id, scheduled_at, status, completed_at) values
      ('${AP.A1}', '${T.A}', '${L.A1}', '${BR.A}', now(), 'completed', now()),
      ('${AP.A2}', '${T.A}', '${L.A2}', '${BR.A}', now(), 'completed', now()),
      ('${AP.B1}', '${T.B}', '${L.B1}', '${BR.B}', now(), 'completed', now()),
      ('${AP.A1open}', '${T.A}', '${L.A1}', '${BR.A}', now(), 'scheduled', null);
    insert into public.appointment_contacts (appointment_id, phone_e164) values
      ('${AP.A1}', '+5491111111111'), ('${AP.A2}', '+5491122222222'), ('${AP.B1}', '+5491133333333');
    insert into public.ratings (id, appointment_id, tenant_id, location_id, barber_id, stars) values
      ('${R.A1}', '${AP.A1}', '${T.A}', '${L.A1}', '${BR.A}', 5),
      ('${R.A2}', '${AP.A2}', '${T.A}', '${L.A2}', '${BR.A}', 3),
      ('${R.B1}', '${AP.B1}', '${T.B}', '${L.B1}', '${BR.B}', 4);
    insert into public.google_clicks (rating_id) values ('${R.A1}'), ('${R.B1}');
  `);
}
