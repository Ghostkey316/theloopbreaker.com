'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Home from './sections/Home';
import Chat from './sections/Chat';
import Wallet from './sections/Wallet';
import Verify from './sections/Verify';
import Bridge from './sections/Bridge';
import Dashboard from './sections/Dashboard';
import Sync from './sections/Sync';
import TrustScore from './sections/TrustScore';
import Analytics from './sections/Analytics';
import VNS from './sections/VNS';
import AgentHub from './sections/AgentHub';
import AgentMarketplace from './sections/AgentMarketplace';
import ZKProofs from './sections/ZKProofs';
import TrustBadges from './sections/TrustBadges';
import AgentEarnings from './sections/AgentEarnings';
import AgentAPI from './sections/AgentAPI';
import DisclaimerModal from './components/DisclaimerModal';
import FooterDisclaimer from './components/FooterDisclaimer';
import OnboardingModal from './components/OnboardingModal';
import ToastContainer from './components/Toast';
import WalletGate from './components/WalletGate';

type Section = 'home' | 'chat' | 'wallet' | 'verify' | 'bridge' | 'dashboard' | 'sync' | 'trust' | 'analytics' | 'vns' | 'agent-hub' | 'marketplace' | 'zk-proofs' | 'trust-badges' | 'earnings' | 'agent-api';

// Skeleton placeholder for section loading
function SectionSkeleton() {
  return (
    <div style={{ padding: '48px 40px', maxWidth: 720, margin: '0 auto' }}>
      {/* Title skeleton */}
      <div className="skeleton skeleton-title" style={{ width: '40%', marginBottom: 8 }} />
      <div className="skeleton skeleton-text-sm" style={{ width: '60%', marginBottom: 40 }} />

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-card" style={{ flex: 1, height: 80, padding: 20 }}>
            <div className="skeleton skeleton-text-sm" style={{ width: '50%', marginBottom: 12 }} />
            <div className="skeleton skeleton-text-lg" style={{ width: '30%' }} />
          </div>
        ))}
      </div>

      {/* Content rows */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div className="skeleton skeleton-circle" style={{ width: 8, height: 8, flexShrink: 0 }} />
          <div className="skeleton skeleton-text" style={{ flex: 1 }} />
          <div className="skeleton skeleton-text" style={{ width: '20%' }} />
        </div>
      ))}
    </div>
  );
}

// Chat skeleton
function ChatSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 680, margin: '0 auto', width: '100%' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div className="skeleton skeleton-circle" style={{ width: 26, height: 26, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-text" style={{ width: '80%', marginBottom: 8 }} />
              <div className="skeleton skeleton-text" style={{ width: '60%', marginBottom: 8 }} />
              <div className="skeleton skeleton-text" style={{ width: '40%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [isMobile, setIsMobile] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedSection, setDisplayedSection] = useState<Section>('home');
  const [showSkeleton, setShowSkeleton] = useState(false);
  const transitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skeletonTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Touch/swipe state for mobile sidebar
  const touchStartX = useRef<number | null>(null);
  const [sidebarSwipeOpen, setSidebarSwipeOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleSectionChange = useCallback((section: string) => {
    const newSection = section as Section;
    if (newSection === activeSection) return;

    // Clear any pending timeouts
    if (transitionTimeout.current) clearTimeout(transitionTimeout.current);
    if (skeletonTimeout.current) clearTimeout(skeletonTimeout.current);

    // Start exit animation
    setIsTransitioning(true);

    // Show skeleton briefly for heavier sections
    const heavySections = ['dashboard', 'analytics', 'trust', 'verify', 'bridge', 'agent-hub', 'marketplace', 'zk-proofs', 'vns', 'trust-badges', 'earnings', 'agent-api'];
    if (heavySections.includes(newSection)) {
      skeletonTimeout.current = setTimeout(() => {
        setShowSkeleton(false);
      }, 400);
    }

    transitionTimeout.current = setTimeout(() => {
      setDisplayedSection(newSection);
      setActiveSection(newSection);
      setIsTransitioning(false);
      setShowSkeleton(false);
    }, 150);
  }, [activeSection]);

  // Swipe-to-open sidebar on mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    // Only trigger from left edge (first 20px)
    if (touch.clientX < 20) {
      touchStartX.current = touch.clientX;
    }
  }, [isMobile]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isMobile || touchStartX.current === null) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    if (deltaX > 60) {
      setSidebarSwipeOpen(true);
    }
    touchStartX.current = null;
  }, [isMobile]);

  const goToWallet = useCallback(() => handleSectionChange('wallet'), [handleSectionChange]);

  const renderSection = () => {
    if (showSkeleton) {
      return displayedSection === 'chat' ? <ChatSkeleton /> : <SectionSkeleton />;
    }

    switch (displayedSection) {
      case 'home': return <Home />;
      case 'chat': return (
        <WalletGate featureName="Embris" featureDesc="Chat with your AI companion. Your wallet is your identity — no account needed." onGoToWallet={goToWallet}>
          <Chat />
        </WalletGate>
      );
      case 'wallet': return <Wallet />;
      case 'verify': return <Verify />;
      case 'bridge': return <Bridge />;
      case 'dashboard': return <Dashboard />;
      case 'sync': return <Sync />;
      case 'trust': return <TrustScore />;
      case 'analytics': return <Analytics />;
      case 'vns': return (
        <WalletGate featureName="VNS Identity" featureDesc="Register your .vns name on-chain. Requires a connected wallet to sign the transaction." onGoToWallet={goToWallet}>
          <VNS />
        </WalletGate>
      );
      case 'agent-hub': return <AgentHub />;
      case 'marketplace': return <AgentMarketplace />;
      case 'zk-proofs': return <ZKProofs />;
      case 'trust-badges': return <TrustBadges />;
      case 'earnings': return (
        <WalletGate featureName="Agent Earnings" featureDesc="View and withdraw your on-chain earnings. Requires a connected wallet." onGoToWallet={goToWallet}>
          <AgentEarnings />
        </WalletGate>
      );
      case 'agent-api': return <AgentAPI />;
      default: return <Home />;
    }
  };

  const isChat = displayedSection === 'chat';

  return (
    <>
      <DisclaimerModal />
      <OnboardingModal />
      <ToastContainer />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          backgroundColor: '#09090B',
          overflow: 'hidden',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <Sidebar
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            mobileForceOpen={sidebarSwipeOpen}
            onMobileClose={() => setSidebarSwipeOpen(false)}
          />
          <main
            style={{
              flex: 1,
              overflowY: isChat ? 'hidden' : 'auto',
              overflowX: 'hidden',
              backgroundColor: '#09090B',
              paddingTop: isMobile ? 52 : 0,
              width: '100%',
              minWidth: 0,
              display: isChat ? 'flex' : 'block',
              flexDirection: 'column',
              // Smooth scroll
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
            }}
          >
            {/* Page transition wrapper */}
            <div
              key={displayedSection}
              className={isTransitioning ? 'page-exit' : 'page-enter'}
              style={{
                height: isChat ? '100%' : 'auto',
                display: isChat ? 'flex' : 'block',
                flexDirection: 'column',
              }}
            >
              {renderSection()}
            </div>
          </main>
        </div>

        {!isChat && <FooterDisclaimer />}
      </div>
    </>
  );
}
