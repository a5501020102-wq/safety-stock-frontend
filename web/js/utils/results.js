// @ts-check
/**
 * 結果表格的資料處理（純函式，不碰 DOM）：篩選、排序、依料號分組、分頁。
 */

/** @typedef {import("../api/types").SkuResult} SkuResult */
/** @typedef {import("../api/types").StockStatus} StockStatus */
/**
 * @typedef {"site" | "sku" | "abcClass" | "totalQty" | "meanDemand" | "dailyDemand" | "stdDev" | "cv"
 *   | "demandPattern" | "adi" | "safetyStock" | "reorderPoint" | "maxInventory" | "trendPct"
 *   | "planStock" | "suggestedOrder" | "coverageDays" | "gap"} SortKey
 */
/** @typedef {"asc" | "desc"} SortDir */
/** @typedef {{ key: SortKey, dir: SortDir }} SortState */
/** @typedef {"all" | StockStatus} StatusFilter */
/**
 * @typedef {object} SkuGroup 分倉模式下，同一料號在各出貨點的結果
 * @property {string} sku
 * @property {string} name
 * @property {import("../api/types").AbcClass} abcClass
 * @property {boolean | undefined} isPriceMissing
 * @property {number} totalQty
 * @property {SkuResult[]} items
 */

export const PAGE_SIZE = 50;
export const DEFAULT_SORT = /** @type {SortState} */ ({ key: "totalQty", dir: "desc" });

/** 需求型態排序順序：由易預測到難預測 */
const PATTERN_SORT_WEIGHT = /** @type {Record<string, number>} */ ({
  smooth: 0,
  erratic: 1,
  intermittent: 2,
  lumpy: 3,
});

/**
 * @param {SkuResult} r
 * @param {SortKey} key
 * @param {number} dpp 每期天數，用於日均需求
 * @returns {number | string | null}
 */
export function sortValue(r, key, dpp) {
  switch (key) {
    case "dailyDemand":
      return r.meanDemand > 0 ? r.meanDemand / dpp : 0;
    case "demandPattern":
      return PATTERN_SORT_WEIGHT[r.demandPattern ?? ""] ?? null;
    case "trendPct":
    case "coverageDays":
    case "gap":
    case "adi":
    case "planStock":
    case "suggestedOrder":
      return r[key] ?? null;
    default:
      return r[key];
  }
}

/**
 * 排序比較函式；null 一律排最後（不受升降冪影響）。
 * @param {SortState} sort
 * @param {number} dpp
 * @returns {(a: SkuResult, b: SkuResult) => number}
 */
export function makeComparator(sort, dpp) {
  const dir = sort.dir === "asc" ? 1 : -1;
  return (a, b) => {
    const av = sortValue(a, sort.key, dpp);
    const bv = sortValue(b, sort.key, dpp);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av === bv) return 0;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  };
}

/**
 * @typedef {object} TableQuery
 * @property {StatusFilter} status
 * @property {string} site "all" 表示不篩選
 * @property {string} query 料號或品名的子字串（不分大小寫）
 * @property {SortState} sort
 */

/**
 * @param {SkuResult[]} results
 * @param {TableQuery} q
 * @param {number} dpp
 */
export function filterAndSort(results, q, dpp) {
  const text = q.query.trim().toLowerCase();
  const list = results.filter(
    (r) =>
      (q.site === "all" || r.site === q.site) &&
      (q.status === "all" || r.status === q.status) &&
      (!text || r.sku.toLowerCase().includes(text) || (r.name ?? "").toLowerCase().includes(text))
  );
  return list.sort(makeComparator(q.sort, dpp));
}

/**
 * 分倉模式依料號分組。組的順序：依總量排序時用組內總量，其餘用組內第一列的排序值。
 * @param {SkuResult[]} sorted 已排序的結果
 * @param {SortState} sort
 * @param {number} dpp
 * @returns {SkuGroup[]}
 */
export function groupBySku(sorted, sort, dpp) {
  /** @type {Map<string, SkuResult[]>} */
  const map = new Map();
  for (const r of sorted) {
    const items = map.get(r.sku);
    if (items) items.push(r);
    else map.set(r.sku, [r]);
  }
  const compare = makeComparator(sort, dpp);
  const groups = Array.from(map, ([sku, items]) => ({
    sku,
    name: items[0].name,
    abcClass: items[0].abcClass,
    isPriceMissing: items[0].isPriceMissing,
    totalQty: items.reduce((sum, r) => sum + r.totalQty, 0),
    items,
  }));
  return groups.sort((ga, gb) => {
    if (sort.key === "totalQty") return sort.dir === "asc" ? ga.totalQty - gb.totalQty : gb.totalQty - ga.totalQty;
    return compare(ga.items[0], gb.items[0]);
  });
}

/**
 * @param {SkuResult[]} results
 * @returns {Record<StatusFilter, number>}
 */
export function countByStatus(results) {
  const counts = { all: results.length, red: 0, green: 0, blue: 0, gray: 0 };
  for (const r of results) counts[r.status] += 1;
  return counts;
}

/** @param {SkuResult[]} results */
export function uniqueSites(results) {
  return Array.from(new Set(results.map((r) => r.site).filter(Boolean))).sort();
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} page 從 1 開始；超過總頁數時取最後一頁
 */
export function paginate(items, page) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * PAGE_SIZE;
  return { page: current, totalPages, start, slice: items.slice(start, start + PAGE_SIZE) };
}

/**
 * 點擊欄位標題：同一欄切換升降冪，換欄時從降冪開始。
 * @param {SortState} prev
 * @param {SortKey} key
 * @returns {SortState}
 */
export function nextSort(prev, key) {
  if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
  return { key, dir: "desc" };
}
