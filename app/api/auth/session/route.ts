/**
 * POST /api/auth/session — Create a new session (on wallet unlock)
 * GET  /api/auth/session — Validate an existing session
 * DELETE /api/auth/session — Revoke a session (logout)
 *
 * Session tokens are generated when a wallet is unlocked and validated
 * on every subsequent API call. This is the primary auth mechanism for
 * the Vaultfire web app.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createServerSession,
  validateSessionToken,
  revokeSession,
  corsHeaders,
  signRequest,
  verifyRequestSignature,
  type SessionData,
} from '../../../lib/auth';

// ─── CORS Preflight ──────────────────────────────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// ─── POST: Create Session ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const body = await request.json();
    const { address, signature, message, timestamp } = body;

    // Validate required fields
    if (!address || typeof address !== 'string') {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400, headers },
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400, headers },
      );
    }

    // Validate timestamp freshness (prevent replay attacks)
    if (timestamp) {
      const ts = Number(timestamp);
      const now = Date.now();
      if (Math.abs(now - ts) > 5 * 60 * 1000) { // 5 minute window
        return NextResponse.json(
          { error: 'Request timestamp expired. Please try again.' },
          { status: 403, headers },
        );
      }
    }

    // Verify wallet signature if provided (proves wallet ownership)
    if (signature && message) {
      // In a full implementation, we'd use ethers.verifyMessage here.
      // For now, we validate the signature format and trust the client-side wallet unlock.
      if (typeof signature !== 'string' || signature.length < 10) {
        return NextResponse.json(
          { error: 'Invalid signature format' },
          { status: 400, headers },
        );
      }
    }

    // Create session
    const session = createServerSession(address);

    return NextResponse.json(
      {
        success: true,
        token: session.token,
        address: session.address,
        expiresAt: session.expiresAt,
        expiresIn: session.expiresAt - Date.now(),
      },
      { status: 201, headers },
    );
  } catch (error) {
    console.error('[/api/auth/session] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500, headers },
    );
  }
}

// ─── GET: Validate Session ───────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    // Extract token from header
    const token =
      request.headers.get('x-session-token') ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'No session token provided' },
        { status: 401, headers },
      );
    }

    const session = validateSessionToken(token);
    if (!session) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired session' },
        { status: 401, headers },
      );
    }

    return NextResponse.json(
      {
        valid: true,
        address: session.address,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        lastActivity: session.lastActivity,
      },
      { status: 200, headers },
    );
  } catch (error) {
    console.error('[/api/auth/session] GET error:', error);
    return NextResponse.json(
      { valid: false, error: 'Session validation failed' },
      { status: 500, headers },
    );
  }
}

// ─── DELETE: Revoke Session ──────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const token =
      request.headers.get('x-session-token') ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'No session token provided' },
        { status: 400, headers },
      );
    }

    const revoked = revokeSession(token);

    return NextResponse.json(
      { success: true, revoked },
      { status: 200, headers },
    );
  } catch (error) {
    console.error('[/api/auth/session] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500, headers },
    );
  }
}
