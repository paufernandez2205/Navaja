import { createHash, createHmac, randomBytes } from "node:crypto";

// Token del link de calificación: 32 bytes aleatorios, apto para URL.
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

// En la base se guarda solo este hash, nunca el token.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Huella del teléfono para el antifraude: permite saber si dos turnos son del
// mismo número sin poder reconstruirlo. El secreto vive solo en el servidor.
export function phoneHmac(phoneE164: string, secret: string): string {
  return createHmac("sha256", secret).update(phoneE164).digest("hex");
}
