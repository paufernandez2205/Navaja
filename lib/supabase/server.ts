import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

// Cliente de Supabase con la sesión del usuario que hace el pedido.
// Todas las consultas pasan por las reglas de acceso (RLS) de ese usuario.
export async function createClient() {
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Desde un componente de página no se pueden escribir cookies;
          // proxy.ts se encarga de renovar la sesión.
        }
      },
    },
  });
}
