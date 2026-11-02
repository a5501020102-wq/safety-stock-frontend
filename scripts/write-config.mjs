// 部署時依環境變數 SS_API_URL 產生 web/config.js（Vercel build command 執行）。
// 未設定時直接失敗，避免正式環境默默連到 localhost 而看起來像 CORS 錯誤。
import { writeFile } from "node:fs/promises";

const apiUrl = (process.env.SS_API_URL ?? "").trim().replace(/\/+$/, "");
if (!/^https?:\/\/[^\s"'`]+$/.test(apiUrl)) {
  console.error("SS_API_URL 未設定或格式錯誤，例如 https://safety-stock-automation.onrender.com");
  process.exit(1);
}

const content = `// @ts-check
// 由 scripts/write-config.mjs 於部署時產生，請勿手動修改。
export const API_BASE = ${JSON.stringify(apiUrl)};
`;
await writeFile(new URL("../web/config.js", import.meta.url), content);
console.log(`web/config.js 已寫入 API_BASE=${apiUrl}`);
