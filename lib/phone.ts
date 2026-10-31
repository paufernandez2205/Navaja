import { parsePhoneNumberFromString } from "libphonenumber-js";

// Convierte lo que se tipea en el mostrador ("11 5555-5555", "011 15 5555-5555",
// "+54 9 11 ...") al formato E.164. Devuelve null si no es un número válido.
// Los clientes dan su celular, y en Argentina WhatsApp necesita el 9 después
// del 54, así que se agrega cuando falta.
export function normalizePhone(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input, "AR");
  if (!parsed || !parsed.isValid()) return null;
  if (parsed.countryCallingCode === "54" && !parsed.nationalNumber.startsWith("9")) {
    return `+549${parsed.nationalNumber}`;
  }
  return parsed.number;
}
