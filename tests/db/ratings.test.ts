// @vitest-environment node
import { beforeEach, describe, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb } from "./helpers";
import { AP, BR, L, R, T, U, id, seed } from "./seed";

const DONE = id(91); // completado, sin calificar, con token válido
const OPEN = id(92); // agendado, con token (no debería poder calificarse)
const H = {
  valid: "1".repeat(64),
  expired: "2".repeat(64),
  used: "3".repeat(64),
  open: "4".repeat(64),
  rated: "5".repeat(64),
  unknown: "6".repeat(64),
};

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
  await seed(db);
  await db.exec(`
    update public.locations set google_review_url = 'https://g.page/r/test/review' where id = '${L.A1}';
    insert into public.appointments (id, tenant_id, location_id, barber_id, scheduled_at, status, completed_at) values
      ('${DONE}', '${T.A}', '${L.A1}', '${BR.A}', now(), 'completed', now()),
      ('${OPEN}', '${T.A}', '${L.A1}', '${BR.A}', now(), 'scheduled', null);
    insert into public.rating_tokens (appointment_id, token_hash, channel, expires_at, used_at) values
      ('${DONE}', '${H.valid}', 'whatsapp', now() + interval '72 hours', null),
      ('${OPEN}', '${H.open}', 'whatsapp', now() + interval '72 hours', null),
      ('${AP.A1}', '${H.rated}', 'whatsapp', now() + interval '72 hours', null),
      ('${AP.A2}', '${H.used}', 'qr', now() + interval '72 hours', now()),
      ('${AP.B1}', '${H.expired}', 'qr', now() - interval '1 minute', null);
  `);
});

const context = (hash: string) =>
  as(db, null, () => db.query("select * from public.get_rating_context($1)", [hash]));

const submit = (hash: string, stars: number, comment: string | null = null) =>
  as(db, null, () =>
    db.query<{ id: string }>("select public.submit_rating($1, $2, $3) as id", [hash, stars, comment]),
  );

describe("abrir el link", () => {
  test("un link válido muestra local y barbero, sin datos del cliente", async () => {
    const res = await context(H.valid);
    expect(res.rows).toEqual([
      {
        location_name: "Local A1",
        barber_name: "Barbero A",
        barber_photo_url: null,
        has_google_review: true,
      },
    ]);
  });

  test.each([
    ["vencido", H.expired],
    ["ya usado", H.used],
    ["de un turno no completado", H.open],
    ["de un turno ya calificado", H.rated],
    ["inexistente", H.unknown],
  ])("un link %s no muestra nada", async (_, hash) => {
    expect((await context(hash)).rows).toEqual([]);
  });
});

describe("calificar", () => {
  test("guarda la calificación y quema el link", async () => {
    const ratingId = (await submit(H.valid, 4, "  Muy bien  ")).rows[0].id;
    const res = await db.query("select stars, comment, location_id, barber_id from public.ratings where id = $1", [
      ratingId,
    ]);
    expect(res.rows).toEqual([{ stars: 4, comment: "Muy bien", location_id: L.A1, barber_id: BR.A }]);
    expect((await context(H.valid)).rows).toEqual([]);
  });

  test("un comentario vacío o con espacios se guarda como NULL", async () => {
    const ratingId = (await submit(H.valid, 5, "   ")).rows[0].id;
    const res = await db.query<{ comment: string | null }>(
      "select comment from public.ratings where id = $1",
      [ratingId],
    );
    expect(res.rows[0].comment).toBeNull();
  });

  test("el mismo link no sirve dos veces", async () => {
    await submit(H.valid, 5);
    await expect(submit(H.valid, 1)).rejects.toThrow("Este link ya no es válido");
  });

  test.each([
    ["vencido", H.expired],
    ["ya usado", H.used],
    ["de un turno no completado", H.open],
    ["de un turno ya calificado", H.rated],
    ["inexistente", H.unknown],
  ])("rechaza con el mismo mensaje un link %s", async (_, hash) => {
    await expect(submit(hash, 5)).rejects.toThrow("Este link ya no es válido");
  });

  test.each([0, 6, -1])("rechaza %i estrellas", async (stars) => {
    await expect(submit(H.valid, stars)).rejects.toThrow("Las estrellas van de 1 a 5");
  });

  test("rechaza un comentario de más de 500 caracteres", async () => {
    await expect(submit(H.valid, 5, "a".repeat(501))).rejects.toThrow("hasta 500 caracteres");
  });

  test("acepta un comentario de exactamente 500 caracteres", async () => {
    await expect(submit(H.valid, 5, "a".repeat(500))).resolves.toBeDefined();
  });

  test("un rechazo por estrellas no quema el link", async () => {
    await expect(submit(H.valid, 9)).rejects.toThrow();
    expect((await context(H.valid)).rows).toHaveLength(1);
  });

  test("el cliente sin login sigue sin poder leer calificaciones ni tokens", async () => {
    await as(db, null, async () => {
      await expect(db.query("select * from public.ratings")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.rating_tokens")).rejects.toThrow(/permission denied/);
    });
  });

  test("el dueño ve la calificación nueva en su panel", async () => {
    await submit(H.valid, 3);
    await as(db, U.ownerA, async () => {
      const res = await db.query("select stars from public.ratings where appointment_id = $1", [DONE]);
      expect(res.rows).toEqual([{ stars: 3 }]);
    });
  });
});

describe("clic a Google", () => {
  test("registra el clic y devuelve el link del local", async () => {
    const ratingId = (await submit(H.valid, 1)).rows[0].id;
    const res = await as(db, null, () =>
      db.query<{ url: string }>("select public.record_google_click($1) as url", [ratingId]),
    );
    expect(res.rows[0].url).toBe("https://g.page/r/test/review");
    const clicks = await db.query<{ n: number }>(
      "select count(*)::int as n from public.google_clicks where rating_id = $1",
      [ratingId],
    );
    expect(clicks.rows[0].n).toBe(1);
  });

  test("si el local no tiene link de Google no registra nada", async () => {
    const res = await as(db, null, () =>
      db.query<{ url: string | null }>("select public.record_google_click($1) as url", [R.A2]),
    );
    expect(res.rows[0].url).toBeNull();
  });
});
