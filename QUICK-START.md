# Quick Start — 30 分鐘啟動指南

預計需時：**30 分鐘**（不含 Cloudflare 帳號註冊）

---

## 📋 前置條件檢核

開課前請學員自行完成以下所有項目：

- [ ] 已註冊 [Cloudflare 帳號](https://dash.cloudflare.com)（免費版即可，需信用卡驗證）
- [ ] Node.js **18 以上** (`node -v` 確認)
- [ ] 已安裝 Wrangler CLI：`npm i -g wrangler`
- [ ] 已執行 `wrangler login` 並完成瀏覽器授權
- [ ] 已有一組 LLM API Key（建議 [Anthropic Console](https://console.anthropic.com) 申請，免費額度足夠課堂使用）
- [ ] 已 `git clone` 本 repo 並 `npm install`

---

## Step 1｜建立 Cloudflare AI Gateway（3 min）

1. 進入 Dashboard → **AI** → **AI Gateway**
2. 點 **Create Gateway**，名稱填 `aigw-course`
3. 建立後記下 **Gateway ID**（在 URL 裡：`/ai/aigw-course/...`）
4. 點 **API Keys** → 建立一個 Gateway Token，記下完整字串

---

## Step 2｜設定 BYOK Alias（3 min）

> BYOK = Bring Your Own Key。讓 AI Gateway 幫你保管真正的 provider API key，
> Worker 只需透過 alias 名稱呼叫，金鑰不會出現在程式碼或請求 header 中。

1. AI Gateway 頁面 → **API Key Management**
2. 點 **Add API Key**：
   - Provider：`Anthropic`
   - Alias：`claude_demo`
   - API Key：貼上你的 Anthropic API Key
3. 儲存

---

## Step 3｜建立 D1 + KV（5 min）

```bash
cd worker

# D1 資料庫
wrangler d1 create aigw-course-db
# ↑ 輸出會包含一行 database_id = "xxx-xxx"，等下要貼到 wrangler.toml

# KV namespaces
wrangler kv namespace create SESSIONS
wrangler kv namespace create RATE_LIMITS
# ↑ 各會輸出一行 id = "xxxx"
```

---

## Step 4｜設定 wrangler.toml（5 min）

```bash
cp wrangler.toml.example wrangler.toml
# 編輯 wrangler.toml，填入上面 3 個 ID + 你的 CF Account ID + AI Gateway ID
```

設定 Secrets：

```bash
wrangler secret put JWT_SECRET
# 貼上隨機長字串，例如：openssl rand -hex 32 產生的結果

wrangler secret put CF_AI_GATEWAY_TOKEN
# 貼上 Step 1 取得的 Gateway Token
```

---

## Step 5｜初始化 D1 Schema（1 min）

```bash
npm run db:init
# 等同：wrangler d1 execute aigw-course-db --remote --file=../schema/schema.sql
```

---

## Step 6｜部署 Worker（2 min）

```bash
npm run deploy
# 部署後會輸出網址，例如：https://aigw-course-api.<你的名字>.workers.dev
```

測試：
```bash
curl https://aigw-course-api.<你的名字>.workers.dev/health
# 應該回 "OK"
```

---

## Step 7｜部署前端（5 min）

```bash
cd ../frontend
npm install

# 設定 API base URL
echo "VITE_API_BASE=https://aigw-course-api.<你的名字>.workers.dev" > .env

npm run build
npm run deploy
# 第一次部署會問你建立 project name，輸入 aigw-course
```

部署後前端網址：`https://aigw-course.pages.dev`

---

## Step 8｜實際試跑（5 min）

1. 開啟 `https://aigw-course.pages.dev`
2. 註冊新帳號（任意 email + 8 字元以上密碼）
3. 登入後到 **Chat** 頁，輸入：「你好，請自我介紹」
4. 看到 AI 回覆後，到 Cloudflare Dashboard → AI Gateway → **Logs**，
   應該能看到剛剛的請求紀錄、token 用量、回應時間。

---

## Step 9｜連接 MCP 工具（選擇性，5 min）

預設已配置好 `cloudflare-docs` + `radar` 兩個 MCP server（在 wrangler.toml）。

1. 重新部署 Worker：`npm run deploy`
2. 前端 → **MCP 工具管理**，按 **查看工具清單**
3. 回 Chat 頁問：「幫我查 Cloudflare R2 的最新功能文件」
4. AI 會自動呼叫 `cloudflare-docs__search_docs` 工具回答

---

## ❓ 常見問題

**Q: 跑 `wrangler deploy` 卡很久？**
A: 第一次部署需上傳 binding 設定，10–30 秒正常。

**Q: 回應出現 `aigw_error`？**
A: 檢查 `CF_AI_GATEWAY_TOKEN` 和 BYOK alias 名稱是否正確（區分大小寫）。

**Q: 註冊一直失敗？**
A: 確認 D1 schema 已執行（`npm run db:init`）；本地測試可改用 `npm run db:init:local`。

**Q: 想看 Worker log？**
A: `npm run tail`，即時看到所有請求。

---

詳細課程議程見 [COURSE-OUTLINE.md](./COURSE-OUTLINE.md)。
