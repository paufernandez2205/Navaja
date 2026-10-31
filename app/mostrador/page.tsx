import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { formatTime, localDate, todayRange } from "@/lib/time";
import { signOut } from "../login/actions";
import { setStatus } from "./actions";
import { NewAppointmentForm, SendRatingButtons, WalkInForm } from "./forms";

export const metadata: Metadata = { title: "Mostrador · Navaja" };

const statusLabel = { scheduled: "Agendado", completed: "Completado", cancelled: "Cancelado" } as const;

type Appointment = {
  id: string;
  barber_id: string;
  scheduled_at: string;
  status: keyof typeof statusLabel;
  is_walk_in: boolean;
};

export default async function Mostrador({ searchParams }: PageProps<"/mostrador">) {
  const { supabase, locations } = await requireStaff();
  const params = await searchParams;
  const location = locations.find((l) => l.id === params.local) ?? locations[0];
  const tz = location.timezone;

  const { data: links } = await supabase
    .from("barber_locations")
    .select("barber_id")
    .eq("location_id", location.id);
  const { data: barbers } = await supabase
    .from("barbers")
    .select("id, name")
    .in("id", (links ?? []).map((l) => l.barber_id))
    .eq("active", true)
    .order("name");
  const barberName = new Map((barbers ?? []).map((b) => [b.id as string, b.name as string]));

  const { start, end } = todayRange(new Date(), tz);
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, barber_id, scheduled_at, status, is_walk_in")
    .eq("location_id", location.id)
    .gte("scheduled_at", start.toISOString())
    .lt("scheduled_at", end.toISOString())
    .order("scheduled_at");
  const list = (appointments ?? []) as Appointment[];

  const { data: contacts } = await supabase
    .from("appointment_contacts")
    .select("appointment_id")
    .in("appointment_id", list.map((a) => a.id));
  const withPhone = new Set((contacts ?? []).map((c) => c.appointment_id as string));

  const now = new Date();
  const defaultTime = `${localDate(now, tz)}T${formatTime(now, tz)}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 font-sans">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mostrador</h1>
          {locations.length > 1 ? (
            <nav className="mt-1 flex flex-wrap gap-3 text-sm">
              {locations.map((l) => (
                <Link
                  key={l.id}
                  href={`/mostrador?local=${l.id}`}
                  aria-current={l.id === location.id ? "page" : undefined}
                  className="underline-offset-4 aria-[current=page]:font-semibold aria-[current=page]:underline"
                >
                  {l.name}
                </Link>
              ))}
            </nav>
          ) : (
            <p className="text-zinc-600 dark:text-zinc-400">{location.name}</p>
          )}
        </div>
        <form action={signOut}>
          <button type="submit" className="text-sm underline underline-offset-4">
            Salir
          </button>
        </form>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-semibold">Nuevo turno</h2>
          <NewAppointmentForm locationId={location.id} barbers={barbers ?? []} defaultTime={defaultTime} />
        </section>
        <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-semibold">Sin turno (walk-in)</h2>
          <WalkInForm locationId={location.id} barbers={barbers ?? []} />
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Turnos de hoy</h2>
        {list.length === 0 && <p className="text-zinc-600 dark:text-zinc-400">Todavía no hay turnos hoy.</p>}
        <ul className="flex flex-col gap-3">
          {list.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p>
                  <span className="font-semibold tabular-nums">{formatTime(new Date(a.scheduled_at), tz)}</span>
                  {" · "}
                  {barberName.get(a.barber_id) ?? "Barbero"}
                  {a.is_walk_in && " · walk-in"}
                </p>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{statusLabel[a.status]}</span>
              </div>
              {a.status === "scheduled" && (
                <form action={setStatus} className="flex gap-2">
                  <input type="hidden" name="appointment_id" value={a.id} />
                  <button
                    type="submit"
                    name="status"
                    value="completed"
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Completar
                  </button>
                  <button
                    type="submit"
                    name="status"
                    value="cancelled"
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
                  >
                    Cancelar
                  </button>
                </form>
              )}
              {a.status === "completed" && (
                <SendRatingButtons appointmentId={a.id} hasPhone={withPhone.has(a.id)} />
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
