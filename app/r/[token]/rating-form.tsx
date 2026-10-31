"use client";

import { useState } from "react";

const MAX_COMMENT = 500;
const LABELS = ["", "Muy mal", "Mal", "Normal", "Bien", "Excelente"];

type Props = {
  token: string;
  locationName: string;
  barberName: string;
  barberPhotoUrl: string | null;
  hasGoogleReview: boolean;
};

export function RatingForm({ token, locationName, barberName, barberPhotoUrl, hasGoogleReview }: Props) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ratingId, setRatingId] = useState<string | null>(null);

  if (ratingId) {
    return <ThankYou ratingId={ratingId} hasGoogleReview={hasGoogleReview} />;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (stars === 0) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, stars, comment }),
      });
      const body = await res.json();
      if (res.status === 201) setRatingId(body.ratingId);
      else setError(body.error ?? "Algo salió mal. Probá de nuevo.");
    } catch {
      setError("No hay conexión. Probá de nuevo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10 font-sans">
      <header className="flex flex-col items-center gap-3 text-center">
        {barberPhotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- foto externa, sin optimizar
          <img src={barberPhotoUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
        )}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{locationName}</p>
        <h1 className="text-2xl font-semibold">¿Cómo te atendió {barberName}?</h1>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-5">
        <fieldset>
          <legend className="sr-only">Calificación de 1 a 5 estrellas</legend>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer p-1">
                <input
                  type="radio"
                  name="stars"
                  value={n}
                  checked={stars === n}
                  onChange={() => setStars(n)}
                  aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}: ${LABELS[n]}`}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={`block text-5xl leading-none transition-transform peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 active:scale-90 ${
                    n <= stars ? "text-amber-400" : "text-zinc-300 dark:text-zinc-700"
                  }`}
                >
                  ★
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 h-5 text-center text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
            {LABELS[stars]}
          </p>
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Comentario (opcional)</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={MAX_COMMENT}
            rows={3}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span className="self-end text-xs text-zinc-500">
            {comment.length}/{MAX_COMMENT}
          </span>
        </label>

        {error && (
          <p role="alert" className="text-center text-red-700 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={stars === 0 || sending}
          className="rounded-xl bg-zinc-900 px-4 py-4 text-lg font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {sending ? "Enviando…" : "Enviar"}
        </button>
      </form>

      <p className="text-center text-xs text-zinc-500">
        Tu calificación es interna y solo la ve el local.{" "}
        <a href="/privacidad" className="underline">
          Privacidad
        </a>
      </p>
    </main>
  );
}

// Pantalla final. A propósito no recibe las estrellas: el botón de Google se
// muestra igual a todos (está prohibido mostrarlo solo a quien calificó alto).
export function ThankYou({ ratingId, hasGoogleReview }: { ratingId: string; hasGoogleReview: boolean }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10 text-center font-sans">
      <h1 className="text-2xl font-semibold">¡Gracias por tu calificación!</h1>
      {hasGoogleReview && (
        <a
          href={`/g/${ratingId}`}
          className="rounded-xl bg-blue-600 px-4 py-4 text-lg font-medium text-white"
        >
          ¿Nos dejás tu reseña en Google?
        </a>
      )}
    </main>
  );
}
