// @ts-check
/** 數字與檔案大小格式化。 */

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;
export const EMPTY = "—";

/**
 * 千分位、固定小數位；null / NaN 顯示破折號。
 * @param {number | null | undefined} value
 * @param {number} [decimals]
 */
export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** @param {number} bytes */
export function formatBytes(bytes) {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  return `${(bytes / BYTES_PER_MB).toFixed(2)} MB`;
}

/** YYYYMM → YYYY/MM（庫存計畫的月份格式） @param {string} yyyymm */
export function formatPlanMonth(yyyymm) {
  return `${yyyymm.slice(0, 4)}/${yyyymm.slice(4)}`;
}
