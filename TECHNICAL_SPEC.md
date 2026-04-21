# Safety Stock Automation — Technical Specification

> Version: 5.1.0 | Last Updated: 2026-04-21

---

## Architecture Overview

```
Browser ──→ Next.js 16 (Vercel) ──→ Flask API (Render)
             React 19 + TS              Python 3.10
             Tailwind CSS 4             Pandas + NumPy
```

- **Stateless API**: No database, no sessions. Each request is independent.
- **File lifecycle**: Upload → temp storage (UUID, 60min TTL) → calculate → export → discard.
- **Response convention**: All JSON keys converted to camelCase at the API boundary.

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Health check (version, modules) |
| `GET` | `/health` | Liveness probe |
| `GET` | `/api/material-groups` | Material master categories |
| `POST` | `/api/upload/<type>` | Upload file (sales/price/plan) |
| `POST` | `/api/calculate` | Run safety stock calculation |
| `POST` | `/api/export/excel` | Generate Excel download |
| `POST` | `/api/export/sap` | Generate SAP MM17 download |
| `POST` | `/api/ma-detail` | Moving average detail for single SKU |

---

## Calculation Engine

### Formulas

```
Safety Stock (SS) = Z × σ × √(LT / days_per_period)

  Z = service level Z-score (A:2.05, B:1.65, C:1.28)
  σ = demand standard deviation
  LT = lead time in days
  days_per_period = 30 (monthly) | 7 (weekly) | 1 (daily)

Reorder Point (ROP) = (mean_demand / days_per_period) × LT + SS

Max Inventory = ROP + lead_time_demand    [(s,S) policy]

CV = σ / μ    [coefficient of variation]
```

### Granularity

| Mode | Period | days_per_period | Use case |
|------|--------|-----------------|----------|
| `monthly` | Calendar month | 30 | Standard (LT ≥ 30 days) |
| `weekly` | ISO 8601 week | 7 | Medium cycle (LT 7-30 days) |
| `daily` | Calendar day | 1 | Fast replenishment (LT < 7 days) |

### Calculation Pipeline

```
1. _aggregate_data()          Group raw rows by site+SKU+period
2. _fill_missing_periods()    Fill gaps, exclude incomplete trailing period
3. _calculate_statistics()    MAD outlier detection → MA smoothing → mean/std
4. _perform_abc_classification()   Pareto analysis (value or quantity)
5. _calculate_safety_stock()  Apply formulas per SKU with per-category LT
```

### MAD Outlier Detection (v5.1.0)

```
1. Extract non-zero values from period series
2. If non_zero count < 3 OR MAD = 0 → skip detection
3. Compute median and MAD from non-zero values only
4. Bounds: median ± 3 × MAD × 1.4826
5. Flag values outside bounds (zero values never flagged)
6. Method B: replace outlier positions with 0, keep series length
7. Compute final mean/std from the full (cleaned) series
```

### ABC Classification (v5.1.0)

```
prev_cum_share logic:
  - Sort items by total_value (if price available) or total_qty
  - For each item: classify based on cumulative share BEFORE this item
    prev_cum < 0.80 → A
    prev_cum < 0.95 → B
    else → C
  - Single item → always A
  - No price file → classify all by quantity, mark isPriceMissing=true
```

### Per-Category Lead Time (v5.1.0)

```
Three-layer fallback:
  1. groupLeadTimes[group_id]         (e.g., "16120-235": 60)
  2. categoryLeadTimes[category_id]   (e.g., "16120": 45)
  3. options.lead_time_days           (global default: 30)

Material master: data/material_master.json (38,447 SKUs → 72 groups → 49 categories)
```

---

## Data Loader

### Sales File — Required Columns

| Column | Aliases (auto-detected) |
|--------|------------------------|
| `site` | 出貨點, 工廠, 倉庫, 倉別, 據點 |
| `sku` | 料號, 品號, 物料, 物料編號 |
| `date` | 出貨/退貨日期, 出貨日期, 交易日期, 銷貨日期, 日期 |
| `quantity` | 數量, 出貨數量, 銷貨數量, 銷售數量 |

### Optional Columns

| Column | Aliases |
|--------|---------|
| `name` | 品名, 產品名稱, 名稱 |
| `price` | 單價, 價格, 含稅單價 |
| `stock` | 庫存, 現有庫存 |

### Date Parsing

1. Try `pd.to_datetime()` (standard formats)
2. If >30% NaT: try Excel serial number conversion (origin 1899-12-30)
3. Fallback: row-by-row parsing
4. Auto-generates: `year_month` (YYYY-MM), `year_week` (YYYY-Www), `date_str` (YYYY-MM-DD)

### Return Handling

