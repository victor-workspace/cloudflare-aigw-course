// ============================================================
// MCP server 管理 API
// GET    /api/mcp/servers           列出已設定的 MCP server + 連線狀態
// GET    /api/mcp/servers/:id/tools 取得指定 server 的 tools 清單
// POST   /api/mcp/servers/:id/token 儲存 OAuth Bearer token（KV）
// DELETE /api/mcp/servers/:id/token 中斷連線（刪除 token）
// ============================================================

import { Env } from './types';
import { ok, err } from './utils';
import { requireAuth, isAuthError } from './middleware';
import { mcpListTools } from './mcp-client';

export interface McpServerConfig {
  id: string;
  name: string;
  icon: string;
  url: string;
  requiresOAuth: boolean;
  desc: string;
}

const KNOWN_META: Record<string, { name: string; icon: string; desc: string }> = {
  'cloudflare-docs': { name: 'Cloudflare Docs',      icon: '📚', desc: '查詢 Cloudflare 官方文件' },
  'radar':           { name: 'Cloudflare Radar',     icon: '📡', desc: '網路流量與威脅情報' },
  'observability':   { name: 'Workers Observability',icon: '🔭', desc: 'Workers 日誌、指標、追蹤' },
};

/**
 * 解析 MCP_SERVER_URLS 環境變數
 * 格式："id=https://url.example.com,id2=https://url2.example.com:oauth"
 * ":oauth" 後綴 = 該 server 需要 OAuth Bearer token
 */
export function getServerConfigs(env: Env): McpServerConfig[] {
  const raw = (env.MCP_SERVER_URLS ?? '').trim();
  if (!raw) return [];

  return raw.split(',').flatMap(part => {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) return [];
    const id = part.slice(0, eqIdx).trim();
    let url = part.slice(eqIdx + 1).trim();
    const requiresOAuth = url.endsWith(':oauth');
    if (requiresOAuth) url = url.slice(0, -6);
    const meta = KNOWN_META[id] ?? { name: id, icon: '🔌', desc: 'Remote MCP server' };
    return [{ id, ...meta, url, requiresOAuth }];
  });
}

const kvTokenKey = (userId: string, serverId: string) => `mcp_token:${userId}:${serverId}`;

// GET /api/mcp/servers
export async function handleMcpServers(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) return auth;

  const configs = getServerConfigs(env);
  const servers = await Promise.all(configs.map(async c => {
    const hasToken = c.requiresOAuth
      ? !!(await env.SESSIONS.get(kvTokenKey(auth.userId, c.id)))
      : true;
    return {
      id: c.id, name: c.name, icon: c.icon, desc: c.desc,
      url: c.url, requiresOAuth: c.requiresOAuth, connected: hasToken,
    };
  }));
  return ok({ servers });
}

// GET /api/mcp/servers/:id/tools
export async function handleMcpGetTools(request: Request, env: Env, serverId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) return auth;

  const config = getServerConfigs(env).find(c => c.id === serverId);
  if (!config) return err('server_not_found', 404);

  let token: string | undefined;
  if (config.requiresOAuth) {
    token = (await env.SESSIONS.get(kvTokenKey(auth.userId, serverId))) ?? undefined;
    if (!token) return err('not_connected', 401, { message: '尚未設定該 server 的 token' });
  }

  try {
    const tools = await mcpListTools(config.url, token);
    return ok({ tools });
  } catch (e) {
    return err('mcp_error', 502, { message: String(e) });
  }
}

// POST /api/mcp/servers/:id/token  body: { token }
export async function handleMcpSaveToken(request: Request, env: Env, serverId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) return auth;

  let body: { token?: string };
  try { body = await request.json(); } catch { return err('invalid_request', 400); }
  if (!body.token) return err('invalid_request', 400, { message: 'token 必填' });

  await env.SESSIONS.put(kvTokenKey(auth.userId, serverId), body.token);
  return ok({}, 'token 已儲存');
}

// DELETE /api/mcp/servers/:id/token
export async function handleMcpDisconnect(request: Request, env: Env, serverId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) return auth;

  await env.SESSIONS.delete(kvTokenKey(auth.userId, serverId));
  return ok({}, '已中斷連線');
}
