import { describe, expect, test } from "vitest";
import { readPublicEnv } from "@/lib/env";

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
