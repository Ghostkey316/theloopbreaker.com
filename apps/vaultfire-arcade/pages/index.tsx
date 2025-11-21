import Head from "next/head";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <Head>
        <title>Vaultfire Arcade Mode</title>
        <meta name="description" content="Vaultfire Arcade Mode demo" />
      </Head>
      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-amber-700 text-sm font-semibold">
            Demo-only Surface
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl font-bold text-slate-900">
            Vaultfire Arcade Mode
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            a heartbeat written in code — proof &gt; prose.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="card">
            <h2 className="text-2xl font-semibold text-slate-900">Enter the simulation</h2>
            <p className="mt-4 text-slate-600">
              Explore persona-driven choices, Guardian Rites, and an experimental belief console. No tracking. No wallet connect. Just a
              safe space to see how Vaultfire reacts.
            </p>
            <div className="mt-8 flex gap-3 flex-wrap">
              <Link href="/demo" className="button-primary">
                Enter Demo
              </Link>
              <Link href="https://github.com/" className="button-secondary" target="_blank" rel="noreferrer">
                Main Vaultfire Repo (placeholder)
              </Link>
            </div>
            <div className="mt-6 text-sm text-slate-500">
              This space is self-contained and does not interact with live contracts or production data.
            </div>
          </div>

          <div className="card bg-gradient-to-br from-white via-white to-slate-50">
            <h3 className="section-title">What to expect</h3>
            <ul className="mt-4 space-y-3 text-slate-600">
              <li>Persona selection that tunes the console tone.</li>
              <li>Belief Console with ethics, privacy, loyalty, and belief signals.</li>
              <li>Actions grouped by Life, Money, Privacy, and Loyalty paths.</li>
              <li>Ledger feed that records how the Guardian Rite responds.</li>
            </ul>
            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-500">
              Built for demos only. Run locally with <code className="bg-slate-100 px-1 rounded">npm run dev:arcade</code> from the
              repo root.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
