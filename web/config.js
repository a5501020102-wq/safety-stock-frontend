// @ts-check
/**
 * 執行環境設定。
 *
 * 本機開發直接使用此檔；部署時由 scripts/write-config.mjs 依環境變數 SS_API_URL 覆寫。
 * API 網址結尾不可有斜線。
 */
export const API_BASE = "http://localhost:5000";
