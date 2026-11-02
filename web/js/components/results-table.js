// @ts-check
/**
 * 結果表格區塊：狀態分頁、出貨點篩選、搜尋、排序、分頁，以及展開明細。
 * 表格的篩選與排序是本區塊自己的 UI 狀態，不寫入 store、不保存。
 */

import { h, replaceChildren } from "../utils/dom.js";
import {
  DEFAULT_SORT,
  PAGE_SIZE,
  countByStatus,
  filterAndSort,
  groupBySku,
  nextSort,
  paginate,
  uniqueSites,
} from "../utils/results.js";
import { columnsFor, detailRow, groupRow, resultRow } from "./result-rows.js";

/** @typedef {import("../api/types").SkuResult} SkuResult */
/** @typedef {import("../utils/results.js").StatusFilter} StatusFilter */
/** @typedef {import("../utils/results.js").TableQuery} TableQuery */
/** @typedef {import("../utils/results.js").SortState} SortState */
/** @typedef {import("./result-rows.js").Column} Column */

/** @type {Array<{ key: StatusFilter, label: string, description: string }>} */
const STATUS_FILTERS = [
  { key: "all", label: "全部", description: "所有料號" },
  { key: "red", label: "缺貨", description: "低於安全庫存" },
  { key: "green", label: "健康", description: "範圍內" },
  { key: "blue", label: "過量", description: "超過 3 倍安全庫存" },
];

const SEARCH_DEBOUNCE_MS = 150;

/**
 * 可排序的欄位標題；排序狀態以 aria-sort 與箭頭表示。
 * @param {Column[]} columns
 * @param {(key: NonNullable<Column["sortKey"]>) => void} onSort
 */
function sortableHeaders(columns, onSort) {
  const cells = columns.map((col) => {
    const indicator = h("span", { class: "sort-indicator", "aria-hidden": "true" });
    const sortKey = col.sortKey;
    const th = h(
      "th",
      {
        scope: "col",
        class: `align-${col.align}${sortKey ? " is-sortable" : ""}`,
        onClick: sortKey ? () => onSort(sortKey) : null,
      },
      col.label,
      indicator
    );
    return { sortKey, th, indicator };
  });
  return {
    row: h(
      "tr",
      null,
      cells.map((c) => c.th)
    ),
    /** @param {SortState} sort */
    update(sort) {
      for (const { sortKey, th, indicator } of cells) {
        const isActive = sortKey !== null && sort.key === sortKey;
        const isAsc = sort.dir === "asc";
        th.setAttribute("aria-sort", isActive ? (isAsc ? "ascending" : "descending") : "none");
        indicator.textContent = isActive ? (isAsc ? "↑" : "↓") : "";
        th.classList.toggle("is-sorted", isActive);
      }
    },
  };
}

/**
 * @param {Record<StatusFilter, number>} counts
 * @param {(status: StatusFilter) => void} onSelect
 */
function statusTabs(counts, onSelect) {
  const buttons = STATUS_FILTERS.map((f) =>
    h(
      "button",
      { type: "button", class: "status-tab", onClick: () => onSelect(f.key) },
      h("span", { class: "status-tab-desc" }, f.description),
      h("span", { class: "status-tab-label" }, `${f.label} `, h("span", { class: "mono" }, String(counts[f.key])))
    )
  );
  return {
    el: h("div", { class: "status-tabs" }, buttons),
    /** @param {StatusFilter} active */
    update(active) {
      STATUS_FILTERS.forEach((f, i) => buttons[i].setAttribute("aria-pressed", String(active === f.key)));
    },
  };
}

/** @param {(text: string) => void} onSearch 輸入停頓後才觸發，避免每個按鍵都重繪表格 */
function searchBox(onSearch) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  const input = h("input", {
    type: "search",
    class: "input",
    placeholder: "料號或品名",
    "aria-label": "搜尋料號或品名",
    onInput: () => {
      clearTimeout(timer);
      timer = setTimeout(() => onSearch(input.value), SEARCH_DEBOUNCE_MS);
    },
  });
  return input;
}

/**
 * @param {string[]} sites
 * @param {(site: string) => void} onChange
 */
function siteFilter(sites, onChange) {
  const select = h(
    "select",
    { class: "select", "aria-label": "篩選出貨點", onChange: () => onChange(select.value) },
    h("option", { value: "all" }, "全部出貨點"),
    sites.map((s) => h("option", { value: s }, s))
  );
  return select;
}

/**
 * 分頁列；只有一頁時只顯示筆數摘要。
 * @param {{ page: number, itemCount: number, summary: string, onPage: (page: number) => void }} spec
 */
