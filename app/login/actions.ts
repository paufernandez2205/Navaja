"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { readServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) redirect("/login?error=email");

  const supabase = await createClient();
  const { appUrl } = readServerEnv(process.env);
  // shouldCreateUser: false → solo entra quien fue invitado. Si el email no
  // está invitado, Supabase no manda nada, pero la pantalla dice lo mismo
  // para no revelar qué emails existen.
  await supabase.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: false, emailRedirectTo: new URL("/auth/confirm", appUrl).toString() },
  });
  redirect("/login?enviado=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
