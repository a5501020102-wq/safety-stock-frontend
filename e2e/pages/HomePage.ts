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
    this.salesBrowseBtn = this.salesUploadArea.getByRole("button", { name: /browse files/i });
    this.salesFileInput = this.salesUploadArea.locator('input[type="file"]');
    this.salesClearBtn = this.salesUploadArea.getByRole("button", { name: /clear/i });

    // Calc mode radios
    this.calcModeCompare = page.locator('input[name="calcMode"][value="compare"]');
    this.calcModeSplit = page.locator('input[name="calcMode"][value="all"]');
    this.calcModeConsolidated = page.locator('input[name="calcMode"][value="total"]');

    // Granularity radios
    this.granularityMonthly = page.locator('input[name="granularity"][value="monthly"]');
    this.granularityWeekly = page.locator('input[name="granularity"][value="weekly"]');
    this.granularityDaily = page.locator('input[name="granularity"][value="daily"]');

    // Time inputs
    this.leadTimeInput = page.locator('label:has-text("Lead time")').locator("..").locator('input[type="number"]');
    this.minMonthsInput = page.locator('label:has-text("Minimum")').locator("..").locator('input[type="number"]');

    // Toggles
    this.madToggle = page.locator('label:has-text("MAD outlier")').locator("..").locator('button[role="switch"]');
    this.maToggle = page.locator('label:has-text("Moving average")').locator("..").locator('button[role="switch"]');
    this.maWindowSlider = page.locator('input[type="range"][min="2"][max="12"]');

    // Months
    this.selectAllMonthsBtn = page.getByRole("button", { name: /select all/i });
    this.clearMonthsBtn = page.locator("section#configuration").getByRole("button", { name: /^clear$/i });
    this.monthsCounter = page.locator("span.font-mono.tabular-nums").filter({ hasText: "/ 12" });

    // Advanced
    this.advancedToggle = page.locator("button").filter({ hasText: /Category lead times/i });
    this.resetCategoryBtn = page.getByRole("button", { name: /reset all to default/i });

    // Policy preview — the italic text below "Policy preview" label
    this.policyPreview = page.locator("section#configuration").locator("text=Policy preview").locator("+ p");

    // Calculate
    this.calculateBtn = page.locator("section#configuration button").filter({
      hasText: /calculate|recalculate|calculating/i,
    });
    this.calculateStatus = page.locator("section#configuration p.font-serif.italic.text-xl, section#configuration p.font-serif.italic.md\\:text-2xl").first();
    this.calculateError = page.locator('[class*="color-shortage"]').filter({ hasText: /\[/ });

    // Analysis
    this.analysisSection = page.locator("section#analysis");
    this.parameterSnapshot = this.analysisSection.locator("dl").first();

    // Status tabs
    this.statusTabAll = this.analysisSection.getByRole("button", { name: /every sku/i });
    this.statusTabShortage = this.analysisSection.getByRole("button", { name: /below safety/i });
    this.statusTabHealthy = this.analysisSection.getByRole("button", { name: /within range/i });
    this.statusTabOverstock = this.analysisSection.getByRole("button", { name: /above/i });

    // Table controls
    this.searchInput = this.analysisSection.locator('input[type="search"]');
    this.siteFilter = this.analysisSection.locator("select").first();
  }

  // --- Actions ---

  async goto() {
    await this.page.goto("/");
    await this.page.waitForLoadState("networkidle");
  }

  async clearLocalStorage() {
    await this.page.evaluate(() => localStorage.clear());
    await this.page.reload();
    await this.page.waitForLoadState("networkidle");
  }

  async uploadSalesFile(filePath: string) {
    await this.salesFileInput.setInputFiles(filePath);
    await this.page.waitForResponse((r) => r.url().includes("/api/upload/sales") && r.ok());
    // Wait for metadata display (dt/dd pairs show file info)
    await expect(this.salesUploadArea.locator("dd").first()).toBeVisible({ timeout: 15_000 });
  }

  async clickCalculate() {
    await expect(this.calculateBtn).toBeEnabled();
    await this.calculateBtn.click();
  }

  async waitForResults() {
    await this.page.waitForResponse(
      (r) => r.url().includes("/api/calculate") && r.ok(),
      { timeout: 30_000 }
    );
    await expect(this.analysisSection.locator("table").first()).toBeVisible({ timeout: 10_000 });
  }

  async setLeadTime(days: number) {
    await this.leadTimeInput.fill(String(days));
  }

  async setMinMonths(months: number) {
    await this.minMonthsInput.fill(String(months));
  }

  async selectCalcMode(mode: "compare" | "all" | "total") {
    const label = this.page.locator(`label:has(input[name="calcMode"][value="${mode}"])`);
    await label.click();
  }

  async selectGranularity(gran: "monthly" | "weekly" | "daily") {
    const label = this.page.locator(`label:has(input[name="granularity"][value="${gran}"])`);
    await label.click();
  }

  async toggleMonth(monthName: string) {
    await this.page.locator(`label`).filter({ hasText: new RegExp(`^\\d+\\s*${monthName}$`, "i") }).click();
  }

  async getResultsRowCount(): Promise<number> {
    return this.analysisSection.locator("table tbody tr").count();
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
