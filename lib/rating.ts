import { z } from "zod";
import { hashToken } from "@/lib/tokens";

export const MAX_COMMENT = 500;

// Mismo mensaje para cualquier link inválido: no se revela el motivo.
export const INVALID_LINK = "Este link ya no es válido.";

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

const bodySchema = z.object({
  token: z.string(),
  stars: z.number().int().min(1).max(5),
  comment: z.string().nullish(),
});

type RpcError = { code?: string; message: string } | null;
export type Rpc = (
  fn: "submit_rating",
  args: { p_token_hash: string; p_stars: number; p_comment: string | null },
) => PromiseLike<{ data: unknown; error: RpcError }>;

export type SubmitResult =
  | { status: 201; body: { ratingId: string } }
  | { status: 409 | 422 | 500; body: { error: string } };

// Valida lo que manda el cliente y guarda la calificación.
// 201 guardada, 409 link inválido (uniforme), 422 datos inválidos.
export async function submitRating(rpc: Rpc, body: unknown): Promise<SubmitResult> {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return { status: 422, body: { error: "Elegí de 1 a 5 estrellas." } };
  }

  const comment = parsed.data.comment?.trim() || null;
  if (comment && comment.length > MAX_COMMENT) {
    return { status: 422, body: { error: `El comentario puede tener hasta ${MAX_COMMENT} caracteres.` } };
  }

  if (!tokenSchema.safeParse(parsed.data.token).success) {
    return { status: 409, body: { error: INVALID_LINK } };
  }

  const { data, error } = await rpc("submit_rating", {
    p_token_hash: hashToken(parsed.data.token),
    p_stars: parsed.data.stars,
    p_comment: comment,
  });

  if (error) {
    if (error.code === "P0002") return { status: 409, body: { error: INVALID_LINK } };
    if (error.code === "22023") return { status: 422, body: { error: error.message } };
    return { status: 500, body: { error: "Algo salió mal. Probá de nuevo." } };
  }
  return { status: 201, body: { ratingId: data as string } };
}
