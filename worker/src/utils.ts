// ============================================================
// Helpers: JSON response / JWT / Password / IDs
// ============================================================

import { ApiResponse } from './types';

// ── ID generation ──────────────────────────────────────────
export function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${ts}${rand}`;
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}

// ── Response helpers ────────────────────────────────────────
export function jsonResponse<T>(data: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function ok<T>(data: T, message?: string): Response {
  return jsonResponse({ success: true, data, message });
}

export function err(error: string, status: number, details?: Record<string, unknown>): Response {
  return jsonResponse({ success: false, error, details }, status);
}

// ── Base64URL ────────────────────────────────────────────────
function base64url(input: ArrayBuffer | ArrayBufferView): string {
  const bytes = ArrayBuffer.isView(input)
    ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
    : new Uint8Array(input);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

// ── JWT (HMAC-SHA256 via Web Crypto) ────────────────────────
async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify']
  );
}

export async function signJWT(payload: object, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const header = base64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${base64url(sig)}`;
}

export async function verifyJWT<T = Record<string, unknown>>(
  token: string, secret: string,
): Promise<T | null> {
  try {
    const [header, body, sig] = token.split('.');
    if (!header || !body || !sig) return null;
    const enc = new TextEncoder();
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC', key, base64urlDecode(sig), enc.encode(`${header}.${body}`),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(body))) as T & { exp?: number };
    if (payload.exp && payload.exp < nowSec()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Password hashing (PBKDF2 via Web Crypto) ────────────────
export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key, 256,
  );
  const saltStr = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashStr = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2$100000$${saltStr}$${hashStr}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = new Uint8Array(parts[2].match(/.{2}/g)!.map(h => parseInt(h, 16)));
  const expected = parts[3];

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key, 256,
  );
  const actual = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return actual === expected;
}

// ── SHA-256 hash (for refresh tokens) ───────────────────────
export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
