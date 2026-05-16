// ============================================================
// API client — 簡易封裝 fetch + JWT
// ============================================================

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';

async function request<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const json = await res.json() as { success: boolean; data?: T; error?: string; details?: { message?: string } };
  if (!json.success) throw new Error(json.details?.message ?? json.error ?? `HTTP ${res.status}`);
  return json.data as T;
}

export const api = {
  register: (email: string, password: string, name?: string) =>
    request<{ userId: string }>('/api/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string; name: string }; accessToken: string; refreshToken: string }>(
      '/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) },
    ),

  sendMessage: (message: string, conversationId?: string) =>
    request<{ conversationId: string; reply: string; model: string; totalTokens: number }>(
      '/api/chat/send', { method: 'POST', body: JSON.stringify({ message, conversationId }) },
    ),

  listConversations: () =>
    request<{ conversations: Array<{ id: string; title: string; updated_at: number }> }>('/api/chat/history'),

  getMessages: (conversationId: string) =>
    request<{ messages: Array<{ id: string; role: string; content: string; total_tokens: number }> }>(
      `/api/chat/history?conversationId=${conversationId}`,
    ),

  listMcpServers: () =>
    request<{ servers: Array<{ id: string; name: string; icon: string; desc: string; requiresOAuth: boolean; connected: boolean }> }>(
      '/api/mcp/servers',
    ),

  listMcpTools: (serverId: string) =>
    request<{ tools: Array<{ name: string; description: string }> }>(`/api/mcp/servers/${serverId}/tools`),

  saveMcpToken: (serverId: string, token: string) =>
    request(`/api/mcp/servers/${serverId}/token`, { method: 'POST', body: JSON.stringify({ token }) }),

  disconnectMcp: (serverId: string) =>
    request(`/api/mcp/servers/${serverId}/token`, { method: 'DELETE' }),
};
