// @vitest-environment node
import { beforeEach, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb } from "./helpers";
import { AP, BR, L, T, U, id, seed } from "./seed";

const HASH_1 = "a".repeat(64);
const HASH_2 = "b".repeat(64);
const DONE_A1 = id(71); // completado y sin calificar, local A1
const DONE_A2 = id(72); // completado y sin calificar, local A2

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
  await seed(db);
  await db.exec(`
    insert into public.appointments (id, tenant_id, location_id, barber_id, scheduled_at, status, completed_at) values
      ('${DONE_A1}', '${T.A}', '${L.A1}', '${BR.A}', now(), 'completed', now()),
      ('${DONE_A2}', '${T.A}', '${L.A2}', '${BR.A}', now(), 'completed', now());
  `);
});

const issue = (appointmentId: string, hash = HASH_1, channel = "whatsapp") =>
  db.query<{ expires_at: Date }>(
    "select public.issue_rating_token($1, $2, $3) as expires_at",
    [appointmentId, hash, channel],
  );

async function tokenFor(appointmentId: string) {
  const res = await db.query<{ token_hash: string; channel: string }>(
    "select token_hash, channel from public.rating_tokens where appointment_id = $1",
    [appointmentId],
  );
  return res.rows[0];
}

describe("emisión de tokens", () => {
  test("recepción emite un token que vence en 72 horas", async () => {
    const res = await as(db, U.staffA1, () => issue(DONE_A1));
    const hours = (res.rows[0].expires_at.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(71.9);
    expect(hours).toBeLessThanOrEqual(72);
    expect(await tokenFor(DONE_A1)).toEqual({ token_hash: HASH_1, channel: "whatsapp" });
  });

  test("reenviar reemplaza el token anterior", async () => {
    await as(db, U.staffA1, async () => {
      await issue(DONE_A1, HASH_1);
      await issue(DONE_A1, HASH_2, "qr");
    });
    expect(await tokenFor(DONE_A1)).toEqual({ token_hash: HASH_2, channel: "qr" });
  });

  test.each([
    ["un turno sin completar", () => AP.A1open],
    ["un turno ya calificado", () => AP.A1],
    ["un turno de otro local", () => DONE_A2],
    ["un turno de otro dueño", () => AP.B1],
  ])("rechaza con el mismo mensaje %s", async (_, appt) => {
    await as(db, U.staffA1, async () => {
      await expect(issue(appt())).rejects.toThrow(
        "No se puede enviar la calificación para este turno",
      );
    });
  });

  test("el dueño no emite tokens (lo hace recepción)", async () => {
    await as(db, U.ownerA, async () => {
      await expect(issue(DONE_A1)).rejects.toThrow("No se puede enviar la calificación");
    });
  });

  test("un usuario sin login no puede emitir tokens", async () => {
    await as(db, null, async () => {
      await expect(issue(DONE_A1)).rejects.toThrow(/permission denied/);
    });
  });

  test("rechaza algo que no es un hash", async () => {
    await as(db, U.staffA1, async () => {
      await expect(issue(DONE_A1, "token-en-claro")).rejects.toThrow("Hash de token inválido");
    });
  });
});

describe("estados del turno", () => {
  test("recepción completa un turno agendado", async () => {
    await as(db, U.staffA1, async () => {
      const res = await db.query(
        `update public.appointments set status = 'completed', completed_at = now() where id = '${AP.A1open}'`,
      );
      expect(res.affectedRows).toBe(1);
    });
  });

  test("un turno completado no vuelve atrás", async () => {
    await as(db, U.staffA1, async () => {
      await expect(
        db.query(
          `update public.appointments set status = 'scheduled', completed_at = null where id = '${DONE_A1}'`,
        ),
      ).rejects.toThrow("El turno ya está completed");
    });
  });

  test("un turno cancelado no se puede completar", async () => {
    await as(db, U.staffA1, async () => {
      await db.query(`update public.appointments set status = 'cancelled' where id = '${AP.A1open}'`);
      await expect(
        db.query(
          `update public.appointments set status = 'completed', completed_at = now() where id = '${AP.A1open}'`,
        ),
      ).rejects.toThrow("El turno ya está cancelled");
    });
  });

  test("el barbero tiene que trabajar en el local del turno", async () => {
    await as(db, U.staffA1, async () => {
      await expect(
        db.query(
          `insert into public.appointments (tenant_id, location_id, barber_id, scheduled_at, created_by)
           values ('${T.A}', '${L.A1}', '${BR.A2only}', now(), '${U.staffA1}')`,
        ),
      ).rejects.toThrow("El barbero no trabaja en ese local");
    });
  });

  test("recepción registra un walk-in completado con su teléfono", async () => {
    await as(db, U.staffA1, async () => {
      const res = await db.query<{ id: string }>(
        `insert into public.appointments
           (tenant_id, location_id, barber_id, scheduled_at, status, completed_at, is_walk_in, created_by)
         values ('${T.A}', '${L.A1}', '${BR.A}', now(), 'completed', now(), true, '${U.staffA1}')
         returning id`,
      );
      const apptId = res.rows[0].id;
      await db.query(
        "insert into public.appointment_contacts (appointment_id, phone_e164, phone_hmac) values ($1, $2, $3)",
        [apptId, "+5491155555555", "c".repeat(64)],
      );
      await issue(apptId, HASH_1, "qr");
    });
  });
});
