import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

// Cliente sin sesión, para lo que hace el cliente final (no tiene usuario).
// Solo puede llamar a las funciones habilitadas para "anon".
export function createAnonClient() {
  const env = publicEnv();
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
