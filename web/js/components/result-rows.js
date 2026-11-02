// @ts-check
/**
 * 結果表格的列：欄位定義、單列、分組標題列與展開明細。
 */

import { h } from "../utils/dom.js";
import { EMPTY, formatNumber, formatPlanMonth } from "../utils/format.js";

/** @typedef {import("../api/types").SkuResult} SkuResult */
/** @typedef {import("../utils/results.js").SortKey} SortKey */
/** @typedef {import("../utils/results.js").SkuGroup} SkuGroup */
/** @typedef {"left" | "center" | "right"} Align */
/**
 * @typedef {object} Column
 * @property {string} label
 * @property {SortKey | null} sortKey 不可排序時為 null
 * @property {Align} align
 * @property {(r: SkuResult, ctx: RowContext) => Node} cell
 */
/** @typedef {{ dpp: number }} RowContext dpp：每期天數，用於日均需求 */

const BAR_MAX_HEIGHT_PX = 56;
const BAR_MIN_HEIGHT_PX = 2;

/** @type {Record<string, string>} 需求型態（Syntetos-Boylan 分類）中文 */
const PATTERN_LABELS = { smooth: "穩定", erratic: "波動", intermittent: "零星", lumpy: "雜亂" };

/**
 * @param {number | null | undefined} value
 * @param {number} decimals
 * @param {string} [extraClass]
 */
function num(value, decimals, extraClass = "") {
  return h("span", { class: `mono ${extraClass}`.trim() }, formatNumber(value, decimals));
}

/** @param {SkuResult["abcClass"]} cls @param {boolean | undefined} isPriceMissing */
export function abcBadge(cls, isPriceMissing) {
  return h(
    "span",
    {
      class: `badge badge-abc-${cls}${isPriceMissing ? " badge-price-missing" : ""}`,
      title: isPriceMissing ? "無單價資料，依數量分級" : null,
    },
    cls
  );
}

/** @param {SkuResult} r */
function patternBadge(r) {
  const label = r.demandPattern ? PATTERN_LABELS[r.demandPattern] : undefined;
  if (!label) return h("span", { class: "faint" }, EMPTY);
  const adi = r.adi != null ? r.adi.toFixed(2) : EMPTY;
  const cv2 = r.cvSquared != null ? r.cvSquared.toFixed(2) : EMPTY;
  return h(
    "span",
    { class: `badge badge-pattern-${r.demandPattern}`, title: `ADI ${adi} · CV² ${cv2}（依目前篩選範圍計算）` },
    label
  );
}

/** 安全庫存數字依庫存狀態上色：缺貨紅、過量橘 @param {SkuResult} r */
function safetyStockCell(r) {
  const tone = r.status === "red" ? "text-shortage" : r.status === "blue" ? "text-overstock" : "";
  return num(r.safetyStock, 0, `strong ${tone}`);
}

/** @param {SkuResult} r @param {number} dpp */
export function dailyDemand(r, dpp) {
  return r.meanDemand > 0 ? r.meanDemand / dpp : 0;
}

/** @type {Column[]} */
const BASE_COLUMNS = [
  { label: "料號", sortKey: "sku", align: "left", cell: (r) => h("span", { class: "mono" }, r.sku) },
  { label: "品名", sortKey: null, align: "left", cell: (r) => h("span", { class: "name-cell" }, r.name || EMPTY) },
  { label: "ABC", sortKey: "abcClass", align: "center", cell: (r) => abcBadge(r.abcClass, r.isPriceMissing) },
  { label: "總量", sortKey: "totalQty", align: "right", cell: (r) => num(r.totalQty, 0) },
  { label: "平均", sortKey: "meanDemand", align: "right", cell: (r) => num(r.meanDemand, 0) },
  { label: "日均", sortKey: "dailyDemand", align: "right", cell: (r, ctx) => num(dailyDemand(r, ctx.dpp), 0) },
  { label: "標準差", sortKey: "stdDev", align: "right", cell: (r) => num(r.stdDev, 0) },
  { label: "CV", sortKey: "cv", align: "right", cell: (r) => num(r.cv, 2) },
  { label: "需求型態", sortKey: "demandPattern", align: "center", cell: patternBadge },
  { label: "ADI", sortKey: "adi", align: "right", cell: (r) => num(r.adi ?? null, 2) },
  { label: "安全庫存", sortKey: "safetyStock", align: "right", cell: safetyStockCell },
  { label: "ROP", sortKey: "reorderPoint", align: "right", cell: (r) => num(r.reorderPoint, 0) },
  { label: "最大", sortKey: "maxInventory", align: "right", cell: (r) => num(r.maxInventory, 0) },
  {
    label: "趨勢",
    sortKey: "trendPct",
    align: "right",
    cell: (r) => h("span", { class: "mono" }, r.trendLabel ?? EMPTY),
  },
];

