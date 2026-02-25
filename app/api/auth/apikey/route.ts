/**
 * POST   /api/auth/apikey — Generate a new API key (requires session auth)
 * GET    /api/auth/apikey — List API keys for the authenticated user
 * DELETE /api/auth/apikey — Revoke an API key
 *
 * API keys allow external SDK developers to authenticate without a wallet session.
 * Keys are hashed before storage — the raw key is only returned once on creation.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateRequest,
  createAPIKey,
  revokeAPIKey,
  listAPIKeys,
  corsHeaders,
  type APIPermission,
} from '../../../lib/auth';

// ─── CORS Preflight ──────────────────────────────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// ─── POST: Generate API Key ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    // Require session authentication to create API keys
    const auth = await authenticateRequest(request.headers);
    if (!auth.authenticated || !auth.address) {
      return NextResponse.json(
        { error: auth.error || 'Authentication required to create API keys' },
        { status: auth.statusCode, headers },
      );
    }

    const body = await request.json();
    const { label, permissions, rateLimit, ttlDays } = body;

    // Validate label
    if (!label || typeof label !== 'string' || label.length < 1 || label.length > 100) {
      return NextResponse.json(
        { error: 'Label is required (1-100 characters)' },
        { status: 400, headers },
      );
    }

    // Validate permissions
    const validPermissions: APIPermission[] = ['read', 'write', 'admin'];
    const requestedPermissions: APIPermission[] = Array.isArray(permissions)
      ? permissions.filter((p: string) => validPermissions.includes(p as APIPermission)) as APIPermission[]
      : ['read'];

    // Non-admin users cannot grant admin permission
    if (requestedPermissions.includes('admin') && auth.method !== 'session') {
      return NextResponse.json(
        { error: 'Admin permission can only be granted via session authentication' },
        { status: 403, headers },
      );
    }

    // Validate rate limit
    const rateLimitValue = typeof rateLimit === 'number' && rateLimit > 0 && rateLimit <= 1000
      ? rateLimit
      : undefined;

    // Validate TTL
    const ttlMs = typeof ttlDays === 'number' && ttlDays > 0 && ttlDays <= 365
      ? ttlDays * 24 * 60 * 60 * 1000
      : undefined;

    const { key, keyData } = await createAPIKey(
      auth.address,
      label.trim(),
      requestedPermissions,
      rateLimitValue,
      ttlMs,
    );

    return NextResponse.json(
      {
        success: true,
        apiKey: key, // Only returned ONCE — store it securely!
        label: keyData.label,
        permissions: keyData.permissions,
        rateLimit: keyData.rateLimit,
        expiresAt: keyData.expiresAt,
        warning: 'Store this API key securely. It will not be shown again.',
      },
      { status: 201, headers },
    );
  } catch (error) {
    console.error('[/api/auth/apikey] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500, headers },
    );
  }
}

// ─── GET: List API Keys ──────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const auth = await authenticateRequest(request.headers);
    if (!auth.authenticated || !auth.address) {
      return NextResponse.json(
        { error: auth.error || 'Authentication required' },
        { status: auth.statusCode, headers },
      );
    }

    const keys = listAPIKeys(auth.address);

    // Return keys without the hash (security)
    const sanitizedKeys = keys.map(k => ({
      label: k.label,
      permissions: k.permissions,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
      rateLimit: k.rateLimit,
      lastUsed: k.lastUsed,
      usageCount: k.usageCount,
      active: k.active,
      keyPrefix: 'vf_****' + k.keyHash.slice(-8), // Show last 8 chars of hash for identification
    }));

    return NextResponse.json(
      { keys: sanitizedKeys, total: sanitizedKeys.length },
      { status: 200, headers },
    );
  } catch (error) {
    console.error('[/api/auth/apikey] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to list API keys' },
      { status: 500, headers },
    );
  }
}

// ─── DELETE: Revoke API Key ──────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const auth = await authenticateRequest(request.headers);
    if (!auth.authenticated || !auth.address) {
      return NextResponse.json(
        { error: auth.error || 'Authentication required' },
        { status: auth.statusCode, headers },
      );
    }

    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'API key is required for revocation' },
        { status: 400, headers },
      );
    }

    const revoked = await revokeAPIKey(apiKey);

    return NextResponse.json(
      { success: true, revoked },
      { status: 200, headers },
    );
  } catch (error) {
    console.error('[/api/auth/apikey] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500, headers },
    );
  }
}
