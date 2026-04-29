import path from "path";

// CI 和本機共用的 mock 測試資料（不含真實客戶資料）
export const SALES_FILE = path.resolve(__dirname, "test-sales.xlsx");

export const EXPECTED_SALES_META = {
  // mock 資料：50 SKUs x 3 sites，約 1008 筆
  recordCount: 1008,
  sites: ["1002", "1003", "1004"],
  skuCount: 50,
  dateRange: "2026-01 → 2026-04",
};

export const DEFAULT_PARAMS = {
  calcMode: "compare" as const,
  granularity: "monthly" as const,
  leadTime: 30,
  minMonths: 2,
  zScoreA: 2.05,
  zScoreB: 1.65,
  zScoreC: 1.28,
  selectedMonths: 12,
};