- Negative quantities (returns) are preserved, not filtered
- Aggregation naturally offsets returns against sales
- Net negative periods are clamped to 0 with a warning log

---

## Calculate Request

```typescript
POST /api/calculate
{
  salesFileId: string,          // required
  priceFileId?: string,         // optional
  planFileId?: string,          // optional
  params: {
    calcMode: "all" | "total" | "compare" | "single",
    granularity: "daily" | "weekly" | "monthly",
    selectedMonths: number[],   // [1-12], seasonal filter
    dateFrom?: string,          // "YYYY/MM/DD" or "YYYY-MM-DD"
    dateTo?: string,
    leadTime: number,           // 1-365 days
    minMonths: number,          // 0-12 minimum active periods
    enableOutlier: boolean,
    enableMa: boolean,
    maWindow: number,           // 2-12
    zScores: { A: number, B: number, C: number },
    abcThresholds: { A: number, B: number },
    targetSite?: string,        // for "single" mode only
    categoryLeadTimes?: Record<string, number>,
    groupLeadTimes?: Record<string, number>,
  }
}
```

---

## Calculate Response

### Single Mode (all / total)

```typescript
{
  success: true,
  mode: "all" | "total",
  version: "5.1.0",
  parameters: ParametersSnapshot,
  summary: CalculationSummary,
  results: SkuResult[],
  excluded: ExcludedSku[]
}
```

### Compare Mode

```typescript
{
  success: true,
  mode: "compare",
  version: "5.1.0",
  parameters: ParametersSnapshot,
  comparison: {
    totalAllSafetyStock: number,
    totalTotalSafetyStock: number,
    inventorySaved: number,
    savingsPercentage: number,
    totalAllValue: number,
    totalTotalValue: number,
    costSaved: number,
    savingsValuePercentage: number,
    allSkuCount: number,
    totalSkuCount: number
  },
  allSummary: { summary, results, excluded },
  totalSummary: { summary, results, excluded }
}
```

---

## SkuResult Fields

| Field | Type | Description |
|-------|------|-------------|
| `site` | string | Shipping point code |
| `sku` | string | Material number |
| `name` | string | Product description |
| `abcClass` | "A"\|"B"\|"C" | ABC classification |
| `status` | "red"\|"green"\|"blue"\|"gray" | Stock health |
| `totalQty` | number | Total demand quantity |
| `totalValue` | number | Total demand value |
| `activeMonths` | number | Periods with non-zero demand |
| `totalMonths` | number | Total periods analyzed |
| `meanDemand` | number | Average demand per period |
| `stdDev` | number | Standard deviation |
| `cv` | number | Coefficient of variation (σ/μ) |
| `safetyStock` | number | Calculated safety stock |
| `safetyStockValue` | number | SS × unit price |
| `reorderPoint` | number | ROP = LT demand + SS |
| `maxInventory` | number | Max = ROP + LT demand |
| `leadTimeDays` | number | Applied lead time (may differ per category) |
| `currentStock` | number\|null | Current stock (if available) |
| `outliersRemoved` | number | Count of outliers replaced with 0 |
| `price` | number | Unit price (0 if no price file) |
| `isPriceMissing` | boolean | True if classified by quantity instead of value |
| `monthlyValues` | number[] | Raw period demand series |

---

## Export

### Excel Export

```
POST /api/export/excel
Body: { mode, siteFilter?, granularity?, results/allSummary/totalSummary, comparison? }

Sheets (compare mode):
  1. 對比摘要 — comparison stats (inventory saved, cost saved)
  2. 分倉計算 — per-site results
  3. 總倉計算 — consolidated results

Column headers adapt to granularity:
  monthly → 活躍月數 / 月平均需求
  weekly  → 活躍周數 / 周平均需求
  daily   → 活躍天數 / 日平均需求
```

### SAP MM17 Export

```
POST /api/export/sap
Body: { mode, sapMode?, format, siteFilter?, results/allSummary/totalSummary }

Columns (fixed): MATNR | WERKS | EISBE
  MATNR = SKU code
  WERKS = site code (or "總倉" in total mode)
  EISBE = safety stock (integer)

Formats: xlsx, csv
Site filter: export only selected warehouse
```

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `NO_FILE` | 400 | No file in request |
| `INVALID_EXTENSION` | 400 | Only .xlsx/.xls allowed |
| `FILE_TOO_LARGE` | 413 | Exceeds 50MB |
| `PARSE_ERROR` | 400 | Excel parsing failed |
| `MISSING_SALES_FILE` | 400 | Sales file ID not found |
| `INVALID_PARAMS` | 400 | Parameter validation failed |
| `CALC_FAILED` | 500 | Calculation engine error |
| `NO_RESULTS` | 400 | No data for selected filter |
| `EXPORT_FAILED` | 500 | Export generation error |

---

