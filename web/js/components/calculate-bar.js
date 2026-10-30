// @ts-check
/**
 * 計算操作列：顯示目前能否計算的原因，按下後呼叫 /api/calculate 並切到分析分頁。
 */

import { api, ApiClientError } from "../api/client.js";
import { h } from "../utils/dom.js";
import { watch } from "../state/store.js";
import { setActiveTab } from "./tabs.js";

/** @typedef {import("../state/workflow.js").WorkflowState} WorkflowState */

/**
 * @param {WorkflowState} s
 * @returns {{ canCalculate: boolean, reason: string }}
 */
export function calculateReadiness(s) {
  const hasSales = Boolean(s.uploads.sales?.fileId);
  const hasMonths = (s.parameters.selectedMonths?.length ?? 0) > 0;
  const hasDateRange = Boolean(s.parameters.dateFrom && s.parameters.dateTo);
  const hasTimeFilter = hasMonths || hasDateRange;
  const canCalculate = hasSales && hasTimeFilter && !s.isCalculating;

  let reason = "設定完成，請按計算。";
  if (!hasSales) reason = "請先上傳銷貨明細。";
  else if (!hasTimeFilter) reason = "請設定日期範圍或至少選擇一個月份。";
  else if (s.isCalculating) reason = "計算中…";
  else if (s.calculationResult) reason = "已有結果，可重新計算。";
  return { canCalculate, reason };
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function describeError(err) {
  if (err instanceof ApiClientError) return `[${err.code}] ${err.message}`;
  if (err instanceof Error && err.message) return err.message;
  return "計算失敗";
}

/**
 * @param {import("../state/workflow.js").WorkflowStore} store
 */
async function runCalculation(store) {
  const { uploads, parameters } = store.get();
  if (!uploads.sales) return;
  store.set({ isCalculating: true, calculationError: null });
  setActiveTab(store, "analysis");
  window.scrollTo({ top: 0, behavior: "smooth" });
  try {
    const result = await api.calculate({
      salesFileId: uploads.sales.fileId,
      priceFileId: uploads.price?.fileId ?? null,
      planFileId: uploads.plan?.fileId ?? null,
      params: parameters,
    });
    store.set({ calculationResult: result, isCalculating: false });
  } catch (err) {
    // 失敗時回到設定分頁，讓使用者看到錯誤並調整
    store.set({ calculationError: describeError(err), isCalculating: false });
    setActiveTab(store, "configuration");
  }
}

/**
 * @param {HTMLElement} section
 * @param {import("../state/workflow.js").WorkflowStore} store
 */
export function mountCalculateBar(section, store) {
  const reason = h("p", { class: "calc-reason" });
  const error = h("p", { class: "calc-error text-shortage", role: "alert" });
  const button = h("button", {
    type: "button",
    class: "btn btn-primary btn-lg calc-button",
    onClick: () => void runCalculation(store),
  });

  section.append(
    h(
      "div",
      { class: "calc-bar card" },
      h("div", null, h("span", { class: "overline" }, "下一步"), reason, error),
      button
    )
  );

  watch(
    store,
    (s) => s,
    (s) => {
      const state = calculateReadiness(s);
      reason.textContent = state.reason;
      error.textContent = s.calculationError ?? "";
      error.hidden = !s.calculationError;
      button.disabled = !state.canCalculate;
      button.setAttribute("aria-busy", String(s.isCalculating));
      if (s.isCalculating) button.replaceChildren(h("span", { class: "spinner", "aria-hidden": "true" }), "計算中");
      else button.textContent = s.calculationResult ? "重新計算" : "計算";
    }
  );
}
