import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAnonClient } from "@/lib/supabase/anon";

// Botón "¿Nos dejás tu reseña en Google?": registra el clic y redirige al
// link de reseñas del local, que sale de la base (no del navegador).
export async function GET(request: NextRequest, ctx: RouteContext<"/g/[ratingId]">) {
  const { ratingId } = await ctx.params;
  const home = new URL("/", request.url);
  if (!z.uuid().safeParse(ratingId).success) return NextResponse.redirect(home);

  const { data } = await createAnonClient().rpc("record_google_click", { p_rating_id: ratingId });
  return NextResponse.redirect(typeof data === "string" ? data : home);
}
