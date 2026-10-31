import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffLocation = { id: string; name: string; timezone: string };

// Devuelve el usuario de recepción y sus locales, o lo manda al login.
// Cada Server Action la vuelve a llamar: nunca se confía en lo que manda el navegador.
export async function requireStaff() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("location_id")
    .eq("user_id", userId)
    .eq("role", "staff");
  if (error) throw error;

  const ids = (memberships ?? []).map((m) => m.location_id as string);
  if (ids.length === 0) redirect("/login?error=sin-acceso");

  const { data: locations, error: locError } = await supabase
    .from("locations")
    .select("id, name, timezone")
    .in("id", ids)
    .order("name");
  if (locError) throw locError;

  return { supabase, userId, locations: (locations ?? []) as StaffLocation[] };
}
