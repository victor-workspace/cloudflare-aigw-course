// ============================================================
// Cloudflare AI Gateway Course — API Worker entry
// ============================================================

import { Env } from './types';
import { err } from './utils';
import { handleCORS, addCors, rateLimit } from './middleware';
import { handleRegister, handleLogin, handleLogout, handleRefresh } from './auth';
import { handleSendMessage, handleGetHistory, handleDeleteConversation } from './chat';
import { handleMcpServers, handleMcpGetTools, handleMcpSaveToken, handleMcpDisconnect } from './mcp';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    // CORS preflight
    const corsRes = handleCORS(request);
    if (corsRes) return corsRes;

    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    try {
      // ── Health check ────────────────────────────────────
      if (pathname === '/health' && method === 'GET') {
        return addCors(new Response('OK', { status: 200 }), request);
      }

      // ── Auth (rate limit by IP) ─────────────────────────
      if (pathname === '/api/auth/register' && method === 'POST') {
        const rl = await rateLimit(request, env); if (rl) return addCors(rl, request);
        return addCors(await handleRegister(request, env), request);
      }
      if (pathname === '/api/auth/login' && method === 'POST') {
        const rl = await rateLimit(request, env); if (rl) return addCors(rl, request);
        return addCors(await handleLogin(request, env), request);
      }
      if (pathname === '/api/auth/refresh' && method === 'POST') {
        return addCors(await handleRefresh(request, env), request);
      }
      if (pathname === '/api/auth/logout' && method === 'POST') {
        return addCors(await handleLogout(request, env), request);
      }

      // ── Chat ────────────────────────────────────────────
      if (pathname === '/api/chat/send' && method === 'POST') {
        return addCors(await handleSendMessage(request, env), request);
      }
      if (pathname === '/api/chat/history' && method === 'GET') {
        return addCors(await handleGetHistory(request, env), request);
      }
      const convMatch = pathname.match(/^\/api\/chat\/conversation\/([^/]+)$/);
      if (convMatch && method === 'DELETE') {
        return addCors(await handleDeleteConversation(request, env, convMatch[1]), request);
      }

      // ── MCP server management ───────────────────────────
      if (pathname === '/api/mcp/servers' && method === 'GET') {
        return addCors(await handleMcpServers(request, env), request);
      }
      const toolsMatch = pathname.match(/^\/api\/mcp\/servers\/([^/]+)\/tools$/);
      if (toolsMatch && method === 'GET') {
        return addCors(await handleMcpGetTools(request, env, toolsMatch[1]), request);
      }
      const tokenMatch = pathname.match(/^\/api\/mcp\/servers\/([^/]+)\/token$/);
      if (tokenMatch && method === 'POST') {
        return addCors(await handleMcpSaveToken(request, env, tokenMatch[1]), request);
      }
      if (tokenMatch && method === 'DELETE') {
        return addCors(await handleMcpDisconnect(request, env, tokenMatch[1]), request);
      }

      return addCors(err('not_found', 404, { path: pathname }), request);
    } catch (e) {
      return addCors(err('internal_error', 500, { message: String(e) }), request);
    }
  },
};
