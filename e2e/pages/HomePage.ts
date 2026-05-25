import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page Object Model for the Safety Stock single-page application.
 *
 * Sections:
 *   - Sources (upload)
 *   - Configuration (parameters)
 *   - Analysis (results)
 */
export class HomePage {
  readonly page: Page;

  // --- Section: Sources ---
  readonly salesUploadArea: Locator;
  readonly salesBrowseBtn: Locator;
  readonly salesFileInput: Locator;
  readonly salesClearBtn: Locator;

  // --- Section: Configuration ---
  readonly calcModeCompare: Locator;
  readonly calcModeSplit: Locator;
  readonly calcModeConsolidated: Locator;

  readonly granularityMonthly: Locator;
  readonly granularityWeekly: Locator;
  readonly granularityDaily: Locator;

  readonly leadTimeInput: Locator;
  readonly minMonthsInput: Locator;

  readonly madToggle: Locator;
  readonly maToggle: Locator;
  readonly maWindowSlider: Locator;

  readonly selectAllMonthsBtn: Locator;
  readonly clearMonthsBtn: Locator;
  readonly monthsCounter: Locator;

  readonly advancedToggle: Locator;
  readonly resetCategoryBtn: Locator;

  readonly policyPreview: Locator;

  // --- Section: Calculate ---
  readonly calculateBtn: Locator;
  readonly calculateStatus: Locator;
  readonly calculateError: Locator;

  // --- Section: Analysis ---
  readonly analysisSection: Locator;
  readonly parameterSnapshot: Locator;

  readonly statusTabAll: Locator;
  readonly statusTabShortage: Locator;
  readonly statusTabHealthy: Locator;
  readonly statusTabOverstock: Locator;

  readonly searchInput: Locator;
  readonly siteFilter: Locator;

