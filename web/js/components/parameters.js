// @ts-check
/**
 * 參數設定區段。所有輸入即時寫入 store（並保存到 localStorage）。
 */

import { h, replaceChildren } from "../utils/dom.js";
import { watch } from "../state/store.js";
import {
  ALL_MONTHS,
  CALENDAR_DAYS_PER_MONTH,
  DEFAULT_LEAD_TIME,
  DEFAULT_MA_WINDOW,
  DEFAULT_MIN_MONTHS,
  DEFAULT_Z_SCORES,
  setParameters,
} from "../state/workflow.js";
import { MONTH_NAMES, PERIOD_UNITS } from "../utils/labels.js";
import { summarizePolicy } from "../utils/policy.js";
import { disclosure, numberField, radioGroup, selectField, settingsCard, switchRow } from "./form-controls.js";
import { mountCategoryLeadTimes } from "./category-lead-times.js";
import { createWeekRange } from "./week-range.js";

/** @typedef {import("../state/workflow.js").WorkflowStore} WorkflowStore */
/** @typedef {import("../api/types").CalculateRequestParams} Params */
/** @typedef {"A" | "B" | "C"} Tier */

const MAX_LEAD_TIME = 365;
const MAX_MIN_MONTHS = 12;
const MA_WINDOW_MIN = 2;
const MA_WINDOW_MAX = 12;
const MAX_WORKING_DAYS = 31;

/**
 * 各 ABC 等級可選的服務水準（括號內為對應 Z 值）。
 * @type {Record<Tier, Array<{ value: number, label: string }>>}
 */
const Z_OPTIONS = {
  A: [
    { value: 1.65, label: "95% (1.65)" },
    { value: 2.05, label: "98% (2.05)" },
    { value: 2.33, label: "99% (2.33)" },
  ],
  B: [
    { value: 1.28, label: "90% (1.28)" },
    { value: 1.65, label: "95% (1.65)" },
    { value: 1.96, label: "97.5% (1.96)" },
  ],
  C: [
    { value: 1.04, label: "85% (1.04)" },
    { value: 1.28, label: "90% (1.28)" },
    { value: 1.65, label: "95% (1.65)" },
  ],
};

/** @param {WorkflowStore} store */
function createStrategyCards(store) {
  /** @param {Partial<Params>} patch */
  const set = (patch) => setParameters(store, patch);

  const calcMode = radioGroup(
    "calcMode",
    [
      { value: "compare", label: "對比", deck: "同時計算分倉與總倉，顯示庫存差異。" },
      { value: "all", label: "分倉", deck: "每個出貨點獨立計算。" },
      { value: "total", label: "總倉", deck: "所有出貨點合併為一個虛擬總倉。" },
    ],
    (value) => set({ calcMode: value })
  );

  const granularity = radioGroup(
    "granularity",
    [
      { value: "monthly", label: "月", deck: "每個日曆月一筆需求資料。" },
      { value: "weekly", label: "週", deck: "使用 ISO 週，適合需要較細需求分析的品項。" },
      { value: "daily", label: "日", deck: "使用日粒度，適合前置期較短的品項。" },
    ],
    (value) => {
      /** @type {Partial<Params>} */
      const patch = { granularity: value };
      // 切到週粒度時預設選取全部可用週別
      const weeks = store.get().uploads.sales?.availableWeeks ?? [];
      if (value === "weekly" && weeks.length > 0) patch.selectedWeeks = [...weeks];
      set(patch);
    }
  );

  const zSelects = /** @type {Tier[]} */ (["A", "B", "C"]).map((tier) => {
    const field = selectField({
      label: `等級 ${tier}`,
      options: Z_OPTIONS[tier].map((o) => ({ value: String(o.value), label: o.label })),
      onChange: (value) =>
        set({ zScores: { ...DEFAULT_Z_SCORES, ...store.get().parameters.zScores, [tier]: Number(value) } }),
    });
    return { tier, field };
  });

  const trend = radioGroup(
    "trendMode",
    [
      { value: "none", label: "不計算", deck: "不計算需求趨勢。" },
      { value: "short", label: "短期趨勢", deck: "比較資料前半段與後半段的需求變化。" },
      { value: "yoy", label: "年度同期比", deck: "比較最近兩年相同月份的需求變化。" },
    ],
    (value) => set({ trendMode: value })
  );

  const cards = [
    settingsCard("計算模式", "同一份資料的三種計算視角。", calcMode.el),
    settingsCard("彙總粒度", "需求分析的時間單位。", granularity.el),
    settingsCard(
      "ABC 服務水準",
      "依 ABC 分級設定 Z 值；數值越高，安全庫存越多。",
      h(
        "div",
        { class: "z-grid" },
        zSelects.map((z) => z.field.el)
      )
    ),
    settingsCard("趨勢", "在結果中顯示需求變化百分比，不做好壞判斷。", trend.el),
  ];

  /** @param {Params} p */
  const update = (p) => {
    calcMode.update(p.calcMode);
    granularity.update(p.granularity ?? "monthly");
    for (const { tier, field } of zSelects) field.update(String(p.zScores?.[tier] ?? DEFAULT_Z_SCORES[tier]));
    trend.update(p.trendMode ?? "none");
  };
  return { cards, update };
}

