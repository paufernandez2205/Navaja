// @vitest-environment node
import { describe, expect, test } from "vitest";
import { normalizePhone } from "@/lib/phone";
import { generateToken, hashToken, phoneHmac } from "@/lib/tokens";
import { ratingMessage, ratingUrl, whatsappLink } from "@/lib/whatsapp";

describe("normalizePhone", () => {
  test.each([
    ["11 5555-5555", "+5491155555555"],
    ["011 15 5555-5555", "+5491155555555"],
    ["+54 9 11 5555-5555", "+5491155555555"],
    ["+541155555555", "+5491155555555"],
    ["549 11 5555 5555", "+5491155555555"],
    ["0351 15 555-1234", "+5493515551234"],
    ["351 555 1234", "+5493515551234"],
    ["+598 99 123 456", "+59899123456"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  test.each(["", "abc", "11 5555", "15 5555 5555"])("rechaza %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("tokens", () => {
  test("cada token es distinto y apto para URL", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test("el hash es estable y no contiene el token", () => {
    const token = generateToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });

  test("la huella del teléfono depende del secreto", () => {
    const phone = "+5491155555555";
    expect(phoneHmac(phone, "s1")).toBe(phoneHmac(phone, "s1"));
    expect(phoneHmac(phone, "s1")).not.toBe(phoneHmac(phone, "s2"));
    expect(phoneHmac(phone, "s1")).not.toContain("5555");
  });
});

describe("whatsapp", () => {
  const app = "https://navaja.netlify.app";

  test("arma el link de calificación", () => {
    expect(ratingUrl(app, "abc")).toBe("https://navaja.netlify.app/r/abc");
  });

  test("el mensaje lleva el link y el aviso de privacidad", () => {
    const msg = ratingMessage("Local Centro", app, "abc");
    expect(msg).toContain("Local Centro");
    expect(msg).toContain("https://navaja.netlify.app/r/abc");
    expect(msg).toContain("https://navaja.netlify.app/privacidad");
  });

  test("el link de WhatsApp usa el número sin + y el texto codificado", () => {
    expect(whatsappLink("+5491155555555", "hola & chau")).toBe(
      "https://wa.me/5491155555555?text=hola%20%26%20chau",
    );
  });
});
