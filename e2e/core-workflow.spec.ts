import { test, expect } from "@playwright/test";
import { HomePage } from "./pages/HomePage";
import { SALES_FILE } from "./fixtures/test-data";

test.describe("Core Workflow — Upload → Configure → Calculate → Results", () => {
  let home: HomePage;

  test.beforeEach(async ({ page }) => {
    home = new HomePage(page);
    await home.goto();
    await home.clearLocalStorage();
  });

  // =========================================================================
  // 1. File Upload
  // =========================================================================

  test("should upload sales file and display metadata", async () => {
    await home.uploadSalesFile(SALES_FILE);

    const area = home.salesUploadArea;
    await expect(area.locator("dd").filter({ hasText: /1,00[0-9]/ })).toBeVisible();
    await expect(area.locator("dd").filter({ hasText: /1002/ })).toBeVisible();
    await expect(area.locator("dd").filter({ hasText: /50/ })).toBeVisible();
    await expect(area.locator("dd").filter({ hasText: /2026-01/ })).toBeVisible();
  });

  test("should reject non-Excel files", async () => {
    const tempFile = "test-invalid.csv";
    const fs = await import("fs");
    fs.writeFileSync(tempFile, "a,b,c\n1,2,3");

    await home.salesFileInput.setInputFiles(tempFile);
    // UploadCard 拒絕訊息：「僅支援 .xlsx 或 .xls 檔案」
    await expect(home.salesUploadArea.locator("text=/僅支援.*xlsx.*xls/")).toBeVisible({
      timeout: 5_000,
    });

    fs.unlinkSync(tempFile);
  });

  test("should clear uploaded file", async () => {
    await home.uploadSalesFile(SALES_FILE);
    await expect(home.salesClearBtn).toBeVisible();
    await home.salesClearBtn.click();
    await expect(home.salesBrowseBtn).toBeVisible();
  });

  // =========================================================================
  // 2. Parameter Configuration
  // =========================================================================

  test("should display default parameters", async () => {
    await expect(home.calcModeCompare).toBeChecked();
    await expect(home.granularityMonthly).toBeChecked();
    await expect(home.leadTimeInput).toHaveValue("30");
    await expect(home.minMonthsInput).toHaveValue("2");
  });

  test("should switch calculation modes", async () => {
    await home.selectCalcMode("all");
    await expect(home.calcModeSplit).toBeChecked();

    const preview = await home.policyPreview.textContent();
    expect(preview).toContain("分倉");
  });

  test("should switch granularity", async () => {
    await home.selectGranularity("weekly");
    await expect(home.granularityWeekly).toBeChecked();

    const preview = await home.policyPreview.textContent();
    expect(preview).toContain("週");
  });

  test("should toggle months selection", async () => {
    // 季節性過濾在「進階」展開內
    const seasonalToggle = home.page.locator("button").filter({ hasText: /季節性過濾/ });
    if (await seasonalToggle.isVisible()) {
      await seasonalToggle.click();
    }

    await home.clearMonthsBtn.click();
    await expect(home.monthsCounter).toContainText("0 / 12");

    await home.selectAllMonthsBtn.click();
    await expect(home.monthsCounter).toContainText("12 / 12");
  });

  test("should validate lead time bounds (1-365)", async () => {
    await home.setLeadTime(0);
    const val = await home.leadTimeInput.inputValue();
    expect(Number(val)).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // 3. Calculate Button States
  // =========================================================================

  test("should disable calculate button when no sales file", async () => {
    await expect(home.calculateBtn).toBeDisabled();
  });

  test("should enable calculate button after upload", async () => {
    await home.uploadSalesFile(SALES_FILE);
    await expect(home.calculateBtn).toBeEnabled();
  });

  test("should disable calculate button when no months selected", async () => {
    await home.uploadSalesFile(SALES_FILE);

    const seasonalToggle = home.page.locator("button").filter({ hasText: /季節性過濾/ });
    if (await seasonalToggle.isVisible()) {
      await seasonalToggle.click();
    }

    await home.clearMonthsBtn.click();
    await expect(home.calculateBtn).toBeDisabled();
  });

  // =========================================================================
  // 4. Full Calculation (Compare Mode)
  // =========================================================================

  test("should complete compare mode calculation", async () => {
    await home.uploadSalesFile(SALES_FILE);
    await home.clickCalculate();
    await home.waitForResults();

    // Parameter snapshot should be visible
    await expect(home.parameterSnapshot).toBeVisible();

    // Should show two table blocks (Split + Consolidated)
    const tables = home.analysisSection.locator("table");
    const tableCount = await tables.count();
    expect(tableCount).toBe(2);

    // Snapshot should show correct values
    const mode = await home.getSnapshotValue("模式");
    expect(mode).toBeTruthy();

    const lt = await home.getSnapshotValue("前置期");
    expect(lt).toContain("30");
  });

  // =========================================================================
  // 5. Full Calculation (Split Mode)
  // =========================================================================

  test("should complete split mode calculation", async () => {
    await home.uploadSalesFile(SALES_FILE);
    await home.selectCalcMode("all");
    await home.clickCalculate();
    await home.waitForResults();

    const tables = home.analysisSection.locator("table");
    await expect(tables).toHaveCount(1);

    const mode = await home.getSnapshotValue("模式");
    expect(mode).toContain("分倉");
  });

  // =========================================================================
  // 6. Results Table Interaction
  // =========================================================================

  test("should filter results by status tab", async () => {
    await home.uploadSalesFile(SALES_FILE);
    await home.selectCalcMode("all");
    await home.clickCalculate();
    await home.waitForResults();

    const allCount = await home.getResultsRowCount();

    await home.statusTabShortage.click();
    const shortageCount = await home.getResultsRowCount();

    expect(shortageCount).toBeLessThanOrEqual(allCount);
  });

  test("should search SKUs", async () => {
    await home.uploadSalesFile(SALES_FILE);
    await home.selectCalcMode("all");
    await home.clickCalculate();
    await home.waitForResults();

    await home.searchInput.fill("235M202003151");
    await home.page.waitForTimeout(300);

    const count = await home.getResultsRowCount();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
  });

  test("should expand row to show demand detail", async () => {
    await home.uploadSalesFile(SALES_FILE);
    await home.selectCalcMode("total");
    await home.clickCalculate();
    await home.waitForResults();

    // In total mode, rows are flat (no grouping). Click first row.
    await home.clickResultRow(0);

    const detail = home.analysisSection.locator("text=各期需求");
    await expect(detail).toBeVisible();

    await home.clickResultRow(0);
    await expect(detail).not.toBeVisible();
  });

  test("should sort by column header", async () => {
    await home.uploadSalesFile(SALES_FILE);
    await home.selectCalcMode("all");
    await home.clickCalculate();
    await home.waitForResults();

    // Click 安全庫存 header to sort
    const safetyHeader = home.analysisSection.locator("th").filter({ hasText: "安全庫存" });
    await safetyHeader.click();

    // Should show sort indicator
    await expect(safetyHeader.locator(".text-accent")).toBeVisible();
  });

  // =========================================================================
  // 7. Granularity Changes Affect Results
  // =========================================================================

  test("should produce results with weekly granularity", async () => {
    await home.uploadSalesFile(SALES_FILE);
    await home.selectGranularity("weekly");
    await home.selectCalcMode("total");
    await home.clickCalculate();
    await home.waitForResults();

    const gran = await home.getSnapshotValue("粒度");
    expect(gran).toContain("週");
  });

  // =========================================================================
  // 8. Category Lead Times (Advanced Panel)
  // =========================================================================

  test("should open and close advanced panel", async () => {
    await home.page.waitForTimeout(2_000);

    if (await home.advancedToggle.isVisible()) {
      await home.advancedToggle.click();
      await expect(home.resetCategoryBtn).toBeVisible({ timeout: 3_000 });

      await home.advancedToggle.click();
      await expect(home.resetCategoryBtn).not.toBeVisible();
    }
  });

  // =========================================================================
  // 9. LocalStorage Persistence
  // =========================================================================

  test("should persist parameters across page reload", async () => {
    await home.setLeadTime(45);
    await home.selectGranularity("weekly");

    await home.page.reload();
    await home.page.waitForLoadState("networkidle");

    await expect(home.leadTimeInput).toHaveValue("45");
    await expect(home.granularityWeekly).toBeChecked();
  });

  // =========================================================================
  // 10. Error Handling
  // =========================================================================

  // =========================================================================
  // 11. Tab 切換與 URL hash 同步
  // =========================================================================

  test("should switch tabs via tab nav buttons", async ({ page }) => {
    // 三個 tab buttons (role="tab")，desktop tablist 內
    const tabs = page.getByRole("tablist", { name: "主要區段" }).getByRole("tab");
    await expect(tabs).toHaveCount(3);

    // 預設 sources 為 active
    const sourcesTab = tabs.filter({ hasText: "上傳" });
    await expect(sourcesTab).toHaveAttribute("aria-selected", "true");

    // 點「設定」分頁
    await tabs.filter({ hasText: "設定" }).click();
    await expect(tabs.filter({ hasText: "設定" })).toHaveAttribute("aria-selected", "true");
    await expect(sourcesTab).toHaveAttribute("aria-selected", "false");

    // 點「分析」分頁
    await tabs.filter({ hasText: "分析" }).click();
    await expect(tabs.filter({ hasText: "分析" })).toHaveAttribute("aria-selected", "true");
  });

  test("should sync URL hash with active tab", async ({ page }) => {
    // 點「設定」分頁 → URL hash 變 #configuration
    await page.getByRole("tablist", { name: "主要區段" }).getByRole("tab", { name: /設定/ }).click();
    await expect(page).toHaveURL(/#configuration$/);

    // 點「分析」→ #analysis
    await page.getByRole("tablist", { name: "主要區段" }).getByRole("tab", { name: /分析/ }).click();
    await expect(page).toHaveURL(/#analysis$/);

    // 重新整理頁面（hash 保留）→ 分析 tab 仍為 active
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("tablist", { name: "主要區段" }).getByRole("tab", { name: /分析/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("should show error when calculation fails", async ({ page }) => {
    await page.route("**/api/calculate", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Server error", code: "INTERNAL_ERROR" }),
      })
    );

    const h = new HomePage(page);
    await h.goto();
    await h.clearLocalStorage();
    await h.uploadSalesFile(SALES_FILE);
    await h.clickCalculate();

    // Error message should appear in the calculate bar area
    const errorArea = page.locator("section#configuration").locator('[class*="shortage"]');
    await expect(errorArea).toBeVisible({ timeout: 10_000 });
  });
});
