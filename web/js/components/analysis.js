// @ts-check
/**
 * 分析區段：依狀態顯示空白提示、計算中骨架，或計算結果（摘要、匯出、表格）。
 * 重新計算時保留舊結果並蓋上半透明遮罩。
 */

import { h, replaceChildren } from "../utils/dom.js";
import { watch } from "../state/store.js";
import { daysPerPeriod } from "../state/workflow.js";
import { renderSummary } from "./results-summary.js";
import { createExportBar } from "./export-bar.js";
import { createResultsTable } from "./results-table.js";

/** @typedef {import("../api/types").CalculationResponse} CalculationResponse */

const SKELETON_CARDS = 4;
const SKELETON_ROWS = 6;

/** @param {CalculationResponse} result */
function renderResults(result) {
  // 日均需求的每期天數以計算當下的快照為準，不受之後表單修改影響
  const dpp = daysPerPeriod(result.parameters.granularity, result.parameters.workingDaysPerMonth);
  const tables =
    result.mode === "compare"
      ? [
          createResultsTable({
            heading: "分倉",
            deck: "每個出貨點獨立計算。",
            results: result.allSummary.results,
            isSplit: true,
            dpp,
          }),
          createResultsTable({
            heading: "總倉",
            deck: "所有出貨點合併為一個虛擬總倉。",
            results: result.totalSummary.results,
            isSplit: false,
            dpp,
          }),
        ]
      : [
          createResultsTable({
            heading: result.mode === "total" ? "總倉" : "分倉",
            deck: "所有通過最少期數篩選的料號。",
            results: result.results,
            isSplit: result.mode === "all",
            dpp,
          }),
        ];
  return [renderSummary(result), createExportBar(result), ...tables];
}

function renderSkeleton() {
  return h(
    "div",
    { class: "skeleton", "aria-busy": "true" },
    h("span", { class: "overline" }, "計算中"),
    h(
      "div",
      { class: "stat-cards" },
      Array.from({ length: SKELETON_CARDS }, () => h("div", { class: "card skeleton-block" }))
    ),
    h(
      "div",
      { class: "card" },
      Array.from({ length: SKELETON_ROWS }, () => h("div", { class: "skeleton-line" }))
    ),
    h("p", { class: "muted" }, "計算中，結果即將顯示。資料量大或伺服器剛喚醒時可能需要一分鐘。")
  );
}

/** @param {boolean} hasSales */
function renderEmpty(hasSales) {
  return h(
    "div",
    { class: "card empty-state" },
    h("span", { class: "overline" }, "尚未計算"),
    h(
      "p",
      { class: "empty-title" },
      hasSales ? "請至「設定」分頁確認參數並按計算。" : "請先上傳銷貨明細以啟用此區塊。"
    ),
    h("p", { class: "muted" }, "結果會顯示在這裡：計算條件、摘要、結果表格、篩選與匯出。")
  );
}

/**
 * @param {HTMLElement} section
 * @param {import("../state/workflow.js").WorkflowStore} store
 */
export function mountAnalysis(section, store) {
  const content = h("div", { class: "analysis-content" });
  const overlay = h(
    "div",
    { class: "analysis-overlay", "aria-live": "polite" },
    h(
      "div",
      { class: "card overlay-box" },
      h("span", { class: "spinner", "aria-hidden": "true" }),
      "重新計算中，新結果即將顯示。"
    )
  );
  section.replaceChildren(
    h("div", { class: "section-head" }, h("h2", { class: "section-title" }, "分析結果")),
    h("div", { class: "analysis-stack" }, content, overlay)
  );

  /** @type {CalculationResponse | null | undefined} 已渲染的結果，避免重複重建表格 */
  let rendered;
  watch(
    store,
    (s) => s,
    (s) => {
      overlay.hidden = !(s.isCalculating && s.calculationResult);
      if (s.calculationResult) {
        if (rendered !== s.calculationResult) {
          rendered = s.calculationResult;
          replaceChildren(content, renderResults(s.calculationResult));
        }
        return;
      }
      rendered = null;
      replaceChildren(content, s.isCalculating ? renderSkeleton() : renderEmpty(Boolean(s.uploads.sales)));
    }
  );
}
