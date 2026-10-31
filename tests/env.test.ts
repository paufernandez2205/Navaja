import { describe, expect, test } from "vitest";
import { readPublicEnv, readServerEnv } from "@/lib/env";

describe("readServerEnv", () => {
  const secret = "x".repeat(32);

  test("usa APP_URL si está", () => {
    expect(
      readServerEnv({ APP_URL: "https://a.com", URL: "https://b.com", PHONE_HMAC_SECRET: secret }),
    ).toEqual({ appUrl: "https://a.com", phoneHmacSecret: secret });
  });

  test("si no, usa la URL que pone Netlify", () => {
    expect(readServerEnv({ URL: "https://b.com", PHONE_HMAC_SECRET: secret }).appUrl).toBe(
      "https://b.com",
    );
  });

  test("exige un secreto de al menos 32 caracteres", () => {
    expect(() => readServerEnv({ APP_URL: "https://a.com", PHONE_HMAC_SECRET: "corto" })).toThrow(
      /PHONE_HMAC_SECRET/,
    );
  });
});

describe("readPublicEnv", () => {
  test("devuelve las variables cuando están bien", () => {
    const env = readPublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_123",
    });
    expect(env).toEqual({
      supabaseUrl: "https://abc.supabase.co",
      supabasePublishableKey: "sb_publishable_123",
    });
  });

  test("avisa cuáles faltan", () => {
    expect(() => readPublicEnv({})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  test("rechaza una URL inválida", () => {
    expect(() =>
      readPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "no-es-una-url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "x",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
