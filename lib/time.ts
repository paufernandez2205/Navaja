// Fechas y horas en la zona horaria del local. El servidor corre en UTC, así
// que todo lo que se muestra o se tipea en el mostrador pasa por acá.

function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// "2026-10-31T10:00" en la hora del local → instante UTC.
export function localToUtc(local: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  return new Date(guess - offsetMs(new Date(guess), timeZone));
}

// Fecha del día en el local, como "2026-10-31".
export function localDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(at);
}

// Desde las 00:00 de hoy hasta las 00:00 de mañana, en la hora del local.
export function todayRange(now: Date, timeZone: string): { start: Date; end: Date } {
  const start = localToUtc(`${localDate(now, timeZone)}T00:00`, timeZone)!;
  return { start, end: new Date(start.getTime() + 24 * 3_600_000) };
}

export function formatTime(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}
