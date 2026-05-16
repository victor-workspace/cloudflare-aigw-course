# 課程議程 — Cloudflare AI Gateway 實戰

> **2 小時 Workshop · 15 學員 · 樂雲智能 LEYUN**

---

## 🎯 學習目標

完成本課程後，學員能夠：

1. 理解 **Cloudflare AI Gateway** 的角色（為什麼不是直接呼叫 OpenAI 就好）
2. 用 **BYOK** 模式統一管理 LLM API Key 與用量追蹤
3. 設計一個包含 **JWT 認證 + AI 對話 + MCP 工具** 的完整 Worker 應用
4. 在 2 小時內把專案部署到自己的 Cloudflare 帳號
5. 知道延伸方向（RAG / 多租戶 / 串接 Telegram / 加強治理）

---

## ⏱ 時間表

| 時段 | 時長 | 主題 | 講師形式 |
|------|------|------|---------|
| 00:00–00:15 | 15 min | **樂雲智能公司簡介** | 簡報 |
| 00:15–00:30 | 15 min | **Cloudflare AI Gateway 概論** | 簡報 + Live Demo |
| 00:30–00:55 | 25 min | **實作專案架構導覽** | Code Walk |
| 00:55–01:00 | 5 min | 中場休息 | — |
| 01:00–01:45 | 45 min | **動手實作：5 分鐘啟動你的 AI Bot** | Hands-on |
| 01:45–02:00 | 15 min | **Q&A + 延伸方向 + 樂雲商用方案** | 互動 |

---

## 📘 Segment 1｜樂雲智能公司簡介（15 min）

**講者：Victor Lin**

```
1.1 樂雲智能 LEYUN 是誰
    ├─ 成立背景：台灣唯一 Cloudflare Powered+ 核心合作夥伴
    ├─ 認證：ISO 27001 / 履約保證簽署
    └─ 服務理念：To empower enterprises to do business globally without any risk.

1.2 樂雲三大解決方案 Program
    ├─ Program 1 — SASE / Zero Trust（新竹物流、中美矽晶案例）
    ├─ Program 2 — AI Security（鈊象電子、雄獅旅遊案例）
    └─ Program 3 — ARR / MSSP 訂閱型服務（和雲行動 $5,450/月）

1.3 為什麼樂雲選擇 Cloudflare AI Gateway
    ├─ 邊緣運算：300+ PoP，台灣 <5ms
    ├─ 51 模型統一治理：Anthropic / OpenAI / Google / Mistral / Workers AI
    └─ 完整稽核：cost / token / latency / guardrails 一站到位
```

---

## 📗 Segment 2｜Cloudflare AI Gateway 概論（15 min）

```
2.1 三大企業 AI 痛點
    ├─ AI 工具使用無稽核 → 設計圖、BOM 表外洩
    ├─ 多個 provider 帳單散亂 → 成本失控
    └─ 沒有 guardrails → PII 個資直接送進 LLM

2.2 AI Gateway 核心能力
    ├─ BYOK 統一入口（cf-aig-authorization + cf-aig-byok-alias）
    ├─ Policy Engine + Guardrails
    ├─ Token 用量追蹤 + 成本分攤
    └─ Cache + Logging（90 天保留）

2.3 講師線上 Demo
    └─ chat.winerjee.com 實機展示（樂雲商用實作）
```

---

## 📙 Segment 3｜實作專案架構導覽（25 min）

