// ============================================================
// Type definitions — Cloudflare AI Gateway Course
// ============================================================

export interface Env {
  // D1 SQLite database
  DB: D1Database;
  // KV: 兩個用途分開
  SESSIONS: KVNamespace;     // refresh token / MCP token 等長期狀態
  RATE_LIMITS: KVNamespace;  // rate limit / login failure 計數

  // Secrets / Vars
  JWT_SECRET: string;
  ENVIRONMENT: string;

  // Cloudflare AI Gateway
  CF_AI_GATEWAY_ID: string;
  CF_ACCOUNT_ID: string;
  CF_AI_GATEWAY_TOKEN: string;

  // BYOK alias name configured in CF AI Gateway dashboard
  // 學員只需設定一個 provider 即可（建議從 Anthropic 開始）
  ANTHROPIC_BYOK_ALIAS?: string;  // e.g. "claude_demo"
  OPENAI_BYOK_ALIAS?: string;     // e.g. "openai_demo"

  // MCP servers — 格式："id=url,id=url:oauth"
  MCP_SERVER_URLS?: string;
}

// ── DB Models ────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  daily_token_quota: number;
  status: 'active' | 'suspended';
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  total_tokens: number;
  created_at: number;
}

// ── JWT ──────────────────────────────────────────────────────
export interface JWTPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

// ── API response shape ──────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: Record<string, unknown>;
}

// ── Rate limiter state ──────────────────────────────────────
export interface RateLimitState {
  count: number;
  resetAt: number;
}

// ── Constants ────────────────────────────────────────────────
export const JWT_EXPIRES_IN = 60 * 60;              // 1 hour
export const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 30; // 30 days
export const RATE_LIMIT_WINDOW = 60;                // 1 min
export const RATE_LIMIT_MAX_AUTH = 60;              // logged-in
export const RATE_LIMIT_MAX_ANON = 10;              // anonymous
export const MAX_MESSAGE_LENGTH = 8000;
export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
