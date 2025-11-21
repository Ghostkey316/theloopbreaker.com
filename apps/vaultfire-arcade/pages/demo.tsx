import { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { actionGroups, type ActionCategory } from "../data/actions";
import { applyAction, projectYield, type VaultfireAction, type VaultfireState } from "../lib/scoring";

type GuardianResult = "Approved" | "Flagged" | "Neutral";

interface LedgerEntry {
  id: string;
  title: string;
  result: GuardianResult;
  message: string;
  timestamp: number;
  tags: string[];
}

const personas = ["Daily Grinder", "Protocol Builder", "Reformed Degen"];

const initialState: VaultfireState = {
  beliefScore: 64,
  ethicsAlignment: 72,
  privacyShield: 68,
  loyaltyStreak: 60,
};

function guardianRite(tags: string[]): { result: GuardianResult; message: string } {
  if (tags.includes("greed")) {
    return { result: "Flagged", message: "Guardian senses excess extraction. Redirect toward reciprocity." };
  }
  if (tags.includes("ethics") || tags.includes("loyalty")) {
    return { result: "Approved", message: "Aligned with the oath. Signal logged for the covenant." };
  }
  return { result: "Neutral", message: "Action recorded. Awaiting further proof signals." };
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export default function Demo() {
  const [selectedPersona, setSelectedPersona] = useState<string>(personas[0]);
  const [ensHandle, setEnsHandle] = useState<string>("");
  const [state, setState] = useState<VaultfireState>(initialState);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const yieldRange = useMemo(() => projectYield(state), [state]);

  const handleAction = (action: VaultfireAction) => {
    const updated = applyAction(state, action);
    const verdict = guardianRite(action.tags);
    const entry: LedgerEntry = {
      id: `${action.id}-${Date.now()}`,
      title: action.title,
      result: verdict.result,
      message: verdict.message,
      timestamp: Date.now(),
      tags: action.tags,
    };
    setState(updated);
    setLedger((prev) => [entry, ...prev].slice(0, 12));
  };

  const personaTagline = useMemo(() => {
    switch (selectedPersona) {
      case "Protocol Builder":
        return "You architect the rails; every move is a design decision.";
      case "Reformed Degen":
        return "You know the burn scars. Now you chase tempered conviction.";
      default:
        return "You grind, recalibrate, and favor steady signal over noise.";
    }
  }, [selectedPersona]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <Head>
        <title>Vaultfire Arcade Mode - Demo</title>
      </Head>
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Vaultfire Arcade Mode</p>
            <h1 className="text-2xl font-semibold text-slate-900">Guardian Console</h1>
          </div>
          <Link href="/" className="button-secondary">
            Back to landing
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="card lg:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="badge bg-aurora/10 text-aurora-700">Persona</div>
              <div className="text-lg font-semibold text-slate-800">{selectedPersona}</div>
            </div>
            <p className="mt-2 text-slate-500">{personaTagline}</p>

            <div className="mt-4 flex flex-wrap gap-3">
              {personas.map((persona) => (
                <button
                  key={persona}
                  onClick={() => setSelectedPersona(persona)}
                  className={`button-secondary ${
                    persona === selectedPersona ? "border-aurora text-aurora-700 bg-aurora/5" : ""
                  }`}
                >
                  {persona}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <label className="text-sm font-semibold text-slate-700">Optional ENS / wallet label</label>
              <input
                value={ensHandle}
                onChange={(e) => setEnsHandle(e.target.value)}
                placeholder="guardian.eth or vaultfire.wallet"
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 shadow-inner focus:outline-none focus:ring-2 focus:ring-aurora/50"
              />
              <p className="mt-2 text-sm text-slate-500">Used only to personalize the console tone. Never transmitted.</p>
            </div>
          </div>

          <div className="card bg-slate-900 text-white">
            <h3 className="section-title text-white">Belief Console</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Stat label="Belief Score" value={state.beliefScore} accent="amber" />
              <Stat label="Ethics Alignment" value={state.ethicsAlignment} accent="emerald" />
              <Stat label="Privacy Shield" value={state.privacyShield} accent="cyan" />
              <Stat label="Loyalty Streak" value={state.loyaltyStreak} accent="fuchsia" />
            </div>
            <div className="mt-6 rounded-xl bg-white/10 border border-white/10 p-4">
              <div className="text-sm text-slate-200">Projected yield range</div>
              <div className="mt-1 text-2xl font-semibold">{yieldRange.min} – {yieldRange.max}</div>
              <p className="text-sm text-slate-300 mt-1">Weighted blend of belief, ethics, privacy, and loyalty signals.</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="section-title">Action Paths</h3>
              <div className="badge">Guardian Rite</div>
            </div>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {(Object.keys(actionGroups) as ActionCategory[]).map((category) => (
                <div key={category} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-800">{category}</div>
                    <span className="badge bg-white">{actionGroups[category].length} actions</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {actionGroups[category].map((action) => (
                      <button
                        key={action.id}
                        onClick={() => handleAction(action)}
                        className="w-full text-left rounded-xl border border-slate-200 bg-white p-3 hover:border-aurora hover:shadow-soft transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-slate-800">{action.title}</div>
                          <div className="flex gap-2">
                            {action.tags.map((tag) => (
                              <span key={tag} className="badge capitalize">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">{action.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">Ledger Feed</h3>
            <p className="text-sm text-slate-500 mb-3">Each action logs a Guardian Rite result and a short explanation.</p>
            <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
              {ledger.length === 0 && <p className="text-sm text-slate-400">No actions yet. Trigger the rite to populate the feed.</p>}
              {ledger.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">{entry.title}</div>
                      <div className="text-xs text-slate-500">{formatTimestamp(entry.timestamp)}</div>
                    </div>
                    <span
                      className={`badge ${
                        entry.result === "Approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : entry.result === "Flagged"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {entry.result}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">{entry.message}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entry.tags.map((tag) => (
                      <span key={tag} className="badge capitalize">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 pb-10">
          <div className="card">
            <h3 className="section-title">Ethics &amp; Privacy</h3>
            <ul className="mt-3 space-y-2 text-slate-600 text-sm">
              <li>Consent-first telemetry. No hidden beacons. Opt-in only.</li>
              <li>Transparency over hype. Publish receipts before projections.</li>
              <li>Guardianship means reversibility and respect for exits.</li>
              <li>Privacy shield stays active by default. Signals are masked.</li>
              <li>Loyalty is earned through steady proof, not promises.</li>
            </ul>
          </div>

          <div className="card">
            <h3 className="section-title">Lore / Manifesto</h3>
            <p className="mt-3 text-slate-600 text-sm">
              The Vaultfire mythos is a living manuscript. This space is a sketchpad to rehearse the ethics of extraction,
              reciprocity, and care. Drop in your own lore link or manifesto anchor to keep the flame honest.
            </p>
            <Link
              href="https://example.com/vaultfire-lore"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-aurora-700 font-semibold mt-4"
            >
              Placeholder lore link →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

interface StatProps {
  label: string;
  value: number;
  accent: "amber" | "emerald" | "cyan" | "fuchsia";
}

function Stat({ label, value, accent }: StatProps) {
  const accentClasses: Record<StatProps["accent"], string> = {
    amber: "from-amber-100 to-white text-amber-800",
    emerald: "from-emerald-100 to-white text-emerald-800",
    cyan: "from-cyan-100 to-white text-cyan-800",
    fuchsia: "from-fuchsia-100 to-white text-fuchsia-800",
  };

  return (
    <div className={`rounded-xl border border-white/10 bg-gradient-to-br p-4 ${accentClasses[accent]}`}>
      <div className="stat-label text-slate-600">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
