"use client";

import { useActionState } from "react";
import {
  createAppointment,
  createWalkIn,
  sendRating,
  type FormState,
  type SendState,
} from "./actions";

type Barber = { id: string; name: string };

const input =
  "rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900";
const primary =
  "rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const secondary =
  "rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700";

function BarberSelect({ barbers }: { barbers: Barber[] }) {
  return (
    <select name="barber_id" required defaultValue="" className={input}>
      <option value="" disabled>
        Barbero
      </option>
      {barbers.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}

function Result({ state }: { state: SendState }) {
  if (!state) return null;
  if ("error" in state) {
    return (
      <p role="alert" className="text-sm text-red-700 dark:text-red-400">
        {state.error}
      </p>
    );
  }
  if (state.kind === "whatsapp") {
    return (
      <a
        href={state.href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-lg bg-green-600 px-4 py-2 font-medium text-white"
      >
        Abrir WhatsApp
      </a>
    );
  }
  return (
    <figure className="flex flex-col items-center gap-2 rounded-xl bg-white p-4">
      <div
        className="w-64 max-w-full"
        aria-label="Código QR para calificar"
        dangerouslySetInnerHTML={{ __html: state.svg }}
      />
      <figcaption className="text-center text-sm text-zinc-700">
        Que el cliente lo escanee con la cámara. Sirve una sola vez.
      </figcaption>
    </figure>
  );
}

export function NewAppointmentForm({
  locationId,
  barbers,
  defaultTime,
}: {
  locationId: string;
  barbers: Barber[];
  defaultTime: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createAppointment, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="location_id" value={locationId} />
      <BarberSelect barbers={barbers} />
      <input type="datetime-local" name="scheduled_at" required defaultValue={defaultTime} className={input} />
      <input type="tel" name="phone" required placeholder="Teléfono del cliente" autoComplete="off" className={input} />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Guardando…" : "Cargar turno"}
      </button>
      {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-green-700 dark:text-green-400">{state.ok}</p>}
    </form>
  );
}

export function WalkInForm({ locationId, barbers }: { locationId: string; barbers: Barber[] }) {
  const [state, action, pending] = useActionState<SendState, FormData>(createWalkIn, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="location_id" value={locationId} />
      <BarberSelect barbers={barbers} />
      <input type="tel" name="phone" placeholder="Teléfono (opcional)" autoComplete="off" className={input} />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Generando…" : "Corte terminado: mostrar QR"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function SendRatingButtons({ appointmentId, hasPhone }: { appointmentId: string; hasPhone: boolean }) {
  const [state, action, pending] = useActionState<SendState, FormData>(sendRating, null);
  return (
    <div className="flex flex-col gap-2">
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="appointment_id" value={appointmentId} />
        {hasPhone && (
          <button type="submit" name="channel" value="whatsapp" disabled={pending} className={secondary}>
            Enviar calificación
          </button>
        )}
        <button type="submit" name="channel" value="qr" disabled={pending} className={secondary}>
          Mostrar QR
        </button>
      </form>
      <Result state={state} />
    </div>
  );
}
