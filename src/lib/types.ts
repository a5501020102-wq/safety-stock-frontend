/**
 * API contract for the Safety Stock Automation backend.
 *
 * Mirrors docs/API_CONTRACT.md in the backend repo. All keys are camelCase
 * because the backend does snake_case -> camelCase conversion at the
 * response boundary (`src/case_converter.py`).
 *
 * Source of truth: safety-stock-automation/docs/API_CONTRACT.md
 */

// ============================================================================
// Enums
// ============================================================================

export type CalcMode = "all" | "total" | "compare" | "single";
export type Granularity = "daily" | "weekly" | "monthly";
export type AbcClass = "A" | "B" | "C";
export type StockStatus = "red" | "green" | "blue" | "gray";
export type ExportFormat = "xlsx" | "csv";

// ============================================================================
// Core result types
// ============================================================================

export interface SkuResult {
  site: string;
  sku: string;
  name: string;
  abcClass: AbcClass;
  abcGrade: AbcClass;
  status: StockStatus;
  totalQty: number;
  totalValue: number;
  activeMonths: number;
  totalMonths: number;
  monthsCount: number;
  meanDemand: number;
  avgMonthlyDemand: number;
  stdDev: number;
  cv: number;
  safetyStock: number;
  safetyStockValue: number;
  reorderPoint: number;
  maxInventory: number;
  leadTimeDays: number;
  currentStock: number | null;
  outliersRemoved: number;
  price: number;
  enableMa: boolean;
  isPriceMissing?: boolean;
  monthlyValues: number[];
}

export interface ExcludedSku {
  site: string;
  sku: string;
  name: string | null;
  activeMonths: number;
  monthsCount: number;
  totalQty: number;
  reason: string;
}

export interface CalculationSummary {
  runDate: string;
  totalSkus: number;
  excludedCount: number;
  totalOutliersRemoved: number;
  shortageRiskCount: number;
  healthyCount: number;
  overstockRiskCount: number;
  noDataCount: number;
  movingAverageEnabled: boolean;
  maWindow: number | null;
  leadTimeDays: number;
  minMonths: number;
  calcMode: CalcMode;
}

export interface ComparisonStats {
  totalAllSafetyStock: number;
  totalTotalSafetyStock: number;
  inventorySaved: number;
  savingsPercentage: number;
  totalAllValue: number;
  totalTotalValue: number;
  costSaved: number;
  savingsValuePercentage: number;
  allSkuCount: number;
  totalSkuCount: number;
}

export interface ParametersSnapshot {
  calcMode: CalcMode;
  dataMinDate: string | null;
  dataMaxDate: string | null;
  dataMaxDateExact: string | null;
  excludedMonth: string | null;
  selectedMonths: number[];
  leadTimeDays: number;
  minMonths: number;
  zScores: { A: number; B: number; C: number };
  abcThresholds: { A: number; B: number };
  enableOutlier: boolean;
  enableMa: boolean;
  maWindow: number | null;
  granularity: Granularity;
  engineVersion: string;
  salesFilename: string | null;
  priceFilename: string | null;
  planFilename: string | null;
  executedAt: string;
  executionTimeMs: number;
}

// ============================================================================
// Upload responses
// ============================================================================

interface UploadBase {
  success: true;
  fileId: string;
  filename: string;
  fileSizeBytes: number;
  uploadedAt: string;
}

export interface UploadSalesResponse extends UploadBase {
  recordCount: number;
  detectedSites: string[];
  detectedSkus: number;
  dateRange: { start: string | null; end: string | null };
  maxDate: string | null;
  skippedDateCount: number;
  hasPriceData: boolean;
  hasStockData: boolean;
}

export interface UploadPriceResponse extends UploadBase {
  recordCount: number;
}

export interface UploadPlanResponse extends UploadBase {
  itemCount: number;
  detectedMonths: string[];
  hasCumulativeColumns: boolean;
}

export type UploadResponse =
  | UploadSalesResponse
  | UploadPriceResponse
  | UploadPlanResponse;

// ============================================================================
// Calculation responses
// ============================================================================

