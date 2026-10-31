// Mismo mensaje para cualquier motivo: vencido, usado, inexistente, etc.
export default function InvalidLink() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-3 px-4 py-16 text-center font-sans">
      <h1 className="text-2xl font-semibold">Este link ya no es válido</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Puede que ya lo hayas usado o que haya vencido. ¡Gracias igual por venir!
      </p>
    </main>
  );
}
