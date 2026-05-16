// ============================================================
// MCP (Model Context Protocol) HTTP/JSON-RPC client
// 支援 streamable HTTP POST 與 SSE 兩種回應格式
// ============================================================

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface McpCallResult {
  content: Array<{ type: 'text' | 'image' | 'resource'; text?: string }>;
  isError?: boolean;
}

const MCP_TIMEOUT_MS = 20_000;

async function mcpRequest(
  serverUrl: string, method: string, params: unknown, id: number, token?: string,
): Promise<unknown> {
  const base = serverUrl.replace(/\/$/, '');
  const endpoint = base.endsWith('/mcp') ? base : `${base}/mcp`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} from ${endpoint}`);

    const ct = res.headers.get('Content-Type') ?? '';
    const text = await res.text();

    // SSE 包裝：抽取第一個 data: 行
    if (ct.includes('text/event-stream') || text.trimStart().startsWith('event:') || text.trimStart().startsWith('data:')) {
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          return JSON.parse(trimmed.slice(5).trim());
        }
      }
      throw new Error('No data line in SSE response');
    }

    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

type RpcResponse = {
  result?: unknown;
  error?: { code: number; message: string };
};

function unwrap<T>(raw: unknown): T {
  const r = raw as RpcResponse;
  if (r?.error) throw new Error(r.error.message);
  return r?.result as T;
}

export async function mcpListTools(serverUrl: string, token?: string): Promise<McpTool[]> {
  // initialize — 有些 server 必要，失敗忽略
  try {
    await mcpRequest(serverUrl, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'aigw-course', version: '1.0' },
    }, 1, token);
  } catch { /* 某些 server 不需要 initialize */ }

  const raw = await mcpRequest(serverUrl, 'tools/list', {}, 2, token);
  const result = unwrap<{ tools: McpTool[] }>(raw);
  return result?.tools ?? [];
}

export async function mcpCallTool(
  serverUrl: string, toolName: string, args: Record<string, unknown>, token?: string,
): Promise<string> {
  const raw = await mcpRequest(serverUrl, 'tools/call', { name: toolName, arguments: args }, 3, token);
  const result = unwrap<McpCallResult>(raw);
  if (!result) return '';
  if (result.isError) throw new Error(result.content.map(c => c.text).join(''));
  return result.content
    .filter(c => c.type === 'text')
    .map(c => c.text ?? '')
    .join('\n')
    .slice(0, 6000);
}
