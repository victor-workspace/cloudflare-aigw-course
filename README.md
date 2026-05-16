# Cloudflare AI Gateway Course

> **2 小時 Workshop · 15 學員 · 樂雲智能 LEYUN**
>
> 從 0 開始打造一個跑在 Cloudflare Workers 上的 AI 對話助理，
> 透過 AI Gateway 統一治理 51+ LLM 模型，並用 MCP 協議整合外部工具。

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Cloudflare%20Workers-orange)
![Language](https://img.shields.io/badge/lang-TypeScript-blue)

---

## 📚 課程簡介

本專案是 **樂雲智能 LEYUN** 內訓 / 公開課使用的教材，
精簡自 `chatagentbot` 商用實作（已上線於 `chat.winerjee.com`），
保留兩個核心模組供學員理解 Cloudflare AI Gateway 的全鏈路：

| 模組 | 說明 |
|------|------|
| **AI 對話助理** | JWT 認證 + Cloudflare AI Gateway BYOK + Tool calling agentic loop |
| **MCP 工具管理** | 連接外部 MCP server（Cloudflare Docs / Radar / Observability 等），讓 AI 自動呼叫遠端工具 |

---

## 🗂 專案結構

```
cloudflare-aigw-course/
├── worker/                    Cloudflare Worker（TypeScript）
│   ├── src/
│   │   ├── index.ts           路由分派
│   │   ├── types.ts           型別與常數
│   │   ├── utils.ts           JWT / 密碼 / ID helper
│   │   ├── middleware.ts      CORS / JWT auth / rate limit
│   │   ├── auth.ts            register / login / logout / refresh
│   │   ├── chat.ts            ★ AI Gateway BYOK + MCP tool calling
│   │   ├── mcp.ts             ★ MCP server 管理 API
│   │   └── mcp-client.ts      MCP HTTP / JSON-RPC client
│   └── wrangler.toml.example
│
├── frontend/                  React 18 + Vite（部署到 Cloudflare Pages）
│   └── src/pages/
│       ├── LoginPage.tsx
│       ├── chat/ChatPage.tsx
│       └── mcp/McpManagerPage.tsx
│
├── schema/schema.sql          D1 SQLite 4 張表
├── slides/                    課程簡報
│   ├── leyun-intro.pptx       樂雲公司簡介（15 min）
│   └── aigw-course.pptx       AI Gateway 概論 + 實作架構（90 min）
├── docs/
│   └── cheatsheet.md          wrangler 速查表
├── COURSE-OUTLINE.md          完整 2 小時議程
├── QUICK-START.md             30 分鐘啟動指南
└── .env.example
```

---

## 🚀 30 秒看懂架構

```
   學員瀏覽器
        │
        ▼
┌─────────────────────────────────────┐
│  Cloudflare Pages (frontend)        │  React Chat UI + MCP Manager
└──────────────┬──────────────────────┘
               │ fetch + JWT
               ▼
┌─────────────────────────────────────┐
│  Cloudflare Worker (aigw-course-api)│  index.ts 11 條路由
│  ├─ auth   → D1 + KV                │
│  ├─ chat   → AI Gateway BYOK ───────┼────► Anthropic / OpenAI
│  └─ mcp    → MCP Client (JSON-RPC) ─┼────► Cloudflare Docs MCP
└─────────────────────────────────────┘     Cloudflare Radar MCP
       │ D1 SQLite           │ KV         任何 MCP 相容 server
       ▼                     ▼
   users / conversations  sessions
   chat_messages          rate_limits
```

---

## ✅ 開始上手

| 路徑 | 適合對象 |
|------|---------|
| [QUICK-START.md](./QUICK-START.md) | 想 30 分鐘跑起來 |
| [COURSE-OUTLINE.md](./COURSE-OUTLINE.md) | 想看完整 2 小時 workshop 議程 |
| [docs/cheatsheet.md](./docs/cheatsheet.md) | wrangler / d1 / kv 指令速查 |

---

## 🛡 License

MIT — 歡迎自由衍生用於教學、商用、改寫。
請在衍生作品保留版權聲明。

---

## 🏢 關於樂雲智能

**樂雲智能 LEYUN** 是台灣唯一 **Cloudflare Powered+** 核心合作夥伴，
通過 ISO 27001 認證，提供企業級資安、雲端服務與 AI Gateway 整合方案。

- 🌐 [www.leyun.cloud](https://www.leyun.cloud)
- ☎️ +886-2-77220055
- ✉️ service@leyun.cloud
