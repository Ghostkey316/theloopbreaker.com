'use client';

import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Home from './sections/Home';
import Chat from './sections/Chat';
import Wallet from './sections/Wallet';
import Verify from './sections/Verify';
import Bridge from './sections/Bridge';
import Dashboard from './sections/Dashboard';
import VNS from './sections/VNS';
import AgentHub from './sections/AgentHub';
import AgentMarketplace from './sections/AgentMarketplace';
import NS3 from './sections/NS3';

type Section = 'home' | 'chat' | 'wallet' | 'verify' | 'bridge' | 'dashboard' | 'vns' | 'agent-hub' | 'marketplace' | 'ns3';

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
      case 'vns':
        return <VNS />;
      case 'agent-hub':
        return <AgentHub />;
      case 'marketplace':
        return <AgentMarketplace />;
      case 'ns3':
        return <NS3 />;
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
