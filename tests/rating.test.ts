// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { INVALID_LINK, submitRating, type Rpc } from "@/lib/rating";
import { generateToken, hashToken } from "@/lib/tokens";

const token = generateToken();

function rpcReturning(result: { data?: unknown; error?: { code: string; message: string } }) {
  return vi.fn<Rpc>(async () => ({ data: result.data ?? null, error: result.error ?? null }));
}

describe("submitRating", () => {
  test("201 y manda solo el hash del token", async () => {
    const rpc = rpcReturning({ data: "rating-1" });
    const res = await submitRating(rpc, { token, stars: 5, comment: "  Excelente  " });
    expect(res).toEqual({ status: 201, body: { ratingId: "rating-1" } });
    expect(rpc).toHaveBeenCalledWith("submit_rating", {
      p_token_hash: hashToken(token),
      p_stars: 5,
      p_comment: "Excelente",
    });
  });

  test("comentario vacío o con espacios se manda como null", async () => {
    const rpc = rpcReturning({ data: "r" });
    await submitRating(rpc, { token, stars: 3, comment: "   " });
    expect(rpc.mock.calls[0][1].p_comment).toBeNull();
  });

  test.each([0, 6, 2.5, "5", null])("422 con estrellas %j, sin tocar la base", async (stars) => {
    const rpc = rpcReturning({});
    const res = await submitRating(rpc, { token, stars });
    expect(res.status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });

  test("422 con más de 500 caracteres", async () => {
    const rpc = rpcReturning({});
    const res = await submitRating(rpc, { token, stars: 4, comment: "a".repeat(501) });
    expect(res.status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });

  test("409 uniforme si el token no tiene el formato correcto", async () => {
    const rpc = rpcReturning({});
    const res = await submitRating(rpc, { token: "cualquier-cosa", stars: 4 });
    expect(res).toEqual({ status: 409, body: { error: INVALID_LINK } });
    expect(rpc).not.toHaveBeenCalled();
  });

  test("409 uniforme si la base dice que el link no es válido", async () => {
    const rpc = rpcReturning({ error: { code: "P0002", message: "Este link ya no es válido" } });
    expect(await submitRating(rpc, { token, stars: 4 })).toEqual({
      status: 409,
      body: { error: INVALID_LINK },
    });
  });

  test("500 genérico ante un error inesperado, sin mostrar detalles", async () => {
    const rpc = rpcReturning({ error: { code: "XX000", message: "detalle interno" } });
    const res = await submitRating(rpc, { token, stars: 4 });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("detalle interno");
  });
});
