import { z } from "zod";

// Variables que el navegador puede ver. Las claves secretas nunca van acá.
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

// Variables que solo existen en el servidor.
const serverEnvSchema = z.object({
  APP_URL: z.url(),
  PHONE_HMAC_SECRET: z.string().min(32),
});

export type PublicEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export type ServerEnv = {
  appUrl: string;
  phoneHmacSecret: string;
};

type Source = Record<string, string | undefined>;

function fail(issues: z.core.$ZodIssue[]): never {
  const missing = issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(
    `Faltan o están mal estas variables de entorno: ${missing}. Revisá el archivo .env.local (ver .env.example).`,
  );
}

export function readPublicEnv(source: Source): PublicEnv {
  const parsed = publicEnvSchema.safeParse(source);
  if (!parsed.success) fail(parsed.error.issues);
  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

// Netlify define URL con la dirección del sitio; APP_URL, si está, tiene prioridad.
export function readServerEnv(source: Source): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    APP_URL: source.APP_URL ?? source.URL,
    PHONE_HMAC_SECRET: source.PHONE_HMAC_SECRET,
  });
  if (!parsed.success) fail(parsed.error.issues);
  return {
    appUrl: parsed.data.APP_URL,
    phoneHmacSecret: parsed.data.PHONE_HMAC_SECRET,
  };
}

// Las NEXT_PUBLIC_ se nombran una por una para que Next.js las incluya al compilar.
export function publicEnv(): PublicEnv {
  return readPublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
