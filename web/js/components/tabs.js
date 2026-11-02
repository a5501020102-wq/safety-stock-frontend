// @ts-check
/**
 * 三分頁導覽：上傳 / 設定 / 分析。
 *
 * - WAI-ARIA tablist：roving tabindex，方向鍵與 Home/End 切換
 * - 目前分頁同步到 URL hash（replaceState，不污染瀏覽紀錄），可直接連結到 /#analysis
 */

import { h, setClasses } from "../utils/dom.js";
import { watch } from "../state/store.js";

/** @typedef {import("../state/workflow.js").TabId} TabId */

/** @type {readonly TabId[]} */
export const TAB_IDS = ["sources", "configuration", "analysis"];

/** @type {Record<TabId, string>} */
const TAB_LABELS = { sources: "上傳", configuration: "設定", analysis: "分析" };

/**
 * @param {string} value
 * @returns {value is TabId}
 */
export function isTabId(value) {
  return /** @type {readonly string[]} */ (TAB_IDS).includes(value);
}

/** @returns {TabId} */
export function tabFromHash() {
  const raw = window.location.hash.replace(/^#/, "");
  return isTabId(raw) ? raw : "sources";
}

/**
 * @param {import("../state/workflow.js").WorkflowStore} store
 * @param {TabId} id
 */
export function setActiveTab(store, id) {
  store.set({ activeTab: id });
}

/**
 * @param {HTMLElement} nav
 * @param {import("../state/workflow.js").WorkflowStore} store
 */
export function mountTabs(nav, store) {
  /** @type {Record<TabId, HTMLButtonElement>} */
  const buttons = /** @type {Record<TabId, HTMLButtonElement>} */ ({});

  /**
   * @param {KeyboardEvent} e
   * @param {number} index
   */
  const onKeyDown = (e, index) => {
    const last = TAB_IDS.length - 1;
    /** @type {Record<string, number>} */
    const moves = {
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowUp: index === 0 ? last : index - 1,
      ArrowRight: index === last ? 0 : index + 1,
      ArrowDown: index === last ? 0 : index + 1,
      Home: 0,
      End: last,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = TAB_IDS[moves[e.key]];
    setActiveTab(store, next);
    buttons[next].focus();
  };

  const list = h(
    "div",
    { role: "tablist", "aria-label": "主要區段", class: "tablist" },
    TAB_IDS.map((id, index) => {
      const button = h(
        "button",
        {
          type: "button",
          role: "tab",
          id: `tab-${id}`,
          "aria-controls": id,
          class: "tab",
          onClick: () => setActiveTab(store, id),
          onKeydown: (/** @type {KeyboardEvent} */ e) => onKeyDown(e, index),
        },
        h("span", { class: "tab-step mono" }, String(index + 1).padStart(2, "0")),
        h("span", { class: "tab-label" }, TAB_LABELS[id])
      );
      buttons[id] = button;
      return button;
    })
  );
  nav.replaceChildren(list);

  watch(
    store,
    (s) => s.activeTab,
    (active) => {
      for (const id of TAB_IDS) {
        const isActive = id === active;
        buttons[id].setAttribute("aria-selected", String(isActive));
        buttons[id].tabIndex = isActive ? 0 : -1;
        const panel = document.getElementById(id);
        if (panel) setClasses(panel, { "tab-panel-active": isActive });
      }
      if (window.location.hash !== `#${active}`) window.history.replaceState(null, "", `#${active}`);
    }
  );

  window.addEventListener("hashchange", () => setActiveTab(store, tabFromHash()));
}
