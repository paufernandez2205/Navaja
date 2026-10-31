import type { Metadata } from "next";
import { sendMagicLink } from "./actions";

export const metadata: Metadata = { title: "Entrar · Navaja" };

const errors: Record<string, string> = {
  email: "Ese email no parece válido.",
  link: "El link venció o ya se usó. Pedí uno nuevo.",
  "sin-acceso": "Tu usuario todavía no tiene un local asignado. Pedíselo al dueño.",
};

export default async function Login({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const sent = params.enviado === "1";
  const error = typeof params.error === "string" ? errors[params.error] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16 font-sans">
      <h1 className="text-3xl font-semibold">Entrar a Navaja</h1>
      {sent ? (
        <p role="status" className="rounded-lg bg-green-50 p-4 text-green-900 dark:bg-green-950 dark:text-green-100">
          Si tu email está habilitado, te llegó un link para entrar. Revisá también la carpeta de spam.
        </p>
      ) : (
        <form action={sendMagicLink} className="flex flex-col gap-3">
          <label htmlFor="email" className="font-medium">
            Tu email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-lg border border-zinc-300 px-3 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
          {error && (
            <p role="alert" className="text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Mandame el link
          </button>
        </form>
      )}
    </main>
  );
}
