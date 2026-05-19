const checks = [
  "Background should be dark",
  "Cards should sit in a 3-column grid on desktop",
  "Buttons should be rounded and colored",
  "This page should have real spacing, borders, shadows, and responsive layout",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100 sm:px-10 lg:px-16">
      <section className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="rounded-2xl border border-white/10 bg-zinc-900 p-8 shadow-2xl shadow-black/40">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-emerald-400">
            Tailwind Diagnostic
          </p>
          <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">
            If Tailwind works, this page looks styled.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">
            This is a dummy home page using only Tailwind utility classes. If it
            looks plain or stacked with no spacing/colors, the repo Tailwind
            pipeline is the issue.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button className="rounded-xl bg-white px-5 py-3 text-sm font-black uppercase tracking-widest text-zinc-950 transition hover:bg-zinc-200">
              White Button
            </button>
            <button className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-5 py-3 text-sm font-black uppercase tracking-widest text-emerald-300 transition hover:bg-emerald-400/20">
              Green Button
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {checks.map((check, index) => (
            <article
              className="rounded-xl border border-white/10 bg-white/[0.04] p-5"
              key={check}
            >
              <div className="mb-5 flex size-10 items-center justify-center rounded-lg bg-indigo-500 text-lg font-black text-white">
                {index + 1}
              </div>
              <h2 className="text-lg font-bold text-white">Check {index + 1}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{check}</p>
            </article>
          ))}
        </div>

        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm font-semibold text-red-200">
          Broken Tailwind will make this warning look like ordinary black text
          on a white page.
        </div>
      </section>
    </main>
  );
}
