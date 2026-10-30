// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SORT,
  PAGE_SIZE,
  countByStatus,
  filterAndSort,
  groupBySku,
  makeComparator,
  nextSort,
  paginate,
  sortValue,
  uniqueSites,
} from "../js/utils/results.js";

/**
 * @param {Partial<import("../js/api/types").SkuResult>} fields
 * @returns {import("../js/api/types").SkuResult}
 */
function row(fields) {
  return /** @type {any} */ ({
    site: "1002",
    sku: "A",
    name: "",
    status: "green",
    totalQty: 0,
    meanDemand: 0,
    ...fields,
  });
}

const MONTHLY_DPP = 30;
const allQuery = { status: /** @type {const} */ ("all"), site: "all", query: "", sort: DEFAULT_SORT };

test("日均需求 = 平均 / 每期天數；平均為 0 時為 0", () => {
  assert.equal(sortValue(row({ meanDemand: 300 }), "dailyDemand", MONTHLY_DPP), 10);
  assert.equal(sortValue(row({ meanDemand: 0 }), "dailyDemand", MONTHLY_DPP), 0);
});

test("需求型態依預測難度排序，未分類為 null", () => {
  assert.equal(sortValue(row({ demandPattern: "smooth" }), "demandPattern", MONTHLY_DPP), 0);
  assert.equal(sortValue(row({ demandPattern: "lumpy" }), "demandPattern", MONTHLY_DPP), 3);
  assert.equal(sortValue(row({ demandPattern: "—" }), "demandPattern", MONTHLY_DPP), null);
});

test("null 不論升降冪都排最後", () => {
  const rows = [row({ sku: "x", trendPct: null }), row({ sku: "y", trendPct: 5 }), row({ sku: "z", trendPct: -2 })];
  for (const dir of /** @type {const} */ (["asc", "desc"])) {
    const sorted = [...rows].sort(makeComparator({ key: "trendPct", dir }, MONTHLY_DPP));
    assert.equal(sorted.at(-1)?.sku, "x");
  }
});

test("篩選：出貨點、狀態、料號或品名（不分大小寫）", () => {
  const rows = [
    row({ sku: "ABC-1", name: "PVC 管", site: "1002", status: "red" }),
    row({ sku: "XYZ-2", name: "彎頭", site: "1003", status: "green" }),
  ];
  assert.deepEqual(
    filterAndSort(rows, { ...allQuery, query: "abc" }, MONTHLY_DPP).map((r) => r.sku),
    ["ABC-1"]
  );
  assert.deepEqual(
    filterAndSort(rows, { ...allQuery, query: "彎" }, MONTHLY_DPP).map((r) => r.sku),
    ["XYZ-2"]
  );
  assert.deepEqual(
    filterAndSort(rows, { ...allQuery, status: "red" }, MONTHLY_DPP).map((r) => r.sku),
    ["ABC-1"]
  );
  assert.deepEqual(
    filterAndSort(rows, { ...allQuery, site: "1003" }, MONTHLY_DPP).map((r) => r.sku),
    ["XYZ-2"]
  );
});

test("分組：依總量排序時以組內總量排；其他欄位以組內第一列排", () => {
  const sorted = [
    row({ sku: "A", site: "1002", totalQty: 10, safetyStock: 50 }),
    row({ sku: "B", site: "1002", totalQty: 8, safetyStock: 5 }),
    row({ sku: "B", site: "1003", totalQty: 8, safetyStock: 4 }),
  ];
  const byQty = groupBySku(sorted, { key: "totalQty", dir: "desc" }, MONTHLY_DPP);
  assert.deepEqual(
    byQty.map((g) => [g.sku, g.totalQty]),
    [
      ["B", 16],
      ["A", 10],
    ]
  );

  const bySs = groupBySku(sorted, { key: "safetyStock", dir: "desc" }, MONTHLY_DPP);
  assert.deepEqual(
    bySs.map((g) => g.sku),
    ["A", "B"]
  );
  assert.equal(bySs[1].items.length, 2);
});

test("狀態計數與出貨點清單", () => {
  const rows = [
    row({ status: "red", site: "1003" }),
    row({ status: "red", site: "1002" }),
    row({ status: "gray", site: "" }),
  ];
  assert.deepEqual(countByStatus(rows), { all: 3, red: 2, green: 0, blue: 0, gray: 1 });
  assert.deepEqual(uniqueSites(rows), ["1002", "1003"]);
});

test("分頁：超出總頁數時取最後一頁", () => {
  const items = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => i);
  const last = paginate(items, 99);
  assert.equal(last.page, 2);
  assert.equal(last.totalPages, 2);
  assert.deepEqual(last.slice, [PAGE_SIZE]);
  assert.equal(paginate([], 1).totalPages, 1);
});

test("點擊欄位標題：同欄切換方向，換欄從降冪開始", () => {
  assert.deepEqual(nextSort({ key: "sku", dir: "desc" }, "sku"), { key: "sku", dir: "asc" });
  assert.deepEqual(nextSort({ key: "sku", dir: "asc" }, "cv"), { key: "cv", dir: "desc" });
});
