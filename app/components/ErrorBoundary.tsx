'use client';
/**
 * ErrorBoundary — Catches React render errors in any section and shows
 * a graceful recovery UI instead of crashing the entire app.
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[Vaultfire] Error in ${this.props.sectionName || 'section'}:`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '48px 24px', textAlign: 'center', minHeight: 300,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            backgroundColor: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h3 style={{
            fontSize: 16, fontWeight: 700, color: '#F4F4F5',
            marginBottom: 8, letterSpacing: '-0.02em',
          }}>
            Something went wrong
          </h3>
          <p style={{
            fontSize: 13, color: '#71717A', lineHeight: 1.5,
            maxWidth: 320, marginBottom: 20,
          }}>
            {this.props.sectionName
              ? `The ${this.props.sectionName} section encountered an error.`
              : 'This section encountered an unexpected error.'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 24px', borderRadius: 10,
              backgroundColor: '#F97316', border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            Try Again
          </button>
          {this.state.error && (
            <details style={{ marginTop: 16, maxWidth: 400, textAlign: 'left' }}>
              <summary style={{ fontSize: 11, color: '#52525B', cursor: 'pointer' }}>
                Technical details
              </summary>
              <pre style={{
                fontSize: 10, color: '#71717A', marginTop: 8,
                padding: 12, borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                overflow: 'auto', maxHeight: 120,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