export interface CalculateRequestParams {
  calcMode: CalcMode;
  granularity?: Granularity;
  selectedMonths?: number[];
  leadTime?: number;
  minMonths?: number;
  enableOutlier?: boolean;
  enableMa?: boolean;
  maWindow?: number;
  zScores?: { A: number; B: number; C: number };
  abcThresholds?: { A: number; B: number };
  targetSite?: string | null;
  categoryLeadTimes?: Record<string, number>;
  groupLeadTimes?: Record<string, number>;
}

export interface MaterialCategory {
  name: string;
  totalCount: number;
  groups: Record<string, { name: string; count: number }>;
}

export interface MaterialGroupsResponse {
  success: true;
  available: boolean;
  version: string | null;
  totalSkus?: number;
  totalCategories?: number;
  categories: Record<string, MaterialCategory>;
}

export interface CalculateRequest {
  salesFileId: string;
  priceFileId?: string | null;
  planFileId?: string | null;
  params: CalculateRequestParams;
}

interface CalculateBaseResponse {
  success: true;
  version: string;
  parameters: ParametersSnapshot;
}

export interface SingleModeResponse extends CalculateBaseResponse {
  mode: "all" | "total";
  summary: CalculationSummary;
  results: SkuResult[];
  excluded: ExcludedSku[];
}

export interface CompareModeResponse extends CalculateBaseResponse {
  mode: "compare";
  comparison: ComparisonStats;
  allSummary: {
    summary: CalculationSummary;
    results: SkuResult[];
    excluded: ExcludedSku[];
  };
  totalSummary: {
    summary: CalculationSummary;
    results: SkuResult[];
    excluded: ExcludedSku[];
  };
}

export type CalculationResponse = SingleModeResponse | CompareModeResponse;

// ============================================================================
// Export
// ============================================================================

export interface ExcelExportRequest {
  mode: CalcMode;
  siteFilter?: string | null;
  summary?: CalculationSummary;
  results?: SkuResult[];
  comparison?: ComparisonStats;
  allSummary?: { summary: CalculationSummary; results: SkuResult[] };
  totalSummary?: { summary: CalculationSummary; results: SkuResult[] };
}

export interface SapExportRequest extends ExcelExportRequest {
  format: ExportFormat;
  sapMode?: "all" | "total";
  includeHeader?: boolean;
}

// ============================================================================
// MA Detail
// ============================================================================

export interface MaDetailRequest {
  site: string;
  sku: string;
  name?: string;
  abcClass?: AbcClass | "";
  monthlyData: Record<string, number>;
  meanDemand: number;
  stdDev: number;
  totalQty: number;
  activeMonths: number;
  outliersRemoved: number;
  maWindow: number;
}

export interface QuarterlySummary {
  months: string[];
  values: number[];
  avg: number;
  total: number;
  count: number;
}

export interface MaDetailResponse {
  success: true;
  site: string;
  sku: string;
  name: string;
  abcClass: AbcClass | "";
  monthlyData: Record<string, number>;
  quarterlySummary: Record<string, QuarterlySummary>;
  filledMonths: string[];
  statistics: {
    stdOriginal: number;
    mean: number;
    totalQty: number;
    activeMonths: number;
    outliersRemoved: number;
  };
  recommendation: {
    text: string;
    level: "info" | "warning" | "success";
  };
  maWindow: number;
}

// ============================================================================
// Error contract
// ============================================================================

export type ApiErrorCode =
  | "NO_FILE"
  | "EMPTY_FILENAME"
  | "INVALID_FILE_TYPE"
  | "INVALID_EXTENSION"
  | "FILE_TOO_LARGE"
  | "PARSE_ERROR"
  | "FILE_NOT_FOUND"
  | "MISSING_SALES_FILE"
  | "INVALID_PARAMS"
  | "CALC_FAILED"
  | "NO_RESULTS"
  | "EXPORT_FAILED"
  | "INVALID_EXPORT_FORMAT"
  | "MISSING_MONTHLY_VALUES"
  | "MA_COMPUTE_FAILED"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "BAD_REQUEST"
  | "INTERNAL_ERROR";

export interface ApiError {
  success: false;
  error: string;
  code: ApiErrorCode;
  detail?: string;
}
