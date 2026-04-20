import path from "path";

export const SALES_FILE = path.resolve(
  __dirname,
  "../../../data/2026_01_01_2026_04_e.g電線.xlsx"
);

export const EXPECTED_SALES_META = {
  recordCount: 2741,
  sites: ["1002", "1003", "1004"],
  skuCount: 333,
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
