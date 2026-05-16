// ============================================================
// /api/auth/{register,login,logout,refresh}
// ============================================================

import { Env, JWT_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN } from './types';
import { generateId, signJWT, verifyPassword, hashPassword, hashToken, ok, err, nowSec } from './utils';

// ── POST /api/auth/register ─────────────────────────────────
export async function handleRegister(request: Request, env: Env): Promise<Response> {
  let body: { email?: string; password?: string; name?: string };
  try { body = await request.json(); } catch { return err('invalid_request', 400); }

  const { email, password, name } = body;
  if (!email || !password) return err('invalid_request', 400, { message: 'email 與 password 必填' });
  if (password.length < 8) return err('weak_password', 400, { message: '密碼至少 8 字元' });

  const emailLc = email.toLowerCase();
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(emailLc).first();
  if (existing) return err('email_taken', 409, { message: '此 email 已註冊' });

  const userId = generateId('usr');
  const passwordHash = await hashPassword(password);
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)`,
  ).bind(userId, emailLc, name ?? '', passwordHash).run();

  return ok({ userId, email: emailLc }, '註冊成功，請登入');
}

// ── POST /api/auth/login ────────────────────────────────────
export async function handleLogin(request: Request, env: Env): Promise<Response> {
  let body: { email?: string; password?: string };
  try { body = await request.json(); } catch { return err('invalid_request', 400); }

  const { email, password } = body;
  if (!email || !password) return err('invalid_request', 400);

  // 5 次失敗鎖 15 分鐘
  const failKey = `login:fail:${email.toLowerCase()}`;
  const failStr = await env.RATE_LIMITS.get(failKey);
  if (failStr && parseInt(failStr, 10) >= 5) {
    return err('too_many_attempts', 429, { message: '嘗試次數過多，15 分鐘後再試' });
  }

  const user = await env.DB.prepare(
    'SELECT id, email, name, password_hash, daily_token_quota, status FROM users WHERE email = ?',
  ).bind(email.toLowerCase()).first<{
    id: string; email: string; name: string; password_hash: string;
    daily_token_quota: number; status: string;
  }>();

  if (!user || user.status !== 'active' || !(await verifyPassword(password, user.password_hash))) {
    const fail = (failStr ? parseInt(failStr, 10) : 0) + 1;
    await env.RATE_LIMITS.put(failKey, String(fail), { expirationTtl: 900 });
    return err('invalid_credentials', 401, { message: '帳號或密碼錯誤' });
  }

  await env.RATE_LIMITS.delete(failKey);

  const now = nowSec();
  const accessToken = await signJWT(
    { sub: user.id, email: user.email, iat: now, exp: now + JWT_EXPIRES_IN },
    env.JWT_SECRET,
  );

  // refresh token：256-bit random，存 SHA-256 hash 於 D1
  const rawBytes = crypto.getRandomValues(new Uint8Array(32));
  const refreshToken = Array.from(rawBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const refreshHash = await hashToken(refreshToken);

  await env.DB.prepare(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
  ).bind(generateId('rt'), user.id, refreshHash, now + REFRESH_TOKEN_EXPIRES_IN).run();

  return ok({
    user: { id: user.id, email: user.email, name: user.name, daily_token_quota: user.daily_token_quota },
    accessToken,
    refreshToken,
    expiresIn: JWT_EXPIRES_IN,
  });
}

// ── POST /api/auth/refresh ──────────────────────────────────
export async function handleRefresh(request: Request, env: Env): Promise<Response> {
  let body: { refreshToken?: string };
  try { body = await request.json(); } catch { return err('invalid_request', 400); }

  const { refreshToken } = body;
  if (!refreshToken) return err('invalid_request', 400);

  const refreshHash = await hashToken(refreshToken);
  const row = await env.DB.prepare(
    `SELECT rt.user_id, rt.expires_at, u.email
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = ?`,
  ).bind(refreshHash).first<{ user_id: string; expires_at: number; email: string }>();

  if (!row || row.expires_at <= nowSec()) return err('refresh_invalid', 401);

  const now = nowSec();
  const accessToken = await signJWT(
    { sub: row.user_id, email: row.email, iat: now, exp: now + JWT_EXPIRES_IN },
    env.JWT_SECRET,
  );
  return ok({ accessToken, expiresIn: JWT_EXPIRES_IN });
}

// ── POST /api/auth/logout ───────────────────────────────────
export async function handleLogout(request: Request, env: Env): Promise<Response> {
  let body: { refreshToken?: string };
  try { body = await request.json(); } catch { return ok({}); }

  if (body.refreshToken) {
    const refreshHash = await hashToken(body.refreshToken);
    await env.DB.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').bind(refreshHash).run();
  }
  return ok({}, '已登出');
}
