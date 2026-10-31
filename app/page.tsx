import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-16 font-sans">
      <h1 className="text-4xl font-semibold tracking-tight">Navaja</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Valoraciones internas por barbero. En construcción.
      </p>
      <Link href="/privacidad" className="underline underline-offset-4">
        Política de privacidad
      </Link>
    </main>
  );
}