## Frontend Components

### Page Structure

```
page.tsx
├── Cover (masthead)
├── WorkflowProvider (React Context)
│   ├── Section 01 · Sources
│   │   └── UploadsSection → 3× UploadCard
│   ├── Section 02 · Configuration
│   │   ├── ParametersForm
│   │   │   ├── CalcMode radios (compare/split/consolidated)
│   │   │   ├── Granularity radios (monthly/weekly/daily)
│   │   │   ├── ABC Z-score selectors
│   │   │   ├── Lead time + Min periods inputs
│   │   │   ├── MAD toggle + MA toggle + window slider
│   │   │   ├── Date range inputs (From/To)
│   │   │   ├── Seasonal filter (month checkboxes, collapsible)
│   │   │   ├── Category lead times (Advanced, collapsible)
│   │   │   └── Policy preview
│   │   └── CalculateBar (button + status)
│   └── Section 03 · Analysis
│       ├── AnalysisEmpty (placeholder)
│       ├── ResultsSummary (params snapshot + stat cards)
│       ├── ExportBar (Excel + SAP buttons + site selector)
│       └── ResultsTable
│           ├── StatusTabs (All/Shortage/Healthy/Overstock)
│           ├── SiteDropdown + SearchInput
│           ├── SkuGroup (grouped by SKU in split mode)
│           │   └── ExpandableResultRow → DemandDetail
│           └── Pagination
└── Footer (colophon)
```

### State Management

```typescript
// WorkflowContext (React Context + localStorage)
{
  uploads: { sales, price, plan },       // UploadResponse | null
  parameters: CalculateRequestParams,     // persisted to localStorage
  calculationResult: CalculationResponse,  // not persisted
  isCalculating: boolean,
  calculationError: string | null
}

// localStorage key: "ss-workflow:v1"
// Persists: uploads + parameters only
```

---

## Deployment

| Component | Platform | Branch | Auto-deploy |
|-----------|----------|--------|-------------|
| Frontend | Vercel | `main` | On push |
| Backend | Render (Free) | `feature/stateless-api` | On push |

### Environment Variables

**Vercel:**
- `NEXT_PUBLIC_API_URL` = `https://safety-stock-automation.onrender.com`

**Render:**
- `ALLOWED_ORIGINS` = `https://safety-stock-frontend.vercel.app`
- `SECRET_KEY` = (Flask secret)

### CORS

```python
Allowed origins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...ALLOWED_ORIGINS env var (comma-separated)
]
Resources: r"/*"
```

---

## E2E Tests (Playwright)

```
33 tests | ~1.5 min | Chromium

API Validation (12 tests):
  - Health check, material groups
  - Upload validation (metadata, reject invalid)
  - Calculation correctness (compare structure, formula verification)
  - Granularity (weekly, daily)
  - Category LT override
  - Error handling (invalid params, missing file)

UI Workflow (21 tests):
  - Upload flow (drag-drop, clear, reject non-Excel)
  - Parameter defaults and switching
  - Month selection toggle
  - Calculate button states
  - Compare + Split mode calculations
  - Status tab filtering, search, sort
  - Demand detail expand/collapse
  - Advanced panel toggle
  - localStorage persistence
  - Error display on backend failure
```

---

## Material Master

```
File: data/material_master.json (1 MB)
Source: SAP MARA export → convert_master.py
SKUs: 38,447
Categories: 49 (by group prefix)
Groups: 72 (material groups)
Update: Quarterly

Structure:
{
  version: "2026-04-17",
  categories: { [prefix]: { name, totalCount, groups: { [id]: { name, count } } } },
  mapping: { [sku]: group_id }
}

LT resolution: mapping[sku] → group_id → category_prefix → fallback to global
```

---

## Key Design Decisions

1. **Stateless API** — No database. All state lives in the browser (localStorage) or temp files (60min TTL). Simplifies deployment and scaling.

2. **camelCase boundary** — Backend uses snake_case internally, converts to camelCase at the JSON response boundary via `case_converter.py`.

3. **MAD over IQR** — MAD (Median Absolute Deviation) chosen for outlier detection because it's more robust than standard deviation for skewed demand distributions.

4. **Method B for outliers** — Replace outlier positions with 0 (not remove them) to preserve the time series length. This keeps mean/std calculations consistent with the actual number of periods.

5. **(s,S) inventory policy** — Max inventory = ROP + lead_time_demand when no explicit EOQ is provided. Standard continuous-review policy.

6. **Non-zero MAD** — Median and MAD computed from non-zero values only, preventing zero-demand periods from diluting the center estimate and causing false outlier detection.

7. **prev_cum_share for ABC** — Classification uses the cumulative share BEFORE the current item, ensuring the first item crossing the 80% threshold still gets classified as A.