/** @param {WorkflowStore} store */
function createTimeAndStatsCards(store) {
  /** @param {Partial<Params>} patch */
  const set = (patch) => setParameters(store, patch);

  const leadTime = numberField({
    label: "前置期",
    suffix: "天",
    min: 1,
    max: MAX_LEAD_TIME,
    onChange: (v) => set({ leadTime: v }),
  });
  const minMonths = numberField({
    label: "最少月份",
    min: 0,
    max: MAX_MIN_MONTHS,
    onChange: (v) => set({ minMonths: v }),
  });
  // 每月工作天：30 代表日曆天，存成 null 與舊版行為一致
  const workingDays = numberField({
    label: "每月工作天",
    suffix: "天",
    min: 1,
    max: MAX_WORKING_DAYS,
    onChange: (v) => set({ workingDaysPerMonth: v === CALENDAR_DAYS_PER_MONTH ? null : v }),
  });
  const weekRange = createWeekRange((weeks) => set({ selectedWeeks: weeks }));

  const outlier = switchRow({
    label: "MAD 離群值偵測",
    deck: "以中位數絕對偏差找出異常期間。",
    onChange: (c) => set({ enableOutlier: c }),
  });
  const movingAverage = switchRow({
    label: "移動平均",
    deck: "以滾動視窗平滑期間之間的需求波動。",
    onChange: (c) => set({ enableMa: c }),
  });
  const maValue = h("span", { class: "mono" });
  const maSlider = h("input", {
    type: "range",
    min: String(MA_WINDOW_MIN),
    max: String(MA_WINDOW_MAX),
    step: "1",
    class: "range",
    "aria-label": "移動平均視窗",
    onInput: () => set({ maWindow: Number(maSlider.value) }),
  });
  const maWindowRow = h("div", { class: "ma-window" }, h("span", { class: "field-label" }, "視窗"), maSlider, maValue);

  const cards = [
    settingsCard(
      "時間參數",
      "前置期與納入計算所需的最少資料期數。",
      h("div", { class: "field-grid" }, leadTime.el, minMonths.el, workingDays.el),
      weekRange.el
    ),
    settingsCard("統計處理", "計算安全庫存前套用的統計處理。", outlier.el, movingAverage.el, maWindowRow),
  ];

  /** @param {Params} p */
  const update = (p) => {
    const isMonthly = (p.granularity ?? "monthly") === "monthly";
    leadTime.update(p.leadTime ?? DEFAULT_LEAD_TIME);
    minMonths.update(p.minMonths ?? DEFAULT_MIN_MONTHS, {
      label: isMonthly ? "最少月份" : "最少期數",
      suffix: isMonthly ? "個月資料" : "有效期數",
    });
    workingDays.update(p.workingDaysPerMonth ?? CALENDAR_DAYS_PER_MONTH);
    workingDays.el.hidden = !isMonthly;
    weekRange.update(p.granularity === "weekly", store.get().uploads.sales?.availableWeeks ?? [], p.selectedWeeks);
    outlier.update(p.enableOutlier ?? true);
    movingAverage.update(p.enableMa ?? false);
    maWindowRow.hidden = !p.enableMa;
    maSlider.value = String(p.maWindow ?? DEFAULT_MA_WINDOW);
    maValue.textContent = `${p.maWindow ?? DEFAULT_MA_WINDOW} ${PERIOD_UNITS[p.granularity ?? "monthly"]}`;
  };
  return { cards, update };
}

