import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { ChatPage } from './pages/chat/ChatPage';
import { McpManagerPage } from './pages/mcp/McpManagerPage';
import { LoginPage } from './pages/LoginPage';
import './styles.css';

function App() {
  const token = localStorage.getItem('access_token');
  return (
    <BrowserRouter>
      <nav style={{ padding: 12, background: '#1E5BC6', color: '#fff', display: 'flex', gap: 16 }}>
        <strong>樂雲 AIGW Course</strong>
        {token && <>
          <Link to="/chat" style={{ color: '#fff' }}>Chat</Link>
          <Link to="/mcp" style={{ color: '#fff' }}>MCP 工具管理</Link>
          <button onClick={() => { localStorage.clear(); location.href = '/login'; }} style={{ marginLeft: 'auto' }}>Logout</button>
        </>}
      </nav>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/chat" element={token ? <ChatPage /> : <Navigate to="/login" />} />
        <Route path="/mcp" element={token ? <McpManagerPage /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to={token ? '/chat' : '/login'} />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