  constructor(page: Page) {
    this.page = page;

    // Sources
    this.salesUploadArea = page.locator("section#sources article").first();
    this.salesBrowseBtn = this.salesUploadArea.getByRole("button", { name: /選擇檔案/ });
    this.salesFileInput = this.salesUploadArea.locator('input[type="file"]');
    this.salesClearBtn = this.salesUploadArea.getByRole("button", { name: /清除/ });

    // Calc mode radios
    this.calcModeCompare = page.locator('input[name="calcMode"][value="compare"]');
    this.calcModeSplit = page.locator('input[name="calcMode"][value="all"]');
    this.calcModeConsolidated = page.locator('input[name="calcMode"][value="total"]');

    // Granularity radios
    this.granularityMonthly = page.locator('input[name="granularity"][value="monthly"]');
    this.granularityWeekly = page.locator('input[name="granularity"][value="weekly"]');
    this.granularityDaily = page.locator('input[name="granularity"][value="daily"]');

    // Time inputs（label 內含「前置期」「最少月份/期數」）
    this.leadTimeInput = page.locator('label:has-text("前置期")').locator("..").locator('input[type="number"]');
    this.minMonthsInput = page.locator('label:has-text("最少")').locator("..").locator('input[type="number"]');

    // Toggles（label 內含「MAD 離群值」「移動平均」）
    this.madToggle = page.locator('label:has-text("MAD 離群值")').locator("..").locator('button[role="switch"]');
    this.maToggle = page.locator('label:has-text("移動平均")').locator("..").locator('button[role="switch"]');
    this.maWindowSlider = page.locator('input[type="range"][min="2"][max="12"]');

    // Months
    this.selectAllMonthsBtn = page.getByRole("button", { name: /^全選$/ });
    this.clearMonthsBtn = page.locator("section#configuration").getByRole("button", { name: /^清除$/ });
    this.monthsCounter = page.locator("span.font-mono.tabular-nums").filter({ hasText: "/ 12" });

    // Advanced — 分類前置期 toggle
    this.advancedToggle = page.locator("button").filter({ hasText: /分類前置期/ });
    this.resetCategoryBtn = page.getByRole("button", { name: /全部重設為預設值/ });

    // Policy preview — 「計算政策預覽」label 下方的敘述段落
    this.policyPreview = page.locator("section#configuration").locator("text=計算政策預覽").locator("+ p");

    // Calculate button — 中文「計算 / 重新計算 / 計算中」
    // configuration tab 內含「計算」的 button 僅 CalculateBar 一個，無歧義。
    this.calculateBtn = page.locator("section#configuration button").filter({
      hasText: /計算/,
    });
    // CalculateBar 的 reason 訊息（顯示「請先上傳銷貨明細。」「計算中…」「已有結果」等）
    // 結構：<p className="mt-3 font-serif text-xl ...">{reason}</p>，是 configuration 內唯一的 p.font-serif.text-xl
    this.calculateStatus = page.locator("section#configuration p.font-serif.text-xl").first();
    this.calculateError = page.locator('[class*="color-shortage"]').filter({ hasText: /\[/ });

    // Analysis
    this.analysisSection = page.locator("section#analysis");
    this.parameterSnapshot = this.analysisSection.locator("dl").first();

    // Status tabs — STATUS_FILTERS description 文字
    this.statusTabAll = this.analysisSection.getByRole("button", { name: /所有料號/ });
    this.statusTabShortage = this.analysisSection.getByRole("button", { name: /低於安全庫存/ });
    this.statusTabHealthy = this.analysisSection.getByRole("button", { name: /範圍內/ });
    this.statusTabOverstock = this.analysisSection.getByRole("button", { name: /超過 3 倍/ });

    // Table controls
    this.searchInput = this.analysisSection.locator('input[type="search"]');
    this.siteFilter = this.analysisSection.locator("select").first();
  }

  // --- Actions ---

  async goto() {
    await this.page.goto("/");
    // 改用 "load"：Next.js 16 dev/prod build 有持續 network activity
    // （prefetch、background fetch），networkidle 在 CI 易卡 30s timeout
    await this.page.waitForLoadState("load");
  }

  async clearLocalStorage() {
    await this.page.evaluate(() => localStorage.clear());
    await this.page.reload();
    await this.page.waitForLoadState("load");
  }

  /**
   * 確保指定 tab 為 active（panel visible）。
   * Tab 重構後，configuration / analysis tab 預設不可見（display:none），
   * 點擊內部元素前必須先切 tab。
   * 如果已經 active 則跳過點擊（避免無謂 click）。
   */
  async activateTab(id: "sources" | "configuration" | "analysis") {
    const panel = this.page.locator(`section#${id}`);
    const isActive = await panel.evaluate((el) => el.classList.contains("tab-panel-active"));
    if (isActive) return;
    // Desktop tab nav 用 tab id（tab-sources / tab-configuration / tab-analysis）
    await this.page.locator(`button#tab-${id}`).click();
    // 等 panel 切到 active class（fade-in 動畫 400ms）
    await expect(panel).toHaveClass(/tab-panel-active/, { timeout: 5_000 });
  }

  async uploadSalesFile(filePath: string) {
    await this.salesFileInput.setInputFiles(filePath);
    await this.page.waitForResponse((r) => r.url().includes("/api/upload/sales") && r.ok());
    // Wait for metadata display (dt/dd pairs show file info)
    await expect(this.salesUploadArea.locator("dd").first()).toBeVisible({ timeout: 15_000 });
  }

  async clickCalculate() {
    await this.activateTab("configuration");
    await expect(this.calculateBtn).toBeEnabled();
    await this.calculateBtn.click();
  }

  async waitForResults() {
    await this.page.waitForResponse((r) => r.url().includes("/api/calculate") && r.ok(), { timeout: 30_000 });
    await expect(this.analysisSection.locator("table").first()).toBeVisible({ timeout: 10_000 });
  }

  async setLeadTime(days: number) {
    await this.activateTab("configuration");
    await this.leadTimeInput.fill(String(days));
  }

  async setMinMonths(months: number) {
    await this.activateTab("configuration");
    await this.minMonthsInput.fill(String(months));
  }

  async selectCalcMode(mode: "compare" | "all" | "total") {
    await this.activateTab("configuration");
    const label = this.page.locator(`label:has(input[name="calcMode"][value="${mode}"])`);
    await label.click();
  }

  async selectGranularity(gran: "monthly" | "weekly" | "daily") {
    await this.activateTab("configuration");
    const label = this.page.locator(`label:has(input[name="granularity"][value="${gran}"])`);
    await label.click();
  }

  async toggleMonth(monthName: string) {
    await this.activateTab("configuration");
    await this.page
      .locator(`label`)
      .filter({ hasText: new RegExp(`^\\d+\\s*${monthName}$`, "i") })
      .click();
  }

  async getResultsRowCount(): Promise<number> {
    // 排除 detail row（永久 render 但 collapsed 時被 max-height:0 截斷不可見）
    return this.analysisSection.locator("table tbody tr:not([data-row-detail])").count();
  }

  async getFirstResultRow() {
    const row = this.analysisSection.locator("table tbody tr").first();
    return {
      sku: await row.locator("td").nth(1).textContent(),
      safetyStock: await row.locator("td").nth(7).textContent(),
    };
  }

  async clickResultRow(index: number) {
    await this.analysisSection.locator("table tbody tr").nth(index).click();
  }

  async getSnapshotValue(label: string): Promise<string | null> {
    const dt = this.parameterSnapshot.locator("dt", { hasText: label });
    const dd = dt.locator("+ dd");
    return dd.textContent();
  }
}