/** @param {WorkflowStore} store */
function createFilterCards(store) {
  /** @param {Partial<Params>} patch */
  const set = (patch) => setParameters(store, patch);

  /** @param {"dateFrom" | "dateTo"} key @param {string} label */
  const dateField = (key, label) => {
    const input = h("input", {
      type: "text",
      class: "input mono",
      inputmode: "numeric",
      "aria-label": `日期範圍${label}`,
      onInput: () => set({ [key]: input.value || null }),
    });
    return { input, el: h("label", { class: "field" }, h("span", { class: "field-label" }, label), input) };
  };
  const dateFrom = dateField("dateFrom", "起");
  const dateTo = dateField("dateTo", "迄");

  const monthInputs = ALL_MONTHS.map((m) =>
    h("input", {
      type: "checkbox",
      class: "month-input",
      onChange: () => {
        const selected = new Set(store.get().parameters.selectedMonths ?? []);
        if (selected.has(m)) selected.delete(m);
        else selected.add(m);
        set({ selectedMonths: Array.from(selected).sort((a, b) => a - b) });
      },
    })
  );
  const monthsCounter = h("span", { class: "mono months-counter", "data-role": "months-counter" });
  const seasonal = h(
    "div",
    { class: "seasonal" },
    h("p", { class: "card-desc" }, "只有勾選的月份會納入計算。"),
    h(
      "div",
      { class: "month-grid" },
      ALL_MONTHS.map((m, i) =>
        h(
          "label",
          { class: "month-chip" },
          monthInputs[i],
          h("span", { class: "mono faint" }, String(m).padStart(2, "0")),
          MONTH_NAMES[i]
        )
      )
    ),
    h(
      "div",
      { class: "month-actions" },
      h("button", { type: "button", class: "btn", onClick: () => set({ selectedMonths: [...ALL_MONTHS] }) }, "全選"),
      h("button", { type: "button", class: "btn", onClick: () => set({ selectedMonths: [] }) }, "清除"),
      monthsCounter
    )
  );

  const policyText = h("p", { class: "policy-text" });
  const cards = [
    settingsCard(
      "日期範圍",
      "空白表示使用上傳資料的完整期間（格式 YYYY-MM-DD）。",
      h("div", { class: "field-grid" }, dateFrom.el, dateTo.el),
      disclosure("季節性過濾", seasonal)
    ),
    h("div", { class: "card policy-card" }, h("span", { class: "overline" }, "計算政策預覽"), policyText),
  ];

  /** @param {Params} p */
  const update = (p) => {
    const range = store.get().uploads.sales?.dateRange;
    if (dateFrom.input.value !== (p.dateFrom ?? "")) dateFrom.input.value = p.dateFrom ?? "";
    if (dateTo.input.value !== (p.dateTo ?? "")) dateTo.input.value = p.dateTo ?? "";
    dateFrom.input.placeholder = range?.start ?? "YYYY-MM-DD";
    dateTo.input.placeholder = range?.end ?? "YYYY-MM-DD";
    const selected = new Set(p.selectedMonths ?? []);
    monthInputs.forEach((input, i) => {
      input.checked = selected.has(ALL_MONTHS[i]);
    });
    monthsCounter.textContent = `${selected.size} / ${ALL_MONTHS.length}`;
    policyText.textContent = summarizePolicy(p);
  };
  return { cards, update };
}

/**
 * @param {HTMLElement} section
 * @param {WorkflowStore} store
 */
export function mountParameters(section, store) {
  const strategy = createStrategyCards(store);
  const timeAndStats = createTimeAndStatsCards(store);
  const filters = createFilterCards(store);
  const categoryHost = h("div", { class: "category-host" });

  replaceChildren(
    section,
    h(
      "div",
      { class: "section-head" },
      h("h2", { class: "section-title" }, "參數設定"),
      h("p", { class: "muted" }, "設定會自動保存在這台電腦的瀏覽器中。")
    ),
    h(
      "div",
      { class: "settings-layout" },
      h("div", { class: "settings-column" }, strategy.cards, timeAndStats.cards),
      h("div", { class: "settings-column settings-aside" }, filters.cards)
    ),
    categoryHost
  );

  /** @param {Params} p */
  const updateAll = (p) => {
    strategy.update(p);
    timeAndStats.update(p);
    filters.update(p);
  };
  watch(store, (s) => s.parameters, updateAll);
  // 上傳銷貨明細後，週別清單與日期提示需要更新
  watch(
    store,
    (s) => s.uploads.sales,
    () => updateAll(store.get().parameters),
    { immediate: false }
  );

  void mountCategoryLeadTimes(categoryHost, store);
}