/** 上傳庫存計畫後才出現的欄位 @type {Column[]} */
const PLAN_COLUMNS = [
  { label: "庫存", sortKey: "planStock", align: "right", cell: (r) => num(r.planStock ?? null, 0) },
  { label: "覆蓋天數", sortKey: "coverageDays", align: "right", cell: (r) => num(r.coverageDays ?? null, 1) },
  { label: "建議下單", sortKey: "suggestedOrder", align: "right", cell: (r) => num(r.suggestedOrder ?? null, 0) },
  { label: "缺口", sortKey: "gap", align: "right", cell: (r) => num(r.gap ?? null, 0) },
  {
    label: "缺貨月",
    sortKey: null,
    align: "right",
    cell: (r) => h("span", { class: "mono" }, r.firstShortageMonth ?? EMPTY),
  },
  {
    label: "截止日",
    sortKey: null,
    align: "right",
    cell: (r) => h("span", { class: "mono" }, r.orderDeadline ?? EMPTY),
  },
  { label: "周轉", sortKey: null, align: "right", cell: (r) => num(r.turnoverRate ?? null, 2) },
];

/** @type {Column} */
const SITE_COLUMN = {
  label: "出貨點",
  sortKey: "site",
  align: "left",
  cell: (r) => h("span", { class: "mono" }, r.site),
};

/**
 * @param {boolean} isSplit 分倉模式多一欄出貨點
 * @param {boolean} hasPlan
 * @returns {Column[]}
 */
export function columnsFor(isSplit, hasPlan) {
  return [...(isSplit ? [SITE_COLUMN] : []), ...BASE_COLUMNS, ...(hasPlan ? PLAN_COLUMNS : [])];
}

/**
 * @param {Column} col
 * @param {Node} content
 */
function td(col, content) {
  return h("td", { class: `align-${col.align}` }, content);
}

/**
 * 單一結果列；分組內的列（isInGroup）不重複顯示料號、品名、ABC。
 * @param {SkuResult} r
 * @param {Column[]} columns
 * @param {RowContext} ctx
 * @param {{ isInGroup: boolean, isExpanded: boolean, onToggle: () => void }} options
 */
export function resultRow(r, columns, ctx, { isInGroup, isExpanded, onToggle }) {
  const sharedLabels = new Set(["料號", "品名", "ABC"]);
  return h(
    "tr",
    {
      class: `result-row${isInGroup ? " is-grouped" : ""}${isExpanded ? " is-expanded" : ""}`,
      "aria-expanded": String(isExpanded),
      tabindex: "0",
      onClick: onToggle,
      onKeydown: (/** @type {KeyboardEvent} */ e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      },
    },
    columns.map((col) => td(col, isInGroup && sharedLabels.has(col.label) ? h("span", null) : col.cell(r, ctx)))
  );
}

/**
 * 分倉模式的料號分組標題列。
 * @param {SkuGroup} group
 * @param {number} colCount
 * @param {{ isCollapsed: boolean, onToggle: () => void }} options
 */
export function groupRow(group, colCount, { isCollapsed, onToggle }) {
  const fixedCols = 5;
  return h(
    "tr",
    { class: "group-row", "aria-expanded": String(!isCollapsed), onClick: onToggle },
    h("td", null, h("span", { class: "muted" }, `${isCollapsed ? "▸" : "▾"} ${group.items.length} 個出貨點`)),
    h("td", null, h("span", { class: "mono strong" }, group.sku)),
    h("td", null, h("span", { class: "name-cell" }, group.name || EMPTY)),
    h("td", { class: "align-center" }, abcBadge(group.abcClass, group.isPriceMissing)),
    h("td", { class: "align-right" }, num(group.totalQty, 0, "strong")),
    h("td", { colSpan: colCount - fixedCols })
  );
}

/**
 * 展開明細列：各期需求長條、統計摘要、庫存預測（有計畫資料時）。
 * @param {SkuResult} r
 * @param {number} colCount
 */
export function detailRow(r, colCount) {
  return h(
    "tr",
    { "data-row-detail": "true", class: "detail-row" },
    h("td", { colSpan: colCount }, h("div", { class: "row-detail row-detail-open" }, demandDetail(r)))
  );
}

/** @param {Array<[string, string]>} pairs */
function statList(pairs) {
  return h(
    "dl",
    { class: "stat-list" },
    pairs.map(([k, v]) => h("div", null, h("dt", null, k), h("dd", { class: "mono" }, v)))
  );
}

