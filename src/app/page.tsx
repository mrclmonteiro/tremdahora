export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-start justify-center gap-4 px-6 py-12">
      <p className="rounded-full border border-emerald-900/20 bg-emerald-700/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-emerald-900">
        Scaffold inicial
      </p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Trem da Hora
      </h1>
      <p className="max-w-2xl text-base leading-relaxed text-emerald-950/80 sm:text-lg">
        Base pronta com Next.js, TypeScript, Tailwind e Supabase para construir o app
        de acompanhamento da Trensurb.
      </p>
    </main>
  );
}
