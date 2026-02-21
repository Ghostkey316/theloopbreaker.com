'use client';
import { useEffect, useState } from 'react';
import { exportData, importData, clearAllMemories, type SyncData } from '../lib/memory';

interface SyncStats {
  chatMessages: number;
  memories: number;
  walletConnected: boolean;
  lastSync: string | null;
  dataSize: string;
}

export default function Sync() {
  const [stats, setStats] = useState<SyncStats>({
    chatMessages: 0,
    memories: 0,
    walletConnected: false,
    lastSync: null,
    dataSize: '0 KB',
  });
  const [exportSuccess, setExportSuccess] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = () => {
    if (typeof window === 'undefined') return;
    const chatHistory = localStorage.getItem('vaultfire_chat_history');
    const memories = localStorage.getItem('vaultfire_memories');
    const walletAddr = localStorage.getItem('vaultfire_wallet_address');
    const lastSync = localStorage.getItem('vaultfire_last_sync');

    const chatMessages = chatHistory ? JSON.parse(chatHistory).length : 0;
    const memoryCount = memories ? JSON.parse(memories).length : 0;

    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('vaultfire_')) {
        totalBytes += (localStorage.getItem(key) || '').length * 2;
      }
    }
    const dataSize =
      totalBytes < 1024
        ? `${totalBytes} B`
        : totalBytes < 1024 * 1024
        ? `${(totalBytes / 1024).toFixed(1)} KB`
        : `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;

    setStats({ chatMessages, memories: memoryCount, walletConnected: !!walletAddr, lastSync, dataSize });
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vaultfire-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem('vaultfire_last_sync', new Date().toISOString());
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
    loadStats();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    setImportSuccess(false);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as SyncData;
        importData(data);
        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 3000);
        loadStats();
      } catch {
        setImportError('Invalid backup file. Please use a valid Vaultfire export.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearAll = () => {
    if (!confirm('Clear ALL local data? This will delete your chat history, memories, and wallet. This cannot be undone.')) return;
    setClearing(true);
    clearAllMemories();
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('vaultfire_')) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    setTimeout(() => {
      setClearing(false);
      loadStats();
    }, 500);
  };

  return (
    <div style={{ padding: isMobile ? '16px 16px 32px' : 32, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#ECEDEE', marginBottom: 8 }}>Data Sync</h1>
        <p style={{ fontSize: isMobile ? 13 : 14, color: '#9BA1A6', lineHeight: 1.6 }}>Export and import your Vaultfire data. All data is stored locally in your browser.</p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: isMobile ? 8 : 12,
        marginBottom: 24,
      }}>
        {[
          { label: 'Chat Messages', value: stats.chatMessages, icon: '💬', color: '#FF6B35' },
          { label: 'Memories', value: stats.memories, icon: '🧠', color: '#9B59B6' },
          { label: 'Wallet', value: stats.walletConnected ? 'Connected' : 'None', icon: '💼', color: stats.walletConnected ? '#22C55E' : '#9BA1A6' },
          { label: 'Data Size', value: stats.dataSize, icon: '💾', color: '#9BA1A6' },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: 12, padding: isMobile ? '12px 12px' : '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: isMobile ? 14 : 16 }}>{stat.icon}</span>
              <p style={{ fontSize: isMobile ? 10 : 11, color: '#9BA1A6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</p>
            </div>
            <p style={{
              fontSize: isMobile ? 15 : 18,
              fontWeight: 700,
              color: stat.color,
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {stats.lastSync && (
        <div style={{ marginBottom: 20, padding: '10px 14px', backgroundColor: '#22C55E10', border: '1px solid #22C55E30', borderRadius: 10 }}>
          <p style={{ fontSize: 12, color: '#22C55E' }}>Last export: {new Date(stats.lastSync).toLocaleString()}</p>
        </div>
      )}

      {/* Export Card */}
      <div style={{ backgroundColor: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: 14, padding: isMobile ? 16 : 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#ECEDEE', marginBottom: 6 }}>Export Data</h2>
        <p style={{ fontSize: 13, color: '#9BA1A6', marginBottom: 14, lineHeight: 1.6 }}>
          Download a JSON backup of all your chat history, memories, and wallet address.
        </p>
        <button onClick={handleExport}
          style={{
            padding: '10px 20px',
            backgroundColor: exportSuccess ? '#22C55E' : '#FF6B35',
            border: 'none',
            borderRadius: 10,
            color: '#0A0A0C',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            width: isMobile ? '100%' : 'auto',
          }}>
          {exportSuccess ? 'Exported!' : 'Export Backup'}
        </button>
      </div>

      {/* Import Card */}
      <div style={{ backgroundColor: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: 14, padding: isMobile ? 16 : 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#ECEDEE', marginBottom: 6 }}>Import Data</h2>
        <p style={{ fontSize: 13, color: '#9BA1A6', marginBottom: 14, lineHeight: 1.6 }}>
          Restore from a previously exported backup file. This will merge with your existing data.
        </p>
        {importError && (
          <div style={{ marginBottom: 12, padding: '8px 12px', backgroundColor: '#EF444420', border: '1px solid #EF444440', borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: '#EF4444' }}>{importError}</p>
          </div>
        )}
        {importSuccess && (
          <div style={{ marginBottom: 12, padding: '8px 12px', backgroundColor: '#22C55E20', border: '1px solid #22C55E40', borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: '#22C55E' }}>Data imported successfully!</p>
          </div>
        )}
        <label style={{
          display: isMobile ? 'block' : 'inline-block',
          padding: '10px 20px',
          backgroundColor: '#2A2A2E',
          border: '1px solid #3A3A3E',
          borderRadius: 10,
          color: '#ECEDEE',
          fontSize: 14,
          cursor: 'pointer',
          textAlign: 'center',
        }}>
          Choose Backup File
          <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        </label>
      </div>

      {/* Clear Data Card */}
      <div style={{ backgroundColor: '#1A1A1E', border: '1px solid #EF444430', borderRadius: 14, padding: isMobile ? 16 : 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#EF4444', marginBottom: 6 }}>Clear All Data</h2>
        <p style={{ fontSize: 13, color: '#9BA1A6', marginBottom: 14, lineHeight: 1.6 }}>
          Permanently delete all local data including chat history, memories, and wallet. Export a backup first.
        </p>
        <button onClick={handleClearAll} disabled={clearing}
          style={{
            padding: '10px 20px',
            backgroundColor: 'transparent',
            border: '1px solid #EF4444',
            borderRadius: 10,
            color: '#EF4444',
            fontSize: 14,
            cursor: clearing ? 'default' : 'pointer',
            width: isMobile ? '100%' : 'auto',
          }}>
          {clearing ? 'Clearing...' : 'Clear All Local Data'}
        </button>
      </div>
    </div>
  );
}