/** @param {SkuResult} r */
function demandDetail(r) {
  const values = r.monthlyValues ?? [];
  if (values.length === 0) return h("p", { class: "muted" }, "沒有期間資料。");

  const maxVal = Math.max(...values, 1);
  const bars = values.map((v, i) => {
    const tone = v <= 0 ? "is-zero" : v >= r.meanDemand ? "is-above" : "is-below";
    const bar = h("div", { class: `bar ${tone}`, title: `第 ${i + 1} 期：${formatNumber(v, 0)}` });
    bar.style.height = `${Math.max(BAR_MIN_HEIGHT_PX, Math.round((v / maxVal) * BAR_MAX_HEIGHT_PX))}px`;
    return bar;
  });

  return h(
    "div",
    { class: "detail" },
    r.dataPointWarning ? h("p", { class: "detail-warning" }, r.dataPointWarning) : null,
    h(
      "div",
      { class: "detail-grid" },
      h(
        "div",
        null,
        h("span", { class: "overline" }, "各期需求"),
        h("div", { class: "bar-chart", "aria-hidden": "true" }, bars),
        h(
          "div",
          { class: "bar-values mono" },
          values.map((v) => h("span", null, formatNumber(v, 0)))
        )
      ),
      h(
        "div",
        null,
        h("span", { class: "overline" }, "摘要"),
        statList([
          ["平均", formatNumber(r.meanDemand, 0)],
          ["標準差", formatNumber(r.stdDev, 0)],
          ["CV", formatNumber(r.cv, 2)],
          ["安全庫存", formatNumber(r.safetyStock, 0)],
          ["ROP", formatNumber(r.reorderPoint, 0)],
          ["最大", formatNumber(r.maxInventory, 0)],
          ["期數", String(values.length)],
          ["有需求期數", String(values.filter((v) => v > 0).length)],
        ])
      )
    ),
    r.monthlyPlan && r.monthlyPlan.length > 0 ? planDetail(r) : null
  );
}

/** 庫存預測：期末庫存低於安全庫存的月份標紅 @param {SkuResult} r */
function planDetail(r) {
  const plan = r.monthlyPlan ?? [];
  /** @param {number} v */
  const positiveOrDash = (v) => (v > 0 ? formatNumber(v, 0) : EMPTY);
  const headers = ["月份", "需求", "供應", "調入", "調出", "淨變動", "期末"];

  const table = h(
    "table",
    { class: "plan-table" },
    h(
      "thead",
      null,
      h(
        "tr",
        null,
        headers.map((t, i) => h("th", { class: i === 0 ? "" : "align-right" }, t))
      )
    ),
    h(
      "tbody",
      null,
      h(
        "tr",
        { class: "muted" },
        h("td", null, "目前"),
        h("td", { colSpan: 5 }),
        h("td", { class: "align-right mono" }, formatNumber(r.planStock ?? 0, 0))
      ),
      plan.map((mp) => {
        const isBelowSafety = mp.endingStock < r.safetyStock;
        return h(
          "tr",
          { class: isBelowSafety ? "text-shortage" : "" },
          h("td", { class: "mono" }, formatPlanMonth(mp.month)),
          h("td", { class: "align-right mono" }, positiveOrDash(mp.demand)),
          h("td", { class: "align-right mono" }, positiveOrDash(mp.supply)),
          h("td", { class: "align-right mono" }, positiveOrDash(mp.transferIn)),
          h("td", { class: "align-right mono" }, positiveOrDash(mp.transferOut)),
          h("td", { class: "align-right mono" }, formatNumber(mp.netChange, 0)),
          h("td", { class: `align-right mono${isBelowSafety ? " strong" : ""}` }, formatNumber(mp.endingStock, 0))
        );
      })
    )
  );

  /** @type {Array<[string, string]>} */
  const summary = [
    ["目前庫存", formatNumber(r.planStock ?? 0, 0)],
    ["期末庫存", formatNumber(r.finalStock ?? 0, 0)],
    ["最低庫存", formatNumber(r.minStock ?? 0, 0)],
  ];
  if (r.minStockMonth) summary.push(["最低月份", formatPlanMonth(r.minStockMonth)]);
  summary.push(["覆蓋天數", r.coverageDays != null ? `${formatNumber(r.coverageDays, 1)} 天` : EMPTY]);
  summary.push(["缺口", r.gap != null ? formatNumber(r.gap, 0) : EMPTY]);

  return h(
    "div",
    { class: "detail-grid" },
    h("div", null, h("span", { class: "overline" }, "庫存預測"), h("div", { class: "table-scroll" }, table)),
    h("div", null, h("span", { class: "overline" }, "計畫摘要"), statList(summary))
  );
}
