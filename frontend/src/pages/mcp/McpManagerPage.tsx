import { useEffect, useState } from 'react';
import { api } from '../../api';

interface Server { id: string; name: string; icon: string; desc: string; requiresOAuth: boolean; connected: boolean; }
interface Tool { name: string; description: string; }

export function McpManagerPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [tools, setTools] = useState<Record<string, Tool[]>>({});
  const [tokenInputs, setTokenInputs] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    try { const r = await api.listMcpServers(); setServers(r.servers); }
    catch (e) { setErr(String(e)); }
  }

  async function listTools(id: string) {
    setBusy(id); setErr('');
    try { const r = await api.listMcpTools(id); setTools(t => ({ ...t, [id]: r.tools })); }
    catch (e) { setErr(String(e)); }
    finally { setBusy(null); }
  }

  async function saveToken(id: string) {
    const token = tokenInputs[id]?.trim();
    if (!token) return;
    setBusy(id); setErr('');
    try {
      await api.saveMcpToken(id, token);
      setTokenInputs(t => ({ ...t, [id]: '' }));
      await load();
    } catch (e) { setErr(String(e)); }
    finally { setBusy(null); }
  }

  async function disconnect(id: string) {
    setBusy(id); setErr('');
    try { await api.disconnectMcp(id); setTools(t => ({ ...t, [id]: [] })); await load(); }
    catch (e) { setErr(String(e)); }
    finally { setBusy(null); }
  }

  return (
    <div className="container">
      <h2>MCP 工具管理（Openclaw）</h2>
      <p style={{ color: '#6b7280', fontSize: 13 }}>
        在 worker 的 <code>MCP_SERVER_URLS</code> 設定 server 清單；連線後該 server 的工具會自動暴露給 AI 使用。
      </p>
      {err && <div className="error">{err}</div>}
      {servers.length === 0 && <div className="card">尚未設定任何 MCP server（請在 wrangler.toml 設定 MCP_SERVER_URLS）</div>}

      {servers.map(s => (
        <div key={s.id} className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <strong>{s.name}</strong> <code style={{ color: '#6b7280', fontSize: 12 }}>{s.id}</code>
              <div style={{ fontSize: 13, color: '#374151' }}>{s.desc}</div>
            </div>
            <span className={s.connected ? 'badge-on' : 'badge-off'}>
              {s.connected ? '● 已連線' : '○ 未連線'}
            </span>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {s.requiresOAuth && !s.connected && (
              <>
                <input style={{ flex: 1, minWidth: 240 }} placeholder="輸入該 server 的 OAuth Bearer token"
                       value={tokenInputs[s.id] ?? ''} onChange={e => setTokenInputs(t => ({ ...t, [s.id]: e.target.value }))} />
                <button onClick={() => saveToken(s.id)} disabled={busy === s.id}>儲存 Token</button>
              </>
            )}
            {s.connected && (
              <>
                <button onClick={() => listTools(s.id)} disabled={busy === s.id}>查看工具清單</button>
                {s.requiresOAuth && <button onClick={() => disconnect(s.id)} disabled={busy === s.id} style={{ background: '#dc2626' }}>中斷連線</button>}
              </>
            )}
          </div>

          {tools[s.id] && (
            <ul style={{ marginTop: 12, fontSize: 13, paddingLeft: 20 }}>
              {tools[s.id].map(t => (
                <li key={t.name}><code>{t.name}</code> — {t.description}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
