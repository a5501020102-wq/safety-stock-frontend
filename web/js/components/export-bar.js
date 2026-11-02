// @ts-check
/** 匯出列：Excel 與 SAP MM17，可依出貨點篩選。 */

import { api } from "../api/client.js";
import { h } from "../utils/dom.js";
import { uniqueSites } from "../utils/results.js";

/** @typedef {import("../api/types").CalculationResponse} CalculationResponse */
/** @typedef {"all" | "total"} SapMode */

/**
 * @param {Blob} blob
 * @param {string} filename
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = h("a", { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * 匯出請求主體：結果由前端帶回（後端無狀態）。
 * @param {CalculationResponse} result
 * @param {string | undefined} siteFilter
 */
function resultPayload(result, siteFilter) {
  if (result.mode === "compare") {
    return {
      mode: result.mode,
      siteFilter,
      allSummary: { summary: result.allSummary.summary, results: result.allSummary.results },
      totalSummary: { summary: result.totalSummary.summary, results: result.totalSummary.results },
    };
  }
  return { mode: result.mode, siteFilter, summary: result.summary, results: result.results };
}

/** @param {CalculationResponse} result */
export function createExportBar(result) {
  const sites = uniqueSites(result.mode === "compare" ? result.allSummary.results : result.results);
  const siteSelect = h(
    "select",
    { class: "select", "aria-label": "匯出出貨點" },
    h("option", { value: "all" }, "全部出貨點"),
    sites.map((s) => h("option", { value: s }, s))
  );
  const status = h("span", { class: "export-status", role: "status" });
  /** @type {HTMLButtonElement[]} */
  const buttons = [];

  /**
   * @param {string} label
   * @param {() => Promise<{ blob: Blob, filename: string }>} request
   */
  const exportButton = (label, request) => {
    const button = h(
      "button",
      {
        type: "button",
        class: "btn",
        onClick: async () => {
          for (const b of buttons) b.disabled = true;
          status.textContent = "下載中…";
          status.classList.remove("text-shortage");
          try {
            const { blob, filename } = await request();
            triggerDownload(blob, filename);
            status.textContent = "";
          } catch (err) {
            status.textContent = `匯出失敗：${err instanceof Error ? err.message : "未知錯誤"}`;
            status.classList.add("text-shortage");
          } finally {
            for (const b of buttons) b.disabled = false;
          }
        },
      },
      label
    );
    buttons.push(button);
    return button;
  };

  const siteFilter = () => (siteSelect.value === "all" ? undefined : siteSelect.value);
  const params = result.parameters;
  const excel = exportButton("Excel", () =>
    api.exportExcel({
      ...resultPayload(result, siteFilter()),
      granularity: params.granularity,
      selectedWeeks: params.selectedWeeks,
      // 快照的 calcMode 有後端既有問題（見 results-summary.js），以回應的 mode 為準
      calcParams: { ...params, calcMode: result.mode },
      ...(result.mode === "compare" ? { comparison: result.comparison } : {}),
    })
  );
  /** @param {string} label @param {SapMode} sapMode */
  const sapButton = (label, sapMode) =>
    exportButton(label, () => api.exportSap({ ...resultPayload(result, siteFilter()), format: "xlsx", sapMode }));

  const sapButtons =
    result.mode === "compare"
      ? [sapButton("SAP MM17 · 分倉", "all"), sapButton("SAP MM17 · 總倉", "total")]
      : [sapButton("SAP MM17", result.mode === "total" ? "total" : "all")];

  return h(
    "div",
    { class: "card export-bar" },
    h("span", { class: "overline" }, "匯出"),
    siteSelect,
    excel,
    sapButtons,
    status
  );
}
