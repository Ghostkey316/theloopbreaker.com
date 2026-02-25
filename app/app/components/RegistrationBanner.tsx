'use client';

interface RegistrationBannerProps {
  onRegisterClick: () => void;
}

export default function RegistrationBanner({ onRegisterClick }: RegistrationBannerProps) {
  return (
    <div style={{
      maxWidth: 680,
      width: '100%',
      margin: '0 auto',
      padding: '0 24px 4px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 14px',
        backgroundColor: 'rgba(255,255,255,0.015)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: 10,
      }}>
        <p style={{
          fontSize: 12,
          color: '#52525B',
          margin: 0,
          lineHeight: 1.4,
          letterSpacing: '-0.01em',
        }}>
          Register on-chain to unlock memory, self-learning, and goals
        </p>
        <button
          onClick={onRegisterClick}
          style={{
            flexShrink: 0,
            padding: '5px 12px',
            backgroundColor: 'transparent',
            color: '#F97316',
            border: '1px solid rgba(249,115,22,0.2)',
            borderRadius: 7,
            fontSize: 11.5,
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)';
            e.currentTarget.style.color = '#FB923C';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(249,115,22,0.2)';
            e.currentTarget.style.color = '#F97316';
          }}
        >
          Register
        </button>
      </div>
    </div>
  );
}
