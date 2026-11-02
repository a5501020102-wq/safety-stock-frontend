// @ts-check
/** 介面文字與代碼對照（繁體中文）。 */

/** @typedef {import("../api/types").CalcMode} CalcMode */
/** @typedef {import("../api/types").Granularity} Granularity */

/** @type {Record<CalcMode, string>} */
export const CALC_MODE_LABELS = { compare: "對比", all: "分倉", total: "總倉", single: "單倉" };

/** @type {Record<Granularity, string>} */
export const GRANULARITY_LABELS = { monthly: "月", weekly: "週", daily: "日" };

/** @type {Record<Granularity, string>} 移動平均視窗的單位 */
export const PERIOD_UNITS = { monthly: "月", weekly: "週", daily: "天" };

export const MONTH_NAMES = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
];

/** @param {string} mode */
export function calcModeLabel(mode) {
  return CALC_MODE_LABELS[/** @type {CalcMode} */ (mode)] ?? mode;
}

/** @param {string} granularity */
export function granularityLabel(granularity) {
  return GRANULARITY_LABELS[/** @type {Granularity} */ (granularity)] ?? granularity;
}
