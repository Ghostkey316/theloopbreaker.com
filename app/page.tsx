'use client';

import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Home from './sections/Home';
import Chat from './sections/Chat';
import Wallet from './sections/Wallet';
import Verify from './sections/Verify';
import Bridge from './sections/Bridge';
import Dashboard from './sections/Dashboard';
import Sync from './sections/Sync';

type Section = 'home' | 'chat' | 'wallet' | 'verify' | 'bridge' | 'dashboard' | 'sync';

export default function Page() {
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return <Home />;
      case 'chat':
        return <Chat />;
      case 'wallet':
        return <Wallet />;
      case 'verify':
        return <Verify />;
      case 'bridge':
        return <Bridge />;
      case 'dashboard':
        return <Dashboard />;
      case 'sync':
        return <Sync />;
      default:
        return <Home />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0A0A0C', overflow: 'hidden' }}>
      <Sidebar activeSection={activeSection} onSectionChange={(s) => setActiveSection(s as Section)} />
      <main style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: '#0A0A0C',
        paddingTop: isMobile ? 64 : 0,
        width: '100%',
        minWidth: 0,
      }}>
        {renderSection()}
      </main>
    </div>
  );
}
