'use client';

import { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  eventId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Send error to Sentry
    Sentry.withScope((scope) => {
      scope.setContext('errorBoundary', {
        componentStack: errorInfo.componentStack,
      });
      const eventId = Sentry.captureException(error);
      this.setState({ eventId });
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="card max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-vaultfire-red/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-vaultfire-red" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-base-gray-400 mb-6">
              {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                window.location.reload();
              }}
              className="btn-primary inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