function pager({ page, itemCount, summary, onPage }) {
  const totalPages = Math.max(1, Math.ceil(itemCount / PAGE_SIZE));
  if (totalPages === 1) return [h("span", { class: "muted" }, summary)];

  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, itemCount);
  /** @param {string} label @param {string} arrow @param {number} target @param {boolean} isDisabled */
  const pageButton = (label, arrow, target, isDisabled) =>
    h(
      "button",
      { type: "button", class: "btn", disabled: isDisabled, "aria-label": label, onClick: () => onPage(target) },
      arrow
    );
  return [
    h("span", { class: "muted" }, `第 ${start}–${end} 項，共 ${itemCount} 項`),
    h(
      "div",
      { class: "pager" },
      pageButton("上一頁", "←", page - 1, page <= 1),
      h("span", { class: "mono" }, `${page} / ${totalPages}`),
      pageButton("下一頁", "→", page + 1, page >= totalPages)
    ),
  ];
}

/**
 * @param {{ heading: string, deck: string, results: SkuResult[], isSplit: boolean, dpp: number }} spec
 *   isSplit：分倉模式依料號分組並顯示出貨點欄
 */
export function createResultsTable({ heading, deck, results, isSplit, dpp }) {
  /** @type {TableQuery} */
  const query = { status: "all", site: "all", query: "", sort: { ...DEFAULT_SORT } };
  let page = 1;
  /** @type {Set<string>} 展開明細的列（site|sku） */
  const expanded = new Set();
  /** @type {Set<string>} 收合的料號分組 */
  const collapsedGroups = new Set();

  const columns = columnsFor(
    isSplit,
    results.some((r) => r.hasPlan)
  );
  const ctx = { dpp };
  const sites = uniqueSites(results);
  const tbody = h("tbody");
  const footer = h("div", { class: "table-footer" });

  /** 篩選或排序改變時回到第一頁 @param {Partial<TableQuery>} patch */
  const changeQuery = (patch) => {
    Object.assign(query, patch);
    page = 1;
    render();
  };
  /** @param {Set<string>} set @param {string} key */
  const toggleIn = (set, key) => {
    if (set.has(key)) set.delete(key);
    else set.add(key);
    render();
  };

  const headers = sortableHeaders(columns, (key) => changeQuery({ sort: nextSort(query.sort, key) }));
  const tabs = statusTabs(countByStatus(results), (status) => changeQuery({ status }));
  const filters = [
    isSplit && sites.length > 1 ? siteFilter(sites, (site) => changeQuery({ site })) : null,
    searchBox((text) => changeQuery({ query: text })),
  ];

  /** @param {SkuResult} r @param {boolean} isInGroup */
  function rowsFor(r, isInGroup) {
    const key = `${r.site}|${r.sku}`;
    const isExpanded = expanded.has(key);
    const row = resultRow(r, columns, ctx, { isInGroup, isExpanded, onToggle: () => toggleIn(expanded, key) });
    return isExpanded ? [row, detailRow(r, columns.length)] : [row];
  }

  /** 分倉模式以料號分組為分頁單位，其他模式以列為單位 @param {SkuResult[]} sorted */
  function bodyRows(sorted) {
    if (!isSplit) {
      const pageData = paginate(sorted, page);
      page = pageData.page;
      const rows = pageData.slice.flatMap((r) => rowsFor(r, false));
      return { rows, itemCount: sorted.length, summary: `${sorted.length} 列` };
    }
    const groups = groupBySku(sorted, query.sort, dpp);
    const pageData = paginate(groups, page);
    page = pageData.page;
    const rows = pageData.slice.flatMap((g) => {
      const isCollapsed = collapsedGroups.has(g.sku);
      const header = groupRow(g, columns.length, { isCollapsed, onToggle: () => toggleIn(collapsedGroups, g.sku) });
      return isCollapsed ? [header] : [header, ...g.items.flatMap((r) => rowsFor(r, true))];
    });
    return { rows, itemCount: groups.length, summary: `${groups.length} 個料號 · ${sorted.length} 列` };
  }

  function render() {
    headers.update(query.sort);
    tabs.update(query.status);
    const { rows, itemCount, summary } = bodyRows(filterAndSort(results, query, dpp));
    const emptyRow = h(
      "tr",
      null,
      h("td", { colSpan: columns.length, class: "empty-cell muted" }, "沒有符合篩選條件的料號。")
    );
    replaceChildren(tbody, itemCount === 0 ? [emptyRow] : rows);
    replaceChildren(
      footer,
      pager({
        page,
        itemCount,
        summary,
        onPage: (target) => {
          page = target;
          render();
        },
      })
    );
  }

  render();

  return h(
    "section",
    { class: "card results-block" },
    h(
      "div",
      { class: "results-block-head" },
      h("h3", { class: "card-title" }, heading),
      h("p", { class: "card-desc" }, deck)
    ),
    h("div", { class: "table-controls" }, tabs.el, h("div", { class: "table-filters" }, filters)),
    h("div", { class: "table-scroll" }, h("table", { class: "results-table" }, h("thead", null, headers.row), tbody)),
    footer
  );
}