```
3.1 整體架構：1 Worker + D1 + KV + AI Gateway
    └─ 看 README 的 ASCII 架構圖

3.2 程式碼結構走讀（8 支 src）
    ├─ index.ts        — 路由分派（11 條路由）
    ├─ types.ts        — Env 介面：宣告 D1 / KV / Secret bindings
    ├─ utils.ts        — JWT（HMAC-SHA256） + PBKDF2 密碼
    ├─ middleware.ts   — CORS / requireAuth / rateLimit
    ├─ auth.ts         — register / login / refresh（含失敗計數）
    ├─ chat.ts ★      — AI Gateway BYOK + Agentic Tool Loop
    ├─ mcp.ts ★       — MCP server 設定管理 + KV token 儲存
    └─ mcp-client.ts   — JSON-RPC over HTTP + SSE 解析

3.3 D1 Schema：4 張表設計理念
    ├─ users           — daily_token_quota / status
    ├─ refresh_tokens  — JWT 輪換用，存 SHA-256 hash
    ├─ conversations   — 對話列表
    └─ chat_messages   — 訊息逐則（含 model / total_tokens）

3.4 前端兩個頁面
    ├─ ChatPage        — 對話 + 對話歷史側欄
    └─ McpManagerPage  — 工具列表 / token 設定 / 中斷連線

3.5 重點：BYOK 機制看清楚
    └─ chat.ts 第 23-30 行：anthropicHeaders()
       三個 header：cf-aig-authorization + cf-aig-byok-alias + anthropic-version
       provider API key 完全不出現！
```

---

## 🛠 Segment 4｜動手實作 45 min

**詳細步驟見 [QUICK-START.md](./QUICK-START.md)**

```
階段 A（10 min）— 環境啟動
  ├─ git clone <repo>
  ├─ npm install (worker + frontend)
  ├─ wrangler login（已預先做完）
  └─ wrangler d1 create / wrangler kv namespace create

階段 B（15 min）— 設定金鑰
  ├─ Dashboard 建立 AI Gateway → 拿 Gateway ID + Token
  ├─ 設定 BYOK alias（claude_demo → 真實 Anthropic key）
  ├─ 複製 wrangler.toml.example，填入 5 個 ID
  └─ wrangler secret put JWT_SECRET + CF_AI_GATEWAY_TOKEN

階段 C（15 min）— 部署 + 測試
  ├─ npm run db:init（執行 schema.sql）
  ├─ npm run deploy（Worker 上線）
  ├─ 前端 npm run build && npm run deploy（Pages 上線）
  ├─ 註冊 → 登入 → 對話測試
  └─ Dashboard 看 AI Gateway Logs

階段 D（5 min）— 接 MCP 工具
  ├─ 確認 MCP_SERVER_URLS 已設定（預設兩個）
  ├─ 前端「MCP 工具管理」→ 看工具清單
  └─ 對話試問「查 Cloudflare R2 文件」→ AI 自動呼叫
```

---

## 💬 Segment 5｜Q&A + 延伸（15 min）

```
5.1 常見問題
  ├─ Q: quota 超限怎麼辦？     → Anthropic 升級 tier / 換 BYOK 到其他 provider
  ├─ Q: API Key 安全嗎？        → BYOK 由 Gateway 後端注入，worker 端永遠看不到
  └─ Q: 多人共用 alias？        → 用 namespace 分隔，或一人一 alias

5.2 延伸方向（自學）
  ├─ 加 RAG → Vectorize index + @cf/baai/bge-base-en-v1.5
  ├─ 串 Telegram → 多開一個 worker 接 webhook
  ├─ 多租戶 → users.role / tenant_id
  ├─ 串流輸出 → fetch 改用 ReadableStream
  └─ Cron → wrangler.toml 加 [triggers] 排程

5.3 樂雲商用方案介紹（最後 5 min）
  ├─ Package A — AI 治理 NT$80-150 萬/年
  ├─ Package B — Zero Trust 整合 NT$400-600 萬/年
  └─ Package C — 旗艦資安平台 NT$800-1,200 萬/年
```

---

## 📦 學員帶走

- 一個完整可跑的 Cloudflare Worker 專案（自己的帳號上）
- 一個可重複部署的程式碼骨架（MIT 授權）
- 知道如何閱讀 AI Gateway 的 Logs / Analytics
- 樂雲商用方案聯絡窗口：service@leyun.cloud
