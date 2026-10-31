// @vitest-environment node
import { describe, expect, test } from "vitest";
import { formatTime, localDate, localToUtc, todayRange } from "@/lib/time";

const BA = "America/Argentina/Buenos_Aires";

describe("horas del local", () => {
  test("10:00 en Buenos Aires son las 13:00 UTC", () => {
    expect(localToUtc("2026-10-31T10:00", BA)?.toISOString()).toBe("2026-10-31T13:00:00.000Z");
  });

  test("rechaza formatos raros", () => {
    expect(localToUtc("31/10/2026 10:00", BA)).toBeNull();
  });

  test("a la 01:00 UTC todavía es el día anterior en Buenos Aires", () => {
    expect(localDate(new Date("2026-11-01T01:00:00Z"), BA)).toBe("2026-10-31");
  });

  test("el día de hoy va de medianoche a medianoche del local", () => {
    const { start, end } = todayRange(new Date("2026-11-01T01:00:00Z"), BA);
    expect(start.toISOString()).toBe("2026-10-31T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  test("muestra la hora local en 24 h", () => {
    expect(formatTime(new Date("2026-10-31T23:30:00Z"), BA)).toBe("20:30");
  });
});
