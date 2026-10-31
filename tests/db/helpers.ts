import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = join(__dirname, "..", "..");
const migrationsDir = join(root, "supabase", "migrations");

// Base Postgres en memoria con todas las migraciones aplicadas en orden.
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-shim.sql"), "utf8"));
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  return db;
}

// Ejecuta fn como si fuera un usuario logueado (o anónimo si userId es null),
// con las mismas reglas de acceso que aplicaría Supabase.
export async function as<T>(
  db: PGlite,
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(userId ? "set role authenticated" : "set role anon");
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    userId ? JSON.stringify({ sub: userId, role: "authenticated" }) : "",
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', '', false)");
  }
}
