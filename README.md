# 安全庫存計算系統 — 前端

純 HTML / CSS / JavaScript（ES modules），不需要建置步驟，部署為 Vercel 靜態網站。
後端 API 在 `safety-stock-automation`（Flask，部署於 Render）。

> 舊版 Next.js 前端（`src/`）仍在 repo 中，待功能對等確認後移除。

## 開發

```bash
bash scripts/install-hooks.sh   # 一次性：安裝 pre-commit
npm install                     # 只為了開發工具（TypeScript、ESLint、Playwright）；web/ 本身沒有相依套件
npm run web:dev                 # http://localhost:3000，需另外啟動後端 http://localhost:5000
```

| 指令                    | 用途                                           |
| ----------------------- | ---------------------------------------------- |
| `npm run web:dev`       | 本機靜態伺服器（含與正式環境相同的 CSP 標頭）  |
| `npm run web:typecheck` | JSDoc 型別檢查（`tsc --checkJs`，strict）      |
| `npm run web:test`      | 純邏輯單元測試（`node --test`）                |
| `npm run test:e2e`      | Playwright E2E（自動啟動前後端）               |

Pre-commit 會跑 prettier、eslint、tsc 與上述 web 檢查。

## 結構

```
web/
  index.html          頁面骨架與三個分頁區段
  config.js           API 網址（部署時由 scripts/write-config.mjs 依 SS_API_URL 產生）
  css/                tokens（顏色、間距、深色模式）→ base → layout → sections → results
  js/
    main.js           進入點：建立 store、掛載各區段
    api/              後端 API 客戶端與型別宣告（types.d.ts）
    state/            store（訂閱式狀態容器）與工作流程狀態、localStorage 保存
    utils/            DOM 建構、格式化、文字對照、結果表格的篩選排序分頁（純函式）
    components/       各區段元件；元件之間不互相呼叫，只透過 store 溝通
  tests/              node --test 單元測試
```

## 安全

- 所有來自資料的文字都以 text node 寫入；ESLint 禁止 `innerHTML` / `outerHTML` / `insertAdjacentHTML`
- `vercel.json` 設定 Content-Security-Policy：只允許本站腳本與樣式，API 只能連到 `*.onrender.com`

## 部署（Vercel）

`vercel.json` 已設定：不安裝套件、build 只產生 `web/config.js`、輸出目錄為 `web/`。
Vercel 專案需設定環境變數 `SS_API_URL`（例如 `https://safety-stock-automation.onrender.com`），
未設定時 build 會失敗，Vercel 會保留前一版部署，不會上線一個連不到後端的版本。
