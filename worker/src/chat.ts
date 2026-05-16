// ============================================================
// AI Chat — 透過 Cloudflare AI Gateway BYOK 呼叫 Anthropic
// 支援 MCP 工具呼叫（agentic tool calling loop）
// ============================================================

import { Env, DEFAULT_MODEL, MAX_MESSAGE_LENGTH } from './types';
import { generateId, ok, err, nowSec } from './utils';
import { requireAuth, isAuthError } from './middleware';
import { getServerConfigs } from './mcp';
import { mcpListTools, mcpCallTool, McpTool } from './mcp-client';

// ── AI Gateway URL ──────────────────────────────────────────
function aigwUrl(env: Env, provider: 'anthropic' | 'openai'): string {
  return `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_AI_GATEWAY_ID}/${provider}/v1/messages`;
}

// ── BYOK headers ────────────────────────────────────────────
// CF AI Gateway BYOK: cf-aig-authorization + cf-aig-byok-alias
// 真正的 provider API key 由 Gateway 後端依 alias 注入，不會出現在 worker 端
function anthropicHeaders(env: Env): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'cf-aig-authorization': `Bearer ${env.CF_AI_GATEWAY_TOKEN}`,
    'cf-aig-byok-alias': env.ANTHROPIC_BYOK_ALIAS ?? 'claude_demo',
    'anthropic-version': '2023-06-01',
  };
}

// ── MCP tools schema → Anthropic tool_use 格式 ─────────────
interface AnthTool {
  name: string;
  description: string;
  input_schema: McpTool['inputSchema'];
}

async function loadMcpTools(env: Env, userId: string): Promise<{
  tools: AnthTool[];
  routing: Record<string, { url: string; token?: string; mcpName: string }>;
}> {
  const configs = getServerConfigs(env);
  const tools: AnthTool[] = [];
  const routing: Record<string, { url: string; token?: string; mcpName: string }> = {};

  for (const cfg of configs) {
    const token = cfg.requiresOAuth
      ? (await env.SESSIONS.get(`mcp_token:${userId}:${cfg.id}`)) ?? undefined
      : undefined;
    if (cfg.requiresOAuth && !token) continue;

    let serverTools: McpTool[] = [];
    try {
      serverTools = await mcpListTools(cfg.url, token);
    } catch { continue; }

    for (const t of serverTools) {
      // Claude tool name 規範：英數 + 底線，最長 64
      const aliased = `${cfg.id.replace(/[^a-zA-Z0-9]/g, '_')}__${t.name}`.slice(0, 64);
      tools.push({
        name: aliased,
        description: `[${cfg.name}] ${t.description}`,
        input_schema: t.inputSchema,
      });
      routing[aliased] = { url: cfg.url, token, mcpName: t.name };
    }
  }
  return { tools, routing };
}

