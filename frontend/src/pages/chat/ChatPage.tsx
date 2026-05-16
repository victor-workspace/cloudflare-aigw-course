import { useEffect, useState, useRef } from 'react';
import { api } from '../../api';

interface Msg { id: string; role: string; content: string; total_tokens?: number; }
interface Conv { id: string; title: string; updated_at: number; }

export function ChatPage() {
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void loadConvs(); }, []);
  useEffect(() => { if (activeId) void loadMessages(activeId); else setMessages([]); }, [activeId]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); }, [messages]);

  async function loadConvs() {
    try { const r = await api.listConversations(); setConversations(r.conversations); }
    catch (e) { setErr(String(e)); }
  }
  async function loadMessages(id: string) {
    try { const r = await api.getMessages(id); setMessages(r.messages); }
    catch (e) { setErr(String(e)); }
  }

  async function send() {
    if (!input.trim() || busy) return;
    const userMsg: Msg = { id: 'tmp', role: 'user', content: input };
    setMessages(m => [...m, userMsg]);
    const msg = input;
    setInput(''); setBusy(true); setErr('');
    try {
      const r = await api.sendMessage(msg, activeId ?? undefined);
      setActiveId(r.conversationId);
      setMessages(m => [...m, { id: 'tmp2', role: 'assistant', content: r.reply, total_tokens: r.totalTokens }]);
      void loadConvs();
    } catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 50px)' }}>
      {/* 對話側欄 */}
      <aside style={{ width: 220, background: '#fff', borderRight: '1px solid #e5e7eb', padding: 12, overflowY: 'auto' }}>
        <button style={{ width: '100%', marginBottom: 10 }} onClick={() => { setActiveId(null); setMessages([]); }}>+ 新對話</button>
        <div className="chat-list">
          {conversations.map(c => (
            <div key={c.id} onClick={() => setActiveId(c.id)}
                 style={{ padding: 8, borderRadius: 6, cursor: 'pointer', background: c.id === activeId ? '#DBEAFE' : 'transparent', fontSize: 13 }}>
              {c.title || '（無標題）'}
            </div>
          ))}
        </div>
      </aside>

      {/* 對話內容 */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column' }}>
          {messages.length === 0 && (
            <div style={{ color: '#6b7280', textAlign: 'center', marginTop: 80 }}>
              開始一段新對話 — 可在「MCP 工具管理」連接外部工具讓 AI 自動呼叫
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className={m.role === 'user' ? 'msg-user' : 'msg-assistant'}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              {m.total_tokens ? <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{m.total_tokens} tokens</div> : null}
            </div>
          ))}
          {busy && <div className="msg-assistant" style={{ color: '#6b7280' }}>思考中…</div>}
        </div>

        {err && <div className="error" style={{ margin: 10 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #e5e7eb', background: '#fff' }}>
          <textarea style={{ flex: 1, resize: 'none', height: 60 }} placeholder="輸入訊息（Enter 送出 / Shift+Enter 換行）"
                    value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <button onClick={send} disabled={busy}>送出</button>
        </div>
      </main>
    </div>
  );
}
