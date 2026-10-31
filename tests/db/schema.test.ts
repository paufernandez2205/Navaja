// @vitest-environment node
import { beforeAll, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb } from "./helpers";
import { AP, BR, L, R, T, U, id, seed } from "./seed";

let db: PGlite;

async function count(table: string): Promise<number> {
  const res = await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
  return res.rows[0].n;
}

beforeAll(async () => {
  db = await createTestDb();
  await seed(db);
});

describe("aislamiento entre dueños", () => {
  test("el dueño A ve solo lo suyo", async () => {
    await as(db, U.ownerA, async () => {
      expect(await count("tenants")).toBe(1);
      expect(await count("locations")).toBe(2);
      expect(await count("barbers")).toBe(2);
      expect(await count("appointments")).toBe(3);
      expect(await count("ratings")).toBe(2);
      expect(await count("google_clicks")).toBe(1);
    });
  });

  test("el dueño B no ve nada de A", async () => {
    await as(db, U.ownerB, async () => {
      const res = await db.query<{ id: string }>("select id from public.ratings");
      expect(res.rows.map((r) => r.id)).toEqual([R.B1]);
      expect(await count("locations")).toBe(1);
    });
  });

  test("el dueño A no puede ocultar una calificación de B", async () => {
    await as(db, U.ownerA, async () => {
      const res = await db.query(`update public.ratings set hidden = true where id = '${R.B1}'`);
      expect(res.affectedRows).toBe(0);
    });
  });

  test("recepción no puede cargar turnos en un local de otro dueño", async () => {
    await as(db, U.staffA1, async () => {
      await expect(
        db.query(
          `insert into public.appointments (tenant_id, location_id, barber_id, scheduled_at, created_by)
           values ('${T.B}', '${L.B1}', '${BR.B}', now(), '${U.staffA1}')`,
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  test("un turno no puede mezclar un local de A con un barbero de B", async () => {
    await expect(
      db.query(
        `insert into public.appointments (tenant_id, location_id, barber_id, scheduled_at)
         values ('${T.A}', '${L.A1}', '${BR.B}', now())`,
      ),
    ).rejects.toThrow(/foreign key|no trabaja en ese local/);
  });

  test("un usuario sin login no puede leer nada", async () => {
    await as(db, null, async () => {
      for (const table of ["tenants", "ratings", "appointments", "appointment_contacts"]) {
        await expect(count(table)).rejects.toThrow(/permission denied/);
      }
    });
  });
});

describe("roles dentro de un mismo dueño", () => {
  test("el encargado ve solo las calificaciones de su local", async () => {
    await as(db, U.managerA1, async () => {
      const res = await db.query<{ id: string }>("select id from public.ratings");
      expect(res.rows.map((r) => r.id)).toEqual([R.A1]);
      expect(await count("locations")).toBe(1);
    });
  });

  test("el encargado no puede ocultar calificaciones", async () => {
    await as(db, U.managerA1, async () => {
      const res = await db.query(`update public.ratings set hidden = true where id = '${R.A1}'`);
      expect(res.affectedRows).toBe(0);
    });
  });

  test("el dueño puede ocultar y volver a mostrar una calificación", async () => {
    await as(db, U.ownerA, async () => {
      const hide = await db.query(`update public.ratings set hidden = true where id = '${R.A1}'`);
      expect(hide.affectedRows).toBe(1);
      const show = await db.query(`update public.ratings set hidden = false where id = '${R.A1}'`);
      expect(show.affectedRows).toBe(1);
    });
  });

  test("nadie puede cambiar las estrellas desde la app", async () => {
    await as(db, U.ownerA, async () => {
      await expect(
        db.query(`update public.ratings set stars = 1 where id = '${R.A1}'`),
      ).rejects.toThrow(/permission denied/);
    });
  });

  test("recepción no ve calificaciones", async () => {
    await as(db, U.staffA1, async () => {
      expect(await count("ratings")).toBe(0);
    });
  });

  test("recepción carga turnos en su local", async () => {
    await as(db, U.staffA1, async () => {
      const res = await db.query(
        `insert into public.appointments (tenant_id, location_id, barber_id, scheduled_at, created_by)
         values ('${T.A}', '${L.A1}', '${BR.A}', now(), '${U.staffA1}')`,
      );
      expect(res.affectedRows).toBe(1);
    });
  });

  test("recepción no carga turnos en otro local del mismo dueño", async () => {
    await as(db, U.staffA1, async () => {
      await expect(
        db.query(
          `insert into public.appointments (tenant_id, location_id, barber_id, scheduled_at, created_by)
           values ('${T.A}', '${L.A2}', '${BR.A}', now(), '${U.staffA1}')`,
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  test("el dueño no puede crear otro dueño", async () => {
    await as(db, U.ownerA, async () => {
      await expect(
        db.query(
          `insert into public.memberships (user_id, tenant_id, role)
           values ('${U.managerA1}', '${T.A}', 'owner')`,
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });
});

describe("teléfonos", () => {
  test("el dueño no puede leer teléfonos", async () => {
    await as(db, U.ownerA, async () => {
      expect(await count("appointment_contacts")).toBe(0);
    });
  });

  test("el encargado no puede leer teléfonos", async () => {
    await as(db, U.managerA1, async () => {
      expect(await count("appointment_contacts")).toBe(0);
    });
  });

  test("recepción ve solo los teléfonos de su local", async () => {
    await as(db, U.staffA1, async () => {
      const res = await db.query<{ appointment_id: string }>(
        "select appointment_id from public.appointment_contacts",
      );
      expect(res.rows.map((r) => r.appointment_id)).toEqual([AP.A1]);
    });
  });

  test("rechaza teléfonos que no están en formato E.164", async () => {
    await expect(
      db.query(
        `insert into public.appointment_contacts (appointment_id, phone_e164) values ('${AP.A1open}', '11 5555-5555')`,
      ),
    ).rejects.toThrow(/check constraint/);
  });

  test("los tokens no se pueden leer desde la app", async () => {
    await as(db, U.ownerA, async () => {
      await expect(count("rating_tokens")).rejects.toThrow(/permission denied/);
    });
  });
});

describe("reglas de las calificaciones", () => {
  const DONE = id(80); // completado y sin calificar

  beforeAll(async () => {
    await db.exec(`
      insert into public.appointments (id, tenant_id, location_id, barber_id, scheduled_at, status, completed_at)
      values ('${DONE}', '${T.A}', '${L.A1}', '${BR.A}', now(), 'completed', now());
    `);
  });

  const insertRating = (stars: number, comment: string | null = null, appt = DONE) =>
    db.query(
      `insert into public.ratings (appointment_id, tenant_id, location_id, barber_id, stars, comment)
       values ($1, '${T.A}', '${L.A1}', '${BR.A}', $2, $3)`,
      [appt, stars, comment],
    );

  test("una sola calificación por turno", async () => {
    await expect(insertRating(4, null, AP.A1)).rejects.toThrow(/duplicate key/);
  });

  test.each([0, 6])("rechaza %i estrellas", async (stars) => {
    await expect(insertRating(stars)).rejects.toThrow(/check constraint/);
  });

  test("rechaza un comentario solo con espacios", async () => {
    await expect(insertRating(4, "   ")).rejects.toThrow(/check constraint/);
  });

  test("rechaza un comentario de más de 500 caracteres", async () => {
    await expect(insertRating(4, "a".repeat(501))).rejects.toThrow(/check constraint/);
  });

  test("la calificación tiene que coincidir con el local y barbero del turno", async () => {
    await expect(
      db.query(
        `insert into public.ratings (appointment_id, tenant_id, location_id, barber_id, stars)
         values ('${DONE}', '${T.A}', '${L.A2}', '${BR.A}', 5)`,
      ),
    ).rejects.toThrow(/foreign key/);
  });

  test("solo se califican turnos completados", async () => {
    await expect(insertRating(5, null, AP.A1open)).rejects.toThrow(
      "Solo se califican turnos completados",
    );
  });

  test("un turno completado necesita fecha de finalización", async () => {
    await expect(
      db.query(`update public.appointments set status = 'completed' where id = '${AP.A1open}'`),
    ).rejects.toThrow(/check constraint/);
  });
});