// ── POST /api/chat/send ─────────────────────────────────────
// body: { message: string, conversationId?: string, model?: string }
export async function handleSendMessage(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) return auth;

  let body: { message?: string; conversationId?: string; model?: string };
  try { body = await request.json(); } catch { return err('invalid_request', 400); }

  const { message, model } = body;
  if (!message) return err('invalid_request', 400, { message: 'message 必填' });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return err('message_too_long', 413, { message: `訊息上限 ${MAX_MESSAGE_LENGTH} 字元` });
  }

  // 取得或建立對話
  let convId = body.conversationId;
  if (!convId) {
    convId = generateId('conv');
    await env.DB.prepare(
      `INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)`,
    ).bind(convId, auth.userId, message.slice(0, 60)).run();
  }

  // 寫入使用者訊息
  await env.DB.prepare(
    `INSERT INTO chat_messages (id, conversation_id, user_id, role, content) VALUES (?, ?, ?, 'user', ?)`,
  ).bind(generateId('msg'), convId, auth.userId, message).run();

  // 抓對話歷史（最多最近 10 則）
  const history = await env.DB.prepare(
    `SELECT role, content FROM chat_messages
      WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 20`,
  ).bind(convId).all<{ role: string; content: string }>();

  // 載入 MCP 工具
  const { tools, routing } = await loadMcpTools(env, auth.userId);

  // 組 Anthropic messages
  const messages: Array<{ role: 'user' | 'assistant'; content: unknown }> = (history.results ?? [])
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // Agentic tool-calling loop（最多 5 輪）
  const useModel = model ?? DEFAULT_MODEL;
  let totalTokens = 0;
  let finalText = '';

  for (let turn = 0; turn < 5; turn++) {
    const reqBody = {
      model: useModel,
      max_tokens: 2048,
      messages,
      ...(tools.length > 0 ? { tools } : {}),
    };

    const res = await fetch(aigwUrl(env, 'anthropic'), {
      method: 'POST',
      headers: anthropicHeaders(env),
      body: JSON.stringify(reqBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      return err('aigw_error', 502, { status: res.status, body: errText.slice(0, 500) });
    }

    const data = await res.json() as {
      content: Array<{ type: 'text' | 'tool_use'; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      usage?: { input_tokens: number; output_tokens: number };
      stop_reason?: string;
    };

    totalTokens += (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

    // 將 assistant 回應加入訊息陣列
    messages.push({ role: 'assistant', content: data.content });

    // 收集 tool_use
    const toolUses = data.content.filter(c => c.type === 'tool_use');
    const textParts = data.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('\n');
    if (textParts) finalText = textParts;

    // 無工具呼叫 → 結束
    if (toolUses.length === 0 || data.stop_reason !== 'tool_use') break;

    // 執行所有工具
    const toolResults = await Promise.all(toolUses.map(async (tu) => {
      const route = routing[tu.name ?? ''];
      if (!route) return { type: 'tool_result', tool_use_id: tu.id, content: `未知工具：${tu.name}`, is_error: true };
      try {
        const result = await mcpCallTool(route.url, route.mcpName, (tu.input ?? {}) as Record<string, unknown>, route.token);
        return { type: 'tool_result', tool_use_id: tu.id, content: result || '(無內容)' };
      } catch (e) {
        return { type: 'tool_result', tool_use_id: tu.id, content: `工具錯誤：${String(e)}`, is_error: true };
      }
    }));

    messages.push({ role: 'user', content: toolResults });
  }

  // 寫入 assistant 訊息
  await env.DB.prepare(
    `INSERT INTO chat_messages (id, conversation_id, user_id, role, content, model, total_tokens)
     VALUES (?, ?, ?, 'assistant', ?, ?, ?)`,
  ).bind(generateId('msg'), convId, auth.userId, finalText, useModel, totalTokens).run();

  // 更新對話時間戳
  await env.DB.prepare(
    `UPDATE conversations SET updated_at = ? WHERE id = ?`,
  ).bind(nowSec(), convId).run();

  return ok({
    conversationId: convId,
    reply: finalText,
    model: useModel,
    totalTokens,
  });
}

// ── GET /api/chat/history?conversationId=xxx ────────────────
export async function handleGetHistory(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) return auth;

  const url = new URL(request.url);
  const convId = url.searchParams.get('conversationId');

  if (!convId) {
    // 列出該使用者所有對話
    const rows = await env.DB.prepare(
      `SELECT id, title, created_at, updated_at FROM conversations
        WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`,
    ).bind(auth.userId).all();
    return ok({ conversations: rows.results ?? [] });
  }

  // 取得特定對話的訊息
  const messages = await env.DB.prepare(
    `SELECT id, role, content, model, total_tokens, created_at
       FROM chat_messages WHERE conversation_id = ? AND user_id = ?
      ORDER BY created_at ASC`,
  ).bind(convId, auth.userId).all();

  return ok({ conversationId: convId, messages: messages.results ?? [] });
}

// ── DELETE /api/chat/conversation/:id ───────────────────────
export async function handleDeleteConversation(request: Request, env: Env, convId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (isAuthError(auth)) return auth;

  // ON DELETE CASCADE 會自動刪掉 chat_messages
  const result = await env.DB.prepare(
    `DELETE FROM conversations WHERE id = ? AND user_id = ?`,
  ).bind(convId, auth.userId).run();

  return ok({ deleted: result.meta.changes });
}
