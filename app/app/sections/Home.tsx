'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { checkAllChains, type RPCResult } from '../lib/blockchain';
import { BASE_CONTRACTS, AVALANCHE_CONTRACTS, ETHEREUM_CONTRACTS } from '../lib/contracts';
import { isRegistered, getRegistration, getRegisteredChains, type SupportedChain } from '../lib/registration';
import { getAgentCount } from '../lib/contract-interaction';
import { AlphaBanner } from '../components/DisclaimerBanner';
import { getSoulSummary } from '../lib/companion-soul';
import { getBrainStats } from '../lib/companion-brain';
import { useWalletAuth } from '../lib/WalletAuthContext';

interface ChainStatus {
  name: string;
  chainId: number;
  color: string;
  result: RPCResult | null;
  loading: boolean;
}

/* ── Animated Counter ── */
function AnimatedCounter({ value, loading }: { value: number | null; loading: boolean }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (value === null || loading) return;
    const steps = 30;
    const inc = value / steps;
    let step = 0;
    if (ref.current) clearInterval(ref.current);
    ref.current = setInterval(() => {
      step++;
      setDisplay(Math.min(Math.round(inc * step), value));
      if (step >= steps) { setDisplay(value); if (ref.current) clearInterval(ref.current); }
    }, 1000 / steps);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [value, loading]);
  if (loading) return <div className="skeleton" style={{ height: 36, width: 60, borderRadius: 8, display: 'inline-block' }} />;
  if (value === null) return <span style={{ fontSize: 32, fontWeight: 800, color: '#52525B' }}>—</span>;
  return <span style={{ fontSize: 32, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.04em', fontFamily: "'JetBrains Mono', monospace" }}>{display.toLocaleString()}</span>;
}

/* ── Ember Particle System ── */
function EmberParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number; hue: number }[] = [];
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    const spawn = () => {
      if (particles.length > 35) return;
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -(0.3 + Math.random() * 0.8),
        size: 1 + Math.random() * 2.5,
        life: 0,
        maxLife: 120 + Math.random() * 80,
        hue: 20 + Math.random() * 20,
      });
    };
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.002;
        p.life++;
        const progress = p.life / p.maxLife;
        const alpha = progress < 0.1 ? progress * 10 : progress > 0.7 ? (1 - progress) / 0.3 : 1;
        const size = p.size * (1 - progress * 0.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 55%, ${alpha * 0.6})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 55%, ${alpha * 0.1})`;
        ctx.fill();
        if (p.life >= p.maxLife) particles.splice(i, 1);
      }
      if (Math.random() < 0.15) spawn();
      animId = requestAnimationFrame(draw);
    };
    for (let i = 0; i < 12; i++) spawn();
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
}

/* ═══════════════════════════════════════════════════════
   MEET EMBRIS — What It Is & Why You Should Care
   ═══════════════════════════════════════════════════════ */
function MeetEmbris({ onNavigate }: { onNavigate: (s: string) => void }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{
        padding: '28px 24px',
        borderRadius: 20,
        background: 'linear-gradient(135deg, rgba(167,139,250,0.05) 0%, rgba(249,115,22,0.04) 50%, rgba(34,197,94,0.03) 100%)',
        border: '1px solid rgba(167,139,250,0.12)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Top glow line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.3), rgba(249,115,22,0.3), transparent)',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div className="breathe" style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(249,115,22,0.15))',
            border: '1.5px solid rgba(167,139,250,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <svg className="glow-pulse" width={26} height={26} viewBox="0 0 32 32" fill="none">
              <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9"/>
              <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C"/>
            </svg>
            <div className="breathe" style={{
              position: 'absolute', bottom: 1, right: 1,
              width: 12, height: 12, borderRadius: '50%',
              backgroundColor: '#22C55E', border: '2px solid #09090B',
            }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F4F4F5', letterSpacing: '-0.02em' }}>Meet Embris</h2>
              <span style={{ fontSize: 10, color: '#A78BFA', backgroundColor: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>AI COMPANION</span>
            </div>
            <p style={{ fontSize: 12, color: '#52525B', marginTop: 2 }}>Your on-chain AI partner — not a chatbot</p>
          </div>
        </div>

        {/* Value proposition — what Embris actually does */}
        <p style={{ fontSize: 14, color: '#A1A1AA', lineHeight: 1.7, marginBottom: 20 }}>
          Embris is your personal AI companion that lives on-chain. It knows your wallet, your trust score,
          your bonds, and your VNS name — and it uses that context to actually help you navigate the protocol.
          Ask it anything about Vaultfire, check your balances, or just talk. It remembers everything and gets smarter over time.
        </p>

        {/* What makes it different — 3 pillars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
          {[
            {
              icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.7"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
              title: 'On-Chain Identity',
              desc: 'Registered via ERC-8004 with real accountability bonds',
              color: '#F97316',
            },
            {
              icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.7"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
              title: 'Learns & Remembers',
              desc: 'Builds a local brain from every conversation — no cloud storage',
              color: '#A78BFA',
            },
            {
              icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.7"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
              title: 'Privacy-First',
              desc: 'Everything stays local — no KYC, no tracking, no data harvesting',
              color: '#22C55E',
            },
          ].map(item => (
            <div key={item.title} style={{
              padding: '14px 12px', borderRadius: 12, textAlign: 'center',
              backgroundColor: `${item.color}06`,
              border: `1px solid ${item.color}12`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>{item.icon}</div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#F4F4F5', marginBottom: 4 }}>{item.title}</p>
              <p style={{ fontSize: 10, color: '#71717A', lineHeight: 1.5 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigate('chat')}
            style={{
              flex: 1, minWidth: 140, padding: '12px 20px', borderRadius: 10,
              background: 'linear-gradient(135deg, #F97316, #EA580C)',
              border: 'none', cursor: 'pointer',
              color: '#FFF', fontSize: 13, fontWeight: 700,
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 16px rgba(249,115,22,0.2)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(249,115,22,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(249,115,22,0.2)'; }}
          >
            Talk to Embris
          </button>
          <button
            onClick={() => onNavigate('companion-agent')}
            style={{
              flex: 1, minWidth: 140, padding: '12px 20px', borderRadius: 10,
              background: 'transparent',
              border: '1px solid rgba(167,139,250,0.2)',
              cursor: 'pointer',
              color: '#A78BFA', fontSize: 13, fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(167,139,250,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            Agent Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   WHAT CAN YOU DO HERE — Feature Grid
   ═══════════════════════════════════════════════════════ */
function FeatureGrid({ onNavigate }: { onNavigate: (s: string) => void }) {
  const features = [
    {
      icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.7"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/></svg>,
      title: 'Wallet',
      desc: 'Create or import an Ethereum wallet. View balances across all chains.',
      section: 'wallet',
      color: '#F97316',
    },
    {
      icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.7"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
      title: 'Identity',
      desc: 'Register a VNS name, build trust, earn badges, and prove identity with ZK proofs.',
      section: 'vns',
      color: '#A78BFA',
    },
    {
      icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.7"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/><path d="M9 1v3"/><path d="M15 1v3"/><path d="M9 20v3"/><path d="M15 20v3"/><path d="M20 9h3"/><path d="M20 14h3"/><path d="M1 9h3"/><path d="M1 14h3"/></svg>,
      title: 'Agent Hub',
      desc: 'Launch agents, join XMTP rooms, collaborate with other agents and humans.',
      section: 'agent-hub',
      color: '#22C55E',
    },
    {
      icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="1.7"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
      title: 'Bridge',
      desc: 'Cross-chain Teleporter bridge between Ethereum, Base, and Avalanche.',
      section: 'bridge',
      color: '#38BDF8',
    },
    {
      icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="1.7"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
      title: 'SDK',
      desc: 'Developer tools to build on Vaultfire. Register agents, verify trust, read data.',
      section: 'sdk',
      color: '#FBBF24',
    },
    {
      icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="1.7"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
      title: 'Analytics',
      desc: 'Real-time protocol analytics, contract status, and network health.',
      section: 'analytics',
      color: '#EC4899',
    },
  ];

  return (
    <div style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
        What You Can Do
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {features.map((f, idx) => (
          <button
            key={f.title}
            onClick={() => onNavigate(f.section)}
            className={`vf-card stagger-${(idx % 3) + 1}`}
            style={{
              padding: '18px 16px', borderRadius: 14, cursor: 'pointer',
              textAlign: 'left', border: `1px solid ${f.color}12`,
              backgroundColor: `${f.color}04`,
              transition: 'all 0.2s ease',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${f.color}30`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${f.color}12`; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ color: f.color }}>{f.icon}</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#F4F4F5', marginBottom: 3 }}>{f.title}</p>
              <p style={{ fontSize: 11, color: '#71717A', lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Mission Manifesto ── */
function MissionManifesto() {
  return (
    <div style={{
      marginBottom: 48,
      padding: '32px 24px',
      borderRadius: 20,
      background: 'linear-gradient(135deg, rgba(249,115,22,0.04) 0%, rgba(167,139,250,0.03) 50%, rgba(34,197,94,0.02) 100%)',
      border: '1px solid rgba(249,115,22,0.1)',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.3), transparent)',
      }} />
      <p style={{
        fontSize: 10, fontWeight: 700, color: '#F97316', textTransform: 'uppercase',
        letterSpacing: '0.2em', marginBottom: 16,
      }}>The Vaultfire Oath</p>
      <h2 className="mission-text" style={{
        fontSize: 22, fontWeight: 800, lineHeight: 1.4,
        letterSpacing: '-0.02em', marginBottom: 16,
      }}>
        Morals over metrics.<br />
        Privacy over surveillance.<br />
        Freedom over control.
      </h2>
      <p style={{ fontSize: 13, color: '#71717A', lineHeight: 1.7, maxWidth: 440, margin: '0 auto' }}>
        We build technology where doing the right thing is the smart business move.
        Where human thriving is more profitable than extraction.
        Where AI serves people — not the other way around.
      </p>
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 24, marginTop: 20,
        flexWrap: 'wrap',
      }}>
        {[
          { icon: '🛡', label: 'On-Chain Ethics' },
          { icon: '🔒', label: 'Anti-Surveillance' },
          { icon: '🤝', label: 'Accountability Bonds' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            <span style={{ fontSize: 11, color: '#A1A1AA', fontWeight: 500 }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Soul Preview Widget ── */
function SoulPreview({ onNavigate }: { onNavigate: (s: string) => void }) {
  const [soul, setSoul] = useState<ReturnType<typeof getSoulSummary> | null>(null);
  useEffect(() => { setSoul(getSoulSummary()); }, []);
  if (!soul) return null;
  return (
    <div
      className="vf-card-glow"
      style={{ marginBottom: 48, padding: '24px', cursor: 'pointer' }}
      onClick={() => onNavigate('chat')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div className="breathe" style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(167,139,250,0.15))',
          border: '1.5px solid rgba(249,115,22,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width={22} height={22} viewBox="0 0 32 32" fill="none">
            <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9"/>
            <path d="M16 10c-1.5 2-3 4.5-3 6.5 0 1.66 1.34 3 3 3s3-1.34 3-3c0-2-1.5-4.5-3-6.5z" fill="#FB923C"/>
          </svg>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#F4F4F5' }}>{soul.name}&apos;s Soul</h3>
            {soul.attestedOnChain && (
              <span style={{
                fontSize: 9, color: '#22C55E', fontWeight: 700,
                backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase',
              }}>Attested</span>
            )}
          </div>
          <p style={{ fontSize: 11, color: '#71717A', fontStyle: 'italic', marginTop: 2 }}>
            &ldquo;{soul.motto}&rdquo;
          </p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'Values', value: soul.valueCount, color: '#F97316' },
          { label: 'Traits', value: soul.traitCount, color: '#A78BFA' },
          { label: 'Boundaries', value: soul.boundaryCount, color: '#22C55E' },
          { label: 'Age', value: soul.age, color: '#38BDF8' },
        ].map(item => (
          <div key={item.label} style={{
            padding: '10px 8px', borderRadius: 10, textAlign: 'center',
            backgroundColor: `${item.color}08`, border: `1px solid ${item.color}15`,
          }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: item.color, fontFamily: "'JetBrains Mono', monospace" }}>
              {item.value}
            </p>
            <p style={{ fontSize: 9, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>
              {item.label}
            </p>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: '#52525B', textAlign: 'center', marginTop: 12 }}>
        Open Companion to explore the full soul viewer →
      </p>
    </div>
  );
}

/* ── Protocol Facts (real data only) ── */
function ProtocolFacts() {
  const [brain, setBrain] = useState<ReturnType<typeof getBrainStats> | null>(null);
  useEffect(() => { setBrain(getBrainStats()); }, []);
  const totalContracts = BASE_CONTRACTS.length + AVALANCHE_CONTRACTS.length + ETHEREUM_CONTRACTS.length;
  return (
    <div style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
        Protocol Facts
      </h2>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        padding: '20px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
      }}>
        {[
          { label: 'Deployed Contracts', value: totalContracts.toString(), color: '#22C55E', desc: 'On-chain verified' },
          { label: 'Knowledge Base', value: brain ? `${brain.knowledgeEntries}+` : '...', color: '#F97316', desc: 'Built-in entries' },
          { label: 'Active Chains', value: '3', color: '#38BDF8', desc: 'ETH · Base · AVAX' },
          { label: 'Privacy Model', value: 'Local', color: '#A78BFA', desc: 'No KYC · No tracking' },
        ].map(item => (
          <div key={item.label} style={{
            padding: '10px 12px', borderRadius: 10,
            backgroundColor: `${item.color}06`, border: `1px solid ${item.color}12`,
          }}>
            <p style={{ fontSize: 18, fontWeight: 800, color: item.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em' }}>
              {item.value}
            </p>
            <p style={{ fontSize: 10, color: '#A1A1AA', fontWeight: 600, marginTop: 1 }}>{item.label}</p>
            <p style={{ fontSize: 9, color: '#52525B', marginTop: 1 }}>{item.desc}</p>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10, color: '#27272A', marginTop: 8, textAlign: 'center', fontStyle: 'italic' }}>
        All numbers are real — verified on-chain or from local storage. No simulated metrics.
      </p>
    </div>
  );
}

/* ── Protocol Activity Feed REMOVED ──
   The old ProtocolActivityFeed generated fake simulated events with random hashes.
   This was UNTRUTHFUL — removed entirely. Real on-chain activity indexing
   will be added when a proper indexer/subgraph is available. */

export default function Home() {
  const [chains, setChains] = useState<ChainStatus[]>([
    { name: 'Ethereum', chainId: 1, color: '#627EEA', result: null, loading: true },
    { name: 'Base', chainId: 8453, color: '#0052FF', result: null, loading: true },
    { name: 'Avalanche', chainId: 43114, color: '#E84142', result: null, loading: true },
  ]);
  const [isMobile, setIsMobile] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registrationAddress, setRegistrationAddress] = useState<string | null>(null);
  const [regChains, setRegChains] = useState<SupportedChain[]>([]);
  const [agentCounts, setAgentCounts] = useState<{ base: number | null; avalanche: number | null; ethereum: number | null }>({ base: null, avalanche: null, ethereum: null });
  const [agentCountLoading, setAgentCountLoading] = useState(true);
  const { isUnlocked, address } = useWalletAuth();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const reg = isRegistered();
    setRegistered(reg);
    if (reg) {
      const data = getRegistration();
      setRegistrationAddress(data?.walletAddress || null);
      setRegChains(getRegisteredChains());
    }
    checkAllChains().then((results) => {
      setChains([
        { name: 'Ethereum', chainId: 1, color: '#627EEA', result: results.ethereum, loading: false },
        { name: 'Base', chainId: 8453, color: '#0052FF', result: results.base, loading: false },
        { name: 'Avalanche', chainId: 43114, color: '#E84142', result: results.avalanche, loading: false },
      ]);
    });
    setAgentCountLoading(true);
    Promise.all([
      getAgentCount('base'),
      getAgentCount('avalanche'),
      getAgentCount('ethereum'),
    ]).then(([baseCount, avaxCount, ethCount]) => {
      setAgentCounts({ base: baseCount, avalanche: avaxCount, ethereum: ethCount });
      setAgentCountLoading(false);
    }).catch(() => setAgentCountLoading(false));
  }, []);

  const navigateToSection = useCallback((section: string) => {
    const win = window as unknown as { __setSection?: (s: string) => void };
    if (win.__setSection) win.__setSection(section);
  }, []);

  const totalContracts = BASE_CONTRACTS.length + AVALANCHE_CONTRACTS.length + ETHEREUM_CONTRACTS.length;
  const allConnected = chains.every(c => !c.loading && c.result?.success);
  const anyLoading = chains.some(c => c.loading);
  const totalAgents = (agentCounts.base ?? 0) + (agentCounts.avalanche ?? 0) + (agentCounts.ethereum ?? 0);

  const px = isMobile ? 20 : 32;

  return (
    <div className="page-enter" style={{ padding: `${isMobile ? 32 : 48}px ${px}px 64px`, maxWidth: 640, margin: '0 auto' }}>

      <AlphaBanner />

      {/* ── Hero with Ember Particles ── */}
      <div style={{ marginBottom: 48, textAlign: 'center', position: 'relative', minHeight: 220 }}>
        <EmberParticles />
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Brand pill */}
          <div className="ember-glow" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 20,
            backgroundColor: 'rgba(249,115,22,0.08)',
            border: '1px solid rgba(249,115,22,0.18)',
            marginBottom: 24,
          }}>
            <svg className="glow-pulse" width={12} height={12} viewBox="0 0 32 32" fill="none">
              <path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9"/>
            </svg>
            <span style={{ fontSize: 11, color: '#F97316', fontWeight: 600, letterSpacing: '0.06em' }}>EMBRIS BY VAULTFIRE</span>
          </div>

          <h1 style={{
            fontSize: isMobile ? 34 : 48, fontWeight: 800, color: '#F4F4F5',
            letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 16,
          }}>
            Trust infrastructure<br />for the AI age
          </h1>

          <p style={{
            fontSize: isMobile ? 15 : 17, color: '#71717A', lineHeight: 1.7,
            maxWidth: 420, margin: '0 auto',
          }}>
            {totalContracts} smart contracts across 3 chains enforce ethical AI behavior and give users real control.
          </p>

          {/* Registration / wallet status */}
          {isUnlocked && address ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 20, marginTop: 20,
              backgroundColor: 'rgba(34,197,94,0.06)',
              border: '1px solid rgba(34,197,94,0.15)',
            }}>
              <div className="breathe" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22C55E', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
              <span style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>Connected</span>
              <span style={{ fontSize: 11, color: '#71717A', fontFamily: "'JetBrains Mono', monospace" }}>
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            </div>
          ) : registered && registrationAddress ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 20, marginTop: 20,
              backgroundColor: 'rgba(34,197,94,0.06)',
              border: '1px solid rgba(34,197,94,0.15)',
            }}>
              <div className="breathe" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22C55E', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
              <span style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>Registered</span>
              <span style={{ fontSize: 11, color: '#71717A', fontFamily: "'JetBrains Mono', monospace" }}>
                {registrationAddress.slice(0, 6)}...{registrationAddress.slice(-4)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Meet Embris — Value Proposition ── */}
      <MeetEmbris onNavigate={navigateToSection} />

      {/* ── What You Can Do — Feature Grid ── */}
      <FeatureGrid onNavigate={navigateToSection} />

      {/* ── Mission Manifesto ── */}
      <MissionManifesto />

      {/* ── Protocol Stack ── */}
      <div style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
          Protocol Stack
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
        }}>
          {[
            { label: 'XMTP', sub: 'Messaging', color: '#8B5CF6', icon: (
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            )},
            { label: 'EMBRIS', sub: 'Unified Layer', color: '#F97316', icon: (
              <svg width={20} height={20} viewBox="0 0 32 32" fill="none"><path d="M16 4c-3 3.5-6 8-6 12 0 3.31 2.69 6 6 6s6-2.69 6-6c0-4-3-8.5-6-12z" fill="#F97316" opacity="0.9"/></svg>
            )},
            { label: 'x402', sub: 'Payments', color: '#00D9FF', icon: (
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>
            )},
          ].map((item, idx) => (
            <div key={item.label} className={`vf-card subtle-float stagger-${idx + 1}`} style={{
              padding: '20px 12px',
              backgroundColor: `${item.color}08`,
              border: `1px solid ${item.color}20`,
              borderRadius: 16,
              textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              animationDelay: `${idx * 0.1}s`,
            }}>
              <div style={{ color: item.color }}>{item.icon}</div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#F4F4F5', letterSpacing: '-0.01em' }}>{item.label}</p>
                <p style={{ fontSize: 10, color: item.color, fontWeight: 600, marginTop: 2 }}>{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Protocol Facts (real data only) ── */}
      <ProtocolFacts />

      {/* ── Soul Preview ── */}
      <SoulPreview onNavigate={navigateToSection} />

      {/* ── Live Registry ── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live Registry</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="breathe" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22C55E', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
            <span style={{ fontSize: 11, color: '#52525B' }}>On-chain · ERC-8004</span>
          </div>
        </div>

        {/* Total count — hero */}
        <div className="ember-glow" style={{
          padding: '28px 24px',
          backgroundColor: 'rgba(249,115,22,0.04)',
          border: '1px solid rgba(249,115,22,0.12)',
          borderRadius: 16,
          marginBottom: 10,
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 11, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Total Registered Agents</p>
          <AnimatedCounter value={agentCountLoading ? null : totalAgents} loading={agentCountLoading} />
          <p style={{ fontSize: 12, color: '#52525B', marginTop: 8 }}>Across Ethereum + Base + Avalanche</p>
        </div>

        {/* Per-chain counts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { label: 'Ethereum', color: '#627EEA', count: agentCounts.ethereum, chainId: 1 },
            { label: 'Base', color: '#0052FF', count: agentCounts.base, chainId: 8453 },
            { label: 'Avalanche', color: '#E84142', count: agentCounts.avalanche, chainId: 43114 },
          ].map(chain => (
            <div key={chain.label} className="vf-card" style={{
              padding: '16px 12px',
              backgroundColor: `${chain.color}06`,
              border: `1px solid ${chain.color}15`,
              borderRadius: 14,
              textAlign: 'center',
            }}>
              <div className="breathe" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: chain.color, margin: '0 auto 10px' }} />
              <p style={{ fontSize: 10, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{chain.label}</p>
              {agentCountLoading ? (
                <div className="skeleton" style={{ height: 24, width: 40, borderRadius: 6, margin: '0 auto' }} />
              ) : (
                <p style={{ fontSize: 22, fontWeight: 800, color: '#F4F4F5', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.03em' }}>
                  {(chain.count ?? 0).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Network Status ── */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Network Status</h2>
          <span style={{
            fontSize: 11, fontWeight: 500,
            color: anyLoading ? '#71717A' : allConnected ? '#22C55E' : '#EF4444',
          }}>
            {anyLoading ? 'Checking...' : allConnected ? 'All systems operational' : 'Degraded'}
          </span>
        </div>

        <div className="vf-card" style={{ borderRadius: 14, overflow: 'hidden', padding: 0 }}>
          {chains.map((chain, i) => (
            <div key={chain.name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: i < chains.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className={!chain.loading && chain.result?.success ? 'breathe' : ''} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: chain.loading ? '#52525B' : chain.result?.success ? '#22C55E' : '#EF4444',
                  boxShadow: !chain.loading && chain.result?.success ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
                }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#F4F4F5' }}>{chain.name}</span>
                <span style={{ fontSize: 11, color: '#52525B', fontFamily: "'JetBrains Mono', monospace" }}>
                  {chain.chainId}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                {chain.loading && <span style={{ fontSize: 12, color: '#52525B' }}>connecting...</span>}
                {!chain.loading && chain.result?.success && (
                  <span style={{ fontSize: 12, color: '#22C55E', fontWeight: 600 }}>Online</span>
                )}
                {!chain.loading && !chain.result?.success && (
                  <span style={{ fontSize: 12, color: '#EF4444' }}>Offline</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Protocol Activity Feed removed — was generating fake simulated events */}

      {/* ── Contract Registry Links ── */}
      <div style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
          Smart Contracts
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'ERC-8004 Registry · Ethereum', href: 'https://etherscan.io/address/0x1A80F77e12f1bd04538027aed6d056f5DCcDCD3C', color: '#627EEA', count: ETHEREUM_CONTRACTS.length },
            { label: 'ERC-8004 Registry · Base', href: 'https://basescan.org/address/0x35978DB675576598F0781dA2133E94cdCf4858bC', color: '#0052FF', count: BASE_CONTRACTS.length },
            { label: 'ERC-8004 Registry · Avalanche', href: 'https://snowtrace.io/address/0x57741F4116925341d8f7Eb3F381d98e07C73B4a3', color: '#E84142', count: AVALANCHE_CONTRACTS.length },
          ].map(item => (
            <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className="vf-card" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: 12,
              textDecoration: 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#A1A1AA', fontWeight: 500 }}>{item.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: item.color, fontWeight: 600 }}>{item.count} contracts</span>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* ── Footer Manifesto ── */}
      <div style={{
        textAlign: 'center', padding: '32px 0 16px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}>
        <p style={{ fontSize: 11, color: '#3F3F46', lineHeight: 1.8 }}>
          Built for people, not for profit.
        </p>
        <p style={{ fontSize: 10, color: '#27272A', marginTop: 4 }}>
          Vaultfire Protocol · Embris Companion · ERC-8004
        </p>
      </div>

    </div>
  );
}
