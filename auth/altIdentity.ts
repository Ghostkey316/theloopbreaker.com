import fs from 'fs';
import path from 'path';
import { randomUUID, createHash } from 'crypto';
import { authenticateWallet } from '../wallet_auth';

type SocialProvider = 'google' | 'github';
export type AuthStrategy = 'wallet' | 'email_otp' | 'oauth_google' | 'oauth_github';

export interface PartnerAuthConfig {
  [partnerId: string]: AuthStrategy;
}

export interface EmailOtpPayload {
  email?: string;
  otp?: string;
}

export interface SocialPayload {
  provider?: SocialProvider;
  token?: string;
  email?: string;
}

export type FallbackPayload = EmailOtpPayload & SocialPayload;

export interface FallbackSession {
  sessionId: string;
  partnerId: string;
  strategy: Exclude<AuthStrategy, 'wallet'>;
  identity: string;
  issuedAt: string;
  expiresAt: string;
  metadata: Record<string, string>;
}

export interface AuthResult {
  strategy: AuthStrategy;
  wallet?: string;
  fallbackSession?: FallbackSession;
  onChainAuthorityPreserved: boolean;
  walletError?: Error;
}

export interface AuthOptions {
  configPath?: string;
  now?: Date;
}

const FALLBACK_SESSIONS = new Map<string, FallbackSession>();
let cachedConfig: PartnerAuthConfig | null = null;
let cachedConfigPath: string | null = null;
let cachedConfigMtime: number | null = null;

function resolveConfigPath(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  if (process.env.PARTNER_AUTH_CONFIG_PATH) {
    return process.env.PARTNER_AUTH_CONFIG_PATH;
  }
  return path.resolve(__dirname, '..', 'partner-auth-config.json');
}

export function loadPartnerAuthConfig(customPath?: string): PartnerAuthConfig {
  const targetPath = resolveConfigPath(customPath);
  try {
    const stats = fs.statSync(targetPath);
    if (
      !cachedConfig ||
      cachedConfigPath !== targetPath ||
      cachedConfigMtime !== stats.mtimeMs
    ) {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      cachedConfig = JSON.parse(raw) as PartnerAuthConfig;
      cachedConfigPath = targetPath;
      cachedConfigMtime = stats.mtimeMs;
    }
    return cachedConfig || {};
  } catch (error) {
    if (customPath) {
      throw new Error(`Unable to load partner auth config from ${targetPath}: ${(error as Error).message}`);
    }
    return {};
  }
}

export function getPartnerAuthStrategy(partnerId: string, customPath?: string): AuthStrategy {
  const config = loadPartnerAuthConfig(customPath);
  return config[partnerId] || 'wallet';
}

function validateEmail(email?: string): string {
  if (!email) {
    throw new Error('Fallback authentication requires an email address.');
  }
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw new Error('Invalid email address for fallback authentication.');
  }
  return trimmed;
}

function validateOtp(otp?: string): string {
  if (!otp) {
    throw new Error('OTP code is required for email fallback authentication.');
  }
  const trimmed = otp.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    throw new Error('OTP codes must be exactly 6 digits.');
  }
  return trimmed;
}

function validateSocialPayload(strategy: AuthStrategy, payload: FallbackPayload): { identity: string; metadata: Record<string, string> } {
  const provider: SocialProvider | undefined = payload.provider;
  const token = payload.token?.trim();
  if (!provider || !token) {
    throw new Error('OAuth fallback requires both a provider and an access token.');
  }

  if (strategy === 'oauth_google' && provider !== 'google') {
    throw new Error('Google OAuth strategy requires provider="google".');
  }
  if (strategy === 'oauth_github' && provider !== 'github') {
    throw new Error('GitHub OAuth strategy requires provider="github".');
  }

  if (token.length < 20) {
    throw new Error('OAuth tokens must be at least 20 characters long.');
  }

  const email = payload.email ? validateEmail(payload.email) : 'unknown@oauth.local';

  return {
    identity: `${provider}:${email}`,
    metadata: {
      provider,
      email,
      tokenDigest: createHash('sha256').update(token).digest('hex'),
    },
  };
}

function validateFallbackPayload(
  strategy: Exclude<AuthStrategy, 'wallet'>,
  payload: FallbackPayload,
): { identity: string; metadata: Record<string, string> } {
  if (strategy === 'email_otp') {
    const email = validateEmail(payload.email);
    const otp = validateOtp(payload.otp);
    return {
      identity: email,
      metadata: { otpDigest: createHash('sha256').update(otp).digest('hex') },
    };
  }

  return validateSocialPayload(strategy === 'oauth_google' ? 'oauth_google' : 'oauth_github', payload);
}

function createFallbackSession(
  partnerId: string,
  strategy: Exclude<AuthStrategy, 'wallet'>,
  identity: string,
  metadata: Record<string, string>,
  now: Date,
): FallbackSession {
  const sessionId = randomUUID();
  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const session: FallbackSession = {
    sessionId,
    partnerId,
    strategy,
    identity,
    issuedAt,
    expiresAt,
    metadata,
  };
  FALLBACK_SESSIONS.set(sessionId, session);
  return session;
}

export function getFallbackSession(sessionId: string): FallbackSession | null {
  return FALLBACK_SESSIONS.get(sessionId) || null;
}

export function clearFallbackSessions(): void {
  FALLBACK_SESSIONS.clear();
}

export function authenticateWithFallback(
  partnerId: string,
  walletIdentifier: string,
  payload: FallbackPayload = {},
  options: AuthOptions = {},
): AuthResult {
  try {
    const wallet = authenticateWallet(walletIdentifier);
    return {
      strategy: 'wallet',
      wallet,
      onChainAuthorityPreserved: true,
    };
  } catch (walletError) {
    const strategy = getPartnerAuthStrategy(partnerId, options.configPath);
    if (strategy === 'wallet') {
      throw walletError;
    }

    const now = options.now || new Date();
    const { identity, metadata } = validateFallbackPayload(strategy, payload);
    const session = createFallbackSession(partnerId, strategy, identity, metadata, now);

    return {
      strategy,
      fallbackSession: session,
      onChainAuthorityPreserved: false,
      walletError,
    };
  }
}
