# Wrangler 速查表

## 登入與帳號

```bash
wrangler login                  # 開瀏覽器授權
wrangler whoami                 # 看目前登入身份
```

## D1 SQLite

```bash
wrangler d1 create <db-name>                              # 建立 DB
wrangler d1 list                                          # 列出所有 DB
wrangler d1 execute <db-name> --remote --file=schema.sql  # 執行 SQL 檔
wrangler d1 execute <db-name> --remote --command="SELECT COUNT(*) FROM users"
wrangler d1 execute <db-name> --local  --file=schema.sql  # 本地模擬
```

## KV Namespace

```bash
wrangler kv namespace create <NAME>     # 建立 namespace
wrangler kv namespace list              # 列出
wrangler kv key list --binding=SESSIONS # 列出某 namespace 的所有 key
wrangler kv key get --binding=SESSIONS "key-name"
wrangler kv key put --binding=SESSIONS "key-name" "value"
wrangler kv key delete --binding=SESSIONS "key-name"
```

## Secrets

```bash
wrangler secret put JWT_SECRET           # 互動輸入
wrangler secret list                     # 列出所有 secret 名稱（不顯示值）
wrangler secret delete JWT_SECRET
```

> 與 `[vars]` 的差別：`[vars]` 在 wrangler.toml 是明文，會被 git 看到；
> `secret` 是加密儲存，只能在 worker 執行階段被讀到。

## 部署

```bash
wrangler dev                    # 本地開發（http://localhost:8787）
wrangler deploy                 # 部署到 Cloudflare
wrangler deploy --dry-run       # 編譯但不上傳（檢查設定）
wrangler tail                   # 即時看 production log
wrangler tail --format=pretty   # 漂亮格式
```

## Pages

```bash
wrangler pages project list
wrangler pages deploy dist --project-name=aigw-course
```

## 常見問題排除

```bash
# 看 binding 設定是否正確
wrangler deploy --dry-run --outdir=./build

# 清掉本地快取（修改 wrangler.toml 後）
rm -rf .wrangler

# 看某次部署版本
wrangler deployments list

# 回滾上一版
wrangler rollback
```

## AI Gateway

```bash
# 直接 curl 測試 BYOK
curl https://gateway.ai.cloudflare.com/v1/<ACCOUNT_ID>/<GATEWAY_ID>/anthropic/v1/messages \
  -H "Content-Type: application/json" \
  -H "cf-aig-authorization: Bearer <GATEWAY_TOKEN>" \
  -H "cf-aig-byok-alias: claude_demo" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":100,"messages":[{"role":"user","content":"Hi"}]}'
```
