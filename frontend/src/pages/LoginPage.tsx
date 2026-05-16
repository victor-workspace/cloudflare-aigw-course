import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      if (mode === 'register') {
        await api.register(email, password, name);
        setMode('login');
        setErr('註冊成功，請登入');
      } else {
        const r = await api.login(email, password);
        localStorage.setItem('access_token', r.accessToken);
        localStorage.setItem('refresh_token', r.refreshToken);
        localStorage.setItem('user_email', r.user.email);
        nav('/chat');
      }
    } catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h2>{mode === 'login' ? '登入' : '註冊'}</h2>
      <form onSubmit={submit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mode === 'register' && (
          <input placeholder="姓名（可選）" value={name} onChange={e => setName(e.target.value)} />
        )}
        <input placeholder="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder="password (至少 8 字元)" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
        {err && <div className="error">{err}</div>}
        <button disabled={busy}>{busy ? '處理中…' : mode === 'login' ? '登入' : '註冊'}</button>
        <a onClick={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ cursor: 'pointer', color: '#1E5BC6', textAlign: 'center' }}>
          {mode === 'login' ? '沒有帳號？點此註冊' : '已有帳號？回登入'}
        </a>
      </form>
    </div>
  );
}
