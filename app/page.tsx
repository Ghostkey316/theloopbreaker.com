'use client';

import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Home from './sections/Home';
import Chat from './sections/Chat';
import Wallet from './sections/Wallet';
import Verify from './sections/Verify';
import Bridge from './sections/Bridge';
import Dashboard from './sections/Dashboard';

type Section = 'home' | 'chat' | 'wallet' | 'verify' | 'bridge' | 'dashboard';

export default function Page() {
  const [activeSection, setActiveSection] = useState<Section>('home');

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
      default:
        return <Home />;
    }
  };

  return (
    <div className="flex h-screen bg-ember-bg">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <main className="flex-1 overflow-auto">
        {renderSection()}
      </main>
    </div>
  );
}
