// @ts-check
/**
 * 分類前置期：依物料主檔的產品分類覆寫全域前置期。只有後端載入物料主檔時才顯示。
 */

import { api } from "../api/client.js";
import { h } from "../utils/dom.js";
import { watch } from "../state/store.js";
import { DEFAULT_LEAD_TIME, setParameters } from "../state/workflow.js";
import { disclosure } from "./form-controls.js";

const MIN_LEAD_TIME = 1;
const MAX_LEAD_TIME = 365;

/**
 * @param {HTMLElement} host
 * @param {import("../state/workflow.js").WorkflowStore} store
 */
export async function mountCategoryLeadTimes(host, store) {
  /** @type {import("../api/types").MaterialGroupsResponse} */
  let master;
  try {
    master = await api.materialGroups();
  } catch {
    // 後端未啟動或休眠中：不顯示此區塊，不影響其他設定
    return;
  }
  if (!master.available) return;

  /** @param {Record<string, number>} next */
  const setOverrides = (next) => setParameters(store, { categoryLeadTimes: next });
  const categories = Object.entries(master.categories).sort(([, a], [, b]) => b.totalCount - a.totalCount);

  const rows = categories.map(([catId, cat]) => {
    const input = h("input", {
      type: "number",
      class: "input mono",
      min: String(MIN_LEAD_TIME),
      max: String(MAX_LEAD_TIME),
      "aria-label": `${cat.name} 前置天數`,
      onInput: () => {
        const overrides = { ...store.get().parameters.categoryLeadTimes };
        if (input.value === "") {
          delete overrides[catId];
          setOverrides(overrides);
          return;
        }
        const n = Number.parseInt(input.value, 10);
        if (n >= MIN_LEAD_TIME && n <= MAX_LEAD_TIME) setOverrides({ ...overrides, [catId]: n });
      },
    });
    const el = h(
      "div",
      { class: "category-row" },
      h(
        "div",
        null,
        h("span", { class: "category-name" }, cat.name),
        h("span", { class: "faint category-meta mono" }, `${catId} · ${cat.totalCount.toLocaleString("en-US")} 個品項`)
      ),
      h("div", { class: "input-with-suffix" }, input, h("span", { class: "suffix" }, "天"))
    );
    return { catId, input, el };
  });

  const content = h(
    "div",
    { class: "category-panel" },
    h("p", { class: "card-desc" }, "可針對特定產品分類覆寫全域前置期；空白沿用上方的全域設定。"),
    h(
      "div",
      { class: "category-grid" },
      rows.map((r) => r.el)
    ),
    h("button", { type: "button", class: "btn", onClick: () => setOverrides({}) }, "全部重設為預設值")
  );
  host.replaceChildren(h("div", { class: "card" }, disclosure("分類前置期", content)));

  watch(
    store,
    (s) => s.parameters,
    (p) => {
      const overrides = p.categoryLeadTimes ?? {};
      for (const { catId, input } of rows) {
        const value = overrides[catId];
        input.placeholder = `預設 ${p.leadTime ?? DEFAULT_LEAD_TIME}`;
        const text = value === undefined ? "" : String(value);
        // 正在輸入的欄位不覆寫，避免打字途中（例如超出範圍的暫時值）被改掉
        if (document.activeElement !== input && input.value !== text) input.value = text;
      }
    }
  );
}
