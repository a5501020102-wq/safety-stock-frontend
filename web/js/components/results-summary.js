// @ts-check
/** 計算條件快照與摘要卡片。 */

import { h } from "../utils/dom.js";
import { EMPTY, formatNumber } from "../utils/format.js";
import { calcModeLabel, granularityLabel } from "../utils/labels.js";

/** @typedef {import("../api/types").CalculationResponse} CalculationResponse */

const MONTHS_IN_YEAR = 12;

/**
 * 計算時實際使用的參數（以後端回傳的快照為準，不是目前表單上的值）。
 *
 * 模式取自回應的 mode：後端快照的 calcMode 只讀 body 頂層的 calc_mode，
 * 前端把參數放在 params 內，所以快照一律是 all（後端既有問題，修正會改到 API 回應）。
 * @param {CalculationResponse} result
 * @returns {Array<[string, string]>}
 */
export function snapshotEntries(result) {
  const p = result.parameters;
  return [
    ["模式", calcModeLabel(result.mode)],
    ["粒度", granularityLabel(p.granularity ?? "monthly")],
    ["範圍", p.dataMinDate && p.dataMaxDate ? `${p.dataMinDate} → ${p.dataMaxDate}` : EMPTY],
    ["排除未完成月", p.excludedMonth ?? EMPTY],
    ["前置期", `${p.leadTimeDays} 天`],
    ["最少期數", String(p.minMonths)],
    ["Z (A/B/C)", `${p.zScores.A} / ${p.zScores.B} / ${p.zScores.C}`],
    ["月份", `${p.selectedMonths.length}/${MONTHS_IN_YEAR}`],
    ["離群值", p.enableOutlier ? "MAD 已啟用" : "停用"],
    ["移動平均", p.enableMa ? `啟用（${p.maWindow}）` : "停用"],
    ["執行時間", `${Math.round(p.executionTimeMs)} ms`],
  ];
}

/**
 * @param {CalculationResponse} result
 * @returns {Array<{ label: string, value: string, hint: string }>}
 */
export function summaryCards(result) {
  if (result.mode === "compare") {
    const c = result.comparison;
    return [
      {
        label: "分倉 · 安全庫存",
        value: formatNumber(c.totalAllSafetyStock),
        hint: `${c.allSkuCount} 列（料號 × 出貨點）`,
      },
      {
        label: "總倉 · 安全庫存",
        value: formatNumber(c.totalTotalSafetyStock),
        hint: `${c.totalSkuCount} 個料號（合併）`,
      },
      {
        label: "庫存差異（分倉 − 總倉）",
        value: formatNumber(c.inventorySaved),
        hint: `佔分倉的 ${c.savingsPercentage.toFixed(1)}%`,
      },
      {
        label: "金額差異（分倉 − 總倉）",
        value: formatNumber(Math.round(c.costSaved)),
        hint: `佔分倉金額的 ${c.savingsValuePercentage.toFixed(1)}%`,
      },
    ];
  }
  const s = result.summary;
  return [
    { label: "有效料號", value: formatNumber(s.totalSkus), hint: `已排除 ${s.excludedCount} 筆（資料不足）` },
    { label: "缺貨風險", value: formatNumber(s.shortageRiskCount), hint: "庫存低於安全庫存" },
    { label: "健康", value: formatNumber(s.healthyCount), hint: "在安全庫存與 3 倍之間" },
    { label: "過量", value: formatNumber(s.overstockRiskCount), hint: "超過 3 倍安全庫存" },
  ];
}

/** @param {CalculationResponse} result */
export function renderSummary(result) {
  return h(
    "div",
    { class: "summary" },
    h(
      "div",
      { class: "card snapshot" },
      h("span", { class: "overline" }, "計算條件"),
      h(
        "dl",
        { class: "snapshot-list" },
        snapshotEntries(result).map(([label, value]) =>
          h("div", null, h("dt", null, label), h("dd", { class: "mono" }, value))
        )
      )
    ),
    h(
      "div",
      { class: "stat-cards" },
      summaryCards(result).map((c) =>
        h(
          "article",
          { class: "card stat-card" },
          h("span", { class: "overline" }, c.label),
          h("p", { class: "stat-value mono" }, c.value),
          h("p", { class: "muted stat-hint" }, c.hint)
        )
      )
    )
  );
}
