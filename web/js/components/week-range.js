// @ts-check
/** 週粒度的週別範圍選擇：起迄週與快速範圍（近 4 / 8 / 12 週、全部）。 */

import { h, replaceChildren } from "../utils/dom.js";

const DAYS_PER_WEEK = 7;
const RECENT_WEEK_PRESETS = [4, 8, 12];

/**
 * 依起迄週（順序不拘）取出連續週別。
 * @param {string[]} available
 * @param {string} from
 * @param {string} to
 * @returns {string[] | null}
 */
export function weeksBetween(available, from, to) {
  const a = available.indexOf(from);
  const b = available.indexOf(to);
  if (a < 0 || b < 0) return null;
  return available.slice(Math.min(a, b), Math.max(a, b) + 1);
}

/** @param {(weeks: string[]) => void} onChange */
export function createWeekRange(onChange) {
  const el = h("div", { class: "week-range" });
  /** @type {string[]} */
  let available = [];
  /** @type {string[] | undefined} */
  let selected;

  /** @param {string} value @param {(e: Event) => void} handler */
  const weekSelect = (value, handler) =>
    h(
      "select",
      { class: "select mono", onChange: handler },
      available.map((w) => h("option", { value: w, selected: w === value }, w))
    );

  function render() {
    if (available.length === 0) {
      replaceChildren(el, h("p", { class: "muted" }, "請先上傳銷貨明細以查看可用週別。"));
      return;
    }
    const from = selected?.[0] ?? available[0];
    const to = selected?.[selected.length - 1] ?? available[available.length - 1];
    const count = selected?.length ?? available.length;
    /** @param {string} f @param {string} t */
    const setRange = (f, t) => {
      const weeks = weeksBetween(available, f, t);
      if (weeks) onChange(weeks);
    };
    const presets = [
      ...RECENT_WEEK_PRESETS.map((n) => ({ label: `近 ${n} 週`, count: n })),
      { label: "全部", count: available.length },
    ];

    replaceChildren(
      el,
      h(
        "div",
        { class: "week-range-head" },
        h("span", { class: "field-label" }, "週別範圍"),
        h("span", { class: "mono muted" }, `${count} 週（${count * DAYS_PER_WEEK} 天）`)
      ),
      h(
        "div",
        { class: "week-range-controls" },
        h(
          "label",
          { class: "field" },
          h("span", { class: "field-label" }, "起"),
          weekSelect(from, (e) => setRange(/** @type {HTMLSelectElement} */ (e.target).value, to))
        ),
        h(
          "label",
          { class: "field" },
          h("span", { class: "field-label" }, "迄"),
          weekSelect(to, (e) => setRange(from, /** @type {HTMLSelectElement} */ (e.target).value))
        ),
        h(
          "div",
          { class: "chip-row" },
          presets.map((p) =>
            h(
              "button",
              {
                type: "button",
                class: "chip",
                "aria-pressed": String(count === p.count),
                onClick: () => onChange(available.slice(Math.max(0, available.length - p.count))),
              },
              p.label
            )
          )
        )
      )
    );
  }

  return {
    el,
    /**
     * @param {boolean} isVisible 只在週粒度顯示
     * @param {string[]} availableWeeks
     * @param {string[] | undefined} selectedWeeks
     */
    update(isVisible, availableWeeks, selectedWeeks) {
      el.hidden = !isVisible;
      if (!isVisible) return;
      available = availableWeeks;
      selected = selectedWeeks;
      render();
    },
  };
}
