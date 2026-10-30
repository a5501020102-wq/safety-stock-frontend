// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createStore, watch } from "../js/state/store.js";
import {
  STORAGE_KEY,
  createWorkflowStore,
  daysPerPeriod,
  defaultParameters,
  loadPersisted,
  setParameters,
} from "../js/state/workflow.js";
import { summarizePolicy } from "../js/utils/policy.js";
import { parseContentDispositionFilename } from "../js/api/client.js";
import { calculateReadiness } from "../js/components/calculate-bar.js";
import { weeksBetween } from "../js/components/week-range.js";
import { formatBytes, formatNumber } from "../js/utils/format.js";

/** 以 Map 模擬 localStorage */
function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return /** @type {Storage} */ (
    /** @type {unknown} */ ({
      getItem: (/** @type {string} */ k) => data.get(k) ?? null,
      setItem: (/** @type {string} */ k, /** @type {string} */ v) => data.set(k, v),
      data,
    })
  );
}

test("store：watch 只在選取值改變時通知", () => {
  const store = createStore({ a: 1, b: 1 });
  /** @type {number[]} */
  const seen = [];
  watch(
    store,
    (s) => s.a,
    (a) => seen.push(a)
  );
  store.set({ b: 2 });
  store.set({ a: 3 });
  assert.deepEqual(seen, [1, 3]);
});

test("工作流程狀態：參數與上傳寫入 localStorage（key 不可變）", () => {
  const storage = memoryStorage();
  const store = createWorkflowStore(storage, "sources");
  setParameters(store, { leadTime: 45 });
  const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}");
  assert.equal(STORAGE_KEY, "ss-workflow:v1");
  assert.equal(saved.parameters.leadTime, 45);
  assert.deepEqual(Object.keys(saved).sort(), ["parameters", "uploads"]);
});

test("工作流程狀態：舊版暫存與預設值合併，損毀資料視為無暫存", () => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ parameters: { leadTime: 60 } }) });
  const store = createWorkflowStore(storage, "analysis");
  assert.equal(store.get().parameters.leadTime, 60);
  assert.equal(store.get().parameters.minMonths, defaultParameters().minMonths);
  assert.equal(store.get().activeTab, "analysis");
  assert.deepEqual(loadPersisted(memoryStorage({ [STORAGE_KEY]: "{not json" })), {});
});

test("每期天數：月粒度可被工作天覆寫，其他粒度不受影響", () => {
  assert.equal(daysPerPeriod("monthly", null), 30);
  assert.equal(daysPerPeriod("monthly", 22), 22);
  assert.equal(daysPerPeriod("weekly", 22), 7);
  assert.equal(daysPerPeriod("daily", undefined), 1);
});

test("計算政策預覽", () => {
  const text = summarizePolicy({
    ...defaultParameters(),
    calcMode: "all",
    granularity: "weekly",
    enableMa: true,
    maWindow: 4,
  });
  assert.equal(text, "分倉 · 週 · 前置期 30 天 · 最少 2 期 · Z(2.05/1.65/1.28) · 已選 12/12 個月，移動平均(4)");
});

test("能否計算：缺銷貨檔、未選月份、計算中", () => {
  const base = {
    uploads: { sales: null, price: null, plan: null },
    parameters: defaultParameters(),
    calculationResult: null,
    isCalculating: false,
    calculationError: null,
    activeTab: /** @type {const} */ ("sources"),
  };
  assert.equal(calculateReadiness(base).reason, "請先上傳銷貨明細。");
  const withSales = { ...base, uploads: { ...base.uploads, sales: /** @type {any} */ ({ fileId: "x" }) } };
  assert.equal(calculateReadiness(withSales).canCalculate, true);
  const noMonths = { ...withSales, parameters: { ...base.parameters, selectedMonths: [] } };
  assert.equal(calculateReadiness(noMonths).canCalculate, false);
  const withDates = {
    ...noMonths,
    parameters: { ...noMonths.parameters, dateFrom: "2025-01-01", dateTo: "2025-12-31" },
  };
  assert.equal(calculateReadiness(withDates).canCalculate, true);
  assert.equal(calculateReadiness({ ...withSales, isCalculating: true }).canCalculate, false);
});

test("下載檔名解析", () => {
  assert.equal(
    parseContentDispositionFilename("attachment; filename=sap_mm17_all_20261029.xlsx"),
    "sap_mm17_all_20261029.xlsx"
  );
  assert.equal(parseContentDispositionFilename("attachment; filename*=UTF-8''%E5%AE%89%E5%85%A8.xlsx"), "安全.xlsx");
  assert.equal(parseContentDispositionFilename(null), "download");
});

test("週別範圍：起迄順序不拘，找不到時為 null", () => {
  const weeks = ["2025-W01", "2025-W02", "2025-W03"];
  assert.deepEqual(weeksBetween(weeks, "2025-W03", "2025-W02"), ["2025-W02", "2025-W03"]);
  assert.equal(weeksBetween(weeks, "2024-W52", "2025-W02"), null);
});

test("數字格式", () => {
  assert.equal(formatNumber(1234.5, 1), "1,234.5");
  assert.equal(formatNumber(null), "—");
  assert.equal(formatBytes(2048), "2.0 KB");
});
