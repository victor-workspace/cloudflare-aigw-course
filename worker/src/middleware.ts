// ============================================================
// CORS / JWT auth / Rate limit middleware
// ============================================================

import { Env, JWTPayload, RateLimitState, RATE_LIMIT_MAX_AUTH, RATE_LIMIT_MAX_ANON, RATE_LIMIT_WINDOW } from './types';
import { verifyJWT, err, getClientIP, nowSec } from './utils';

// ── CORS ─────────────────────────────────────────────────────
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleCORS(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function addCors(res: Response, request: Request): Response {
  const headers = new Headers(res.headers);
  Object.entries(corsHeaders(request)).forEach(([k, v]) => headers.set(k, v));
  return new Response(res.body, { status: res.status, headers });
}

// ── Auth context ─────────────────────────────────────────────
export interface AuthContext {
  userId: string;
  email: string;
}

export async function requireAuth(request: Request, env: Env): Promise<AuthContext | Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return err('unauthorized', 401);

  const token = authHeader.slice(7);
  const payload = await verifyJWT<JWTPayload>(token, env.JWT_SECRET);
  if (!payload) return err('token_expired', 401);

  const user = await env.DB.prepare('SELECT status FROM users WHERE id = ?')
    .bind(payload.sub).first<{ status: string }>();
  if (!user || user.status !== 'active') return err('account_suspended', 403);

  return { userId: payload.sub, email: payload.email };
}

export function isAuthError(v: AuthContext | Response): v is Response {
  return v instanceof Response;
}

// ── Rate limiter (KV sliding window) ────────────────────────
export async function rateLimit(
  request: Request, env: Env, userId?: string,
): Promise<Response | null> {
  const key = userId ? `rl:user:${userId}` : `rl:ip:${getClientIP(request)}`;
  const max = userId ? RATE_LIMIT_MAX_AUTH : RATE_LIMIT_MAX_ANON;
  const now = nowSec();

  const raw = await env.RATE_LIMITS.get(key);
  const state: RateLimitState = raw
    ? JSON.parse(raw)
    : { count: 0, resetAt: now + RATE_LIMIT_WINDOW };

  if (state.resetAt <= now) {
    state.count = 0;
    state.resetAt = now + RATE_LIMIT_WINDOW;
  }
  state.count += 1;

  if (state.count > max) {
    return err('rate_limit_exceeded', 429, {
      message: `每分鐘上限 ${max} 次，請於 ${state.resetAt - now} 秒後再試`,
    });
  }

  await env.RATE_LIMITS.put(key, JSON.stringify(state), {
    expirationTtl: RATE_LIMIT_WINDOW + 5,
  });
  return null;
}
