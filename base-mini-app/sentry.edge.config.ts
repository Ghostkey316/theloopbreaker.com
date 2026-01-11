import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  tracesSampleRate: 1.0,

  debug: false,

  environment: process.env.NODE_ENV,

  // Enable Sentry only in production
  enabled: process.env.NODE_ENV === 'production',
});
