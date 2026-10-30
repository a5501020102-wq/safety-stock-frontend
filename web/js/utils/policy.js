// @ts-check
/** 「計算政策預覽」：把目前參數濃縮成一行文字，讓使用者計算前再確認一次。 */

import { calcModeLabel, granularityLabel } from "./labels.js";
import { DEFAULT_LEAD_TIME, DEFAULT_MA_WINDOW, DEFAULT_MIN_MONTHS, DEFAULT_Z_SCORES } from "../state/workflow.js";

const MONTHS_IN_YEAR = 12;

/** @param {import("../api/types").CalculateRequestParams} p */
export function summarizePolicy(p) {
  const z = p.zScores ?? DEFAULT_Z_SCORES;
  const months = p.selectedMonths?.length ?? MONTHS_IN_YEAR;
  const ma = p.enableMa ? `，移動平均(${p.maWindow ?? DEFAULT_MA_WINDOW})` : "";
  const outlier = p.enableOutlier ? "" : "，保留離群值";
  const dateRange = p.dateFrom && p.dateTo ? ` · ${p.dateFrom}~${p.dateTo}` : "";
  return (
    `${calcModeLabel(p.calcMode ?? "compare")} · ${granularityLabel(p.granularity ?? "monthly")} · ` +
    `前置期 ${p.leadTime ?? DEFAULT_LEAD_TIME} 天 · 最少 ${p.minMonths ?? DEFAULT_MIN_MONTHS} 期 · ` +
    `Z(${z.A}/${z.B}/${z.C}) · 已選 ${months}/${MONTHS_IN_YEAR} 個月${dateRange}${ma}${outlier}`
  );
}
