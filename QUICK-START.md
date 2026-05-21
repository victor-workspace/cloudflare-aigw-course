# Quick Start — 30 分鐘啟動指南

預計需時：**30 分鐘**（不含 Cloudflare 帳號註冊）

---

## 📋 前置條件檢核

開課前請學員自行完成下列**全部**項目。建議至少課前 24 小時完成，遇到問題可在群組提問。

### 一、作業系統與終端機

| ✓ | 項目 | 說明 |
|---|------|------|
| ☐ | OS：macOS / Windows / Linux | 任一可。Windows 強烈建議搭配 [WSL2 Ubuntu](https://learn.microsoft.com/zh-tw/windows/wsl/install) |
| ☐ | 熟悉 Terminal 基本操作 | `cd` / `ls` / `git` / `npm` 指令會用 |

### 二、核心開發工具（含下載連結）

| ✓ | 工具 | 用途 | 下載 / 安裝 |
|---|------|------|-------------|
| ☐ | **Git** | 版本控制 + clone repo | [git-scm.com/downloads](https://git-scm.com/downloads) ・ macOS：`xcode-select --install` ・ Ubuntu：`sudo apt install git` |
| ☐ | **Node.js 18+** | JavaScript 執行環境（含 npm） | [nodejs.org/zh-tw/download](https://nodejs.org/zh-tw/download) ・ 建議用 [nvm](https://github.com/nvm-sh/nvm) 管理版本 |
| ☐ | **Wrangler CLI** | Cloudflare Worker 部署工具 | `npm i -g wrangler`（[官方文件](https://developers.cloudflare.com/workers/wrangler/install-and-update/)） |
| ☐ | **VS Code**（建議） | 程式編輯器 | [code.visualstudio.com](https://code.visualstudio.com/) ・ 建議套件：ESLint / TypeScript / Tailwind |

驗證指令：
```bash
git --version       # 期望：git version 2.x 或以上
node --version      # 期望：v18.x 以上
npm --version       # 期望：9.x 以上
wrangler --version  # 期望：3.x 以上
```

### 三、雲端帳號與 API Key

| ✓ | 服務 | 用途 | 申請 / 設定 |
|---|------|------|-------------|
| ☐ | **Cloudflare 帳號** | 部署 Worker / Pages / D1 / KV | [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) ・ 免費版即可，需信用卡驗證 |
| ☐ | **Wrangler 登入** | 授權 CLI 操作 CF 資源 | `wrangler login` → 瀏覽器完成授權 |
| ☐ | **Anthropic API Key** | LLM 推論（Claude 系列） | [console.anthropic.com](https://console.anthropic.com/) ・ 註冊送 $5 免費額度足夠課堂 |
| ☐ | **GitHub 帳號** | clone repo / 課後 PR 貢獻 | [github.com/join](https://github.com/join) |

### 四、Repo 準備

開課前請執行：

```bash
# 1. 取得程式碼
git clone https://github.com/victor80122/cloudflare-aigw-course.git
cd cloudflare-aigw-course

# 2. 安裝 worker 端依賴
cd worker && npm install

# 3. 安裝 frontend 端依賴
cd ../frontend && npm install

# 4. 確認 Wrangler 已登入
wrangler whoami     # 期望：顯示你的 CF 帳號 email
```

### 五、課前自測（5 分鐘）

最後跑一次健診：

```bash
cd ../worker

# 先建立基本配置檔（詳細 ID 填寫在課堂完成）
cp wrangler.toml.example wrangler.toml

# 測試啟動（會有 binding 警告是正常的，因為還沒建立 D1/KV）
wrangler dev --local      
# 預期：localhost:8787 起來，看到 "Ready on http://localhost:8787"
# D1/KV binding 警告可以忽略，課堂上會設定

# 開另一個 terminal 測試（可選）
# curl http://localhost:8787/health
# 預期回應：可能會因為 DB binding 缺失而報錯，這是正常的
```

> ⚠️ **重要**：此階段只確認 wrangler 能正常啟動即可。D1/KV/Secrets 等完整設定會在課堂上的 Step 3-4 完成。

如果以上五步全部 ✓，課堂上就能無痛跟著做。任何步驟卡住請在群組提問，講師與助教會儘速回覆。

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

> 💡 如果課前自測已建立 wrangler.toml，跳過複製步驟，直接編輯即可。

```bash
# 如果還沒建立，先複製範本
[ ! -f wrangler.toml ] && cp wrangler.toml.example wrangler.toml

# 用編輯器打開 wrangler.toml（VS Code / vim / nano 皆可）
code wrangler.toml   # 或 vim wrangler.toml

# 填入以下 5 個值：
# 1. CF_ACCOUNT_ID          → 你的 Cloudflare Account ID（Dashboard 右側可看到）
# 2. CF_AI_GATEWAY_ID       → Step 1 建立的 Gateway ID（例如：aigw-course）
# 3. database_id            → Step 3 建立 D1 時輸出的 ID
# 4. SESSIONS 的 id         → Step 3 建立 KV namespace 時輸出的第一個 ID
# 5. RATE_LIMITS 的 id      → Step 3 建立 KV namespace 時輸出的第二個 ID
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
