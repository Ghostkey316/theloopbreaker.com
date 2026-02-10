export default function Home() {
  return (
    <main style={{ minHeight: '100vh', padding: '48px 20px', maxWidth: 920, margin: '0 auto' }}>
      <h1 style={{ fontSize: 42, fontWeight: 800, marginBottom: 12 }}>Vaultfire</h1>
      <p style={{ fontSize: 18, lineHeight: 1.5, opacity: 0.85, marginBottom: 24 }}>
        Temporary maintenance mode.
      </p>
      <div style={{ padding: 16, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }}>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          The full Base mini-app demo is temporarily disabled to keep the deployment green while we
          resolve build/export issues.
        </p>
      </div>
    </main>
  );
}
