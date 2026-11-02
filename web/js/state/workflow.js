// @ts-check
/**
 * 跨區段共用的工作流程狀態：上傳檔案、計算參數、最近一次計算結果。
 *
 * 只把上傳中繼資料與參數存進 localStorage（key: ss-workflow:v1，與舊版前端相同，
 * 改了會讓所有使用者的暫存失效）；計算結果不保存，重新整理後需重新計算。
 */

import { createStore } from "./store.js";

/** @typedef {import("../api/types").CalculateRequestParams} CalculateRequestParams */
/** @typedef {import("../api/types").CalculationResponse} CalculationResponse */
/** @typedef {import("../api/types").UploadSalesResponse} UploadSalesResponse */
/** @typedef {import("../api/types").UploadPriceResponse} UploadPriceResponse */
/** @typedef {import("../api/types").UploadPlanResponse} UploadPlanResponse */
/** @typedef {"sources" | "configuration" | "analysis"} TabId */

/**
 * @typedef {object} Uploads
 * @property {UploadSalesResponse | null} sales
 * @property {UploadPriceResponse | null} price
 * @property {UploadPlanResponse | null} plan
 */

/**
 * @typedef {object} WorkflowState
 * @property {Uploads} uploads
 * @property {CalculateRequestParams} parameters
 * @property {CalculationResponse | null} calculationResult
 * @property {boolean} isCalculating
 * @property {string | null} calculationError
 * @property {TabId} activeTab
 */

export const STORAGE_KEY = "ss-workflow:v1";

export const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const DEFAULT_LEAD_TIME = 30;
export const DEFAULT_MIN_MONTHS = 2;
export const DEFAULT_MA_WINDOW = 3;
// Z 值：A=2.05（約 98%）、B=1.65（約 95%）、C=1.28（約 90%）服務水準
export const DEFAULT_Z_SCORES = Object.freeze({ A: 2.05, B: 1.65, C: 1.28 });
// 月粒度的每月天數預設為日曆天 30；與後端 Granularity.MONTHLY.days_per_period 一致
export const CALENDAR_DAYS_PER_MONTH = 30;

/** @returns {CalculateRequestParams} */
export function defaultParameters() {
  return {
    calcMode: "compare",
    granularity: "monthly",
    selectedMonths: [...ALL_MONTHS],
    dateFrom: null,
    dateTo: null,
    leadTime: DEFAULT_LEAD_TIME,
    minMonths: DEFAULT_MIN_MONTHS,
    enableOutlier: true,
    enableMa: false,
    maWindow: DEFAULT_MA_WINDOW,
    zScores: { ...DEFAULT_Z_SCORES },
    // ABC 累計占比門檻：前 80% 為 A、80-95% 為 B
    abcThresholds: { A: 0.8, B: 0.95 },
    targetSite: null,
    trendMode: "none",
    workingDaysPerMonth: null,
  };
}

/** @returns {Uploads} */
function emptyUploads() {
  return { sales: null, price: null, plan: null };
}

/**
 * @param {Storage | undefined} storage
 * @returns {{ uploads?: Uploads, parameters?: Partial<CalculateRequestParams> }}
 */
export function loadPersisted(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    // 資料損毀或 storage 被停用時，視為沒有暫存
    return {};
  }
}

/**
 * @param {Storage | undefined} storage
 * @param {{ uploads: Uploads, parameters: CalculateRequestParams }} payload
 */
function savePersisted(storage, payload) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // storage 已滿或被停用，不影響使用
  }
}

/**
 * @param {Storage | undefined} storage
 * @param {TabId} initialTab
 */
export function createWorkflowStore(storage, initialTab) {
  const persisted = loadPersisted(storage);
  const store = createStore(
    /** @type {WorkflowState} */ ({
      uploads: { ...emptyUploads(), ...persisted.uploads },
      parameters: { ...defaultParameters(), ...persisted.parameters },
      calculationResult: null,
      isCalculating: false,
      calculationError: null,
      activeTab: initialTab,
    })
  );

  store.subscribe((state, prev) => {
    if (state.uploads !== prev.uploads || state.parameters !== prev.parameters) {
      savePersisted(storage, { uploads: state.uploads, parameters: state.parameters });
    }
  });
  return store;
}

/** @typedef {ReturnType<typeof createWorkflowStore>} WorkflowStore */

/**
 * 部分更新計算參數。
 * @param {WorkflowStore} store
 * @param {Partial<CalculateRequestParams>} patch
 */
export function setParameters(store, patch) {
  store.set((s) => ({ parameters: { ...s.parameters, ...patch } }));
}

/**
 * @param {WorkflowStore} store
 * @param {keyof Uploads} slot
 * @param {Uploads[keyof Uploads]} value
 */
export function setUpload(store, slot, value) {
  store.set((s) => ({ uploads: { ...s.uploads, [slot]: value } }));
}

/**
 * 依粒度決定每期天數；月粒度可被「每月工作天」覆寫。與後端 resolve_days_per_period 相同規則。
 * @param {import("../api/types").Granularity | undefined} granularity
 * @param {number | null | undefined} workingDaysPerMonth
 */
export function daysPerPeriod(granularity, workingDaysPerMonth) {
  if (granularity === "daily") return 1;
  if (granularity === "weekly") return 7;
  return workingDaysPerMonth || CALENDAR_DAYS_PER_MONTH;
}
