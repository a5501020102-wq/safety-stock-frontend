import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const API = process.env.E2E_API_URL ?? "http://localhost:5000";
const SALES_FILE = path.resolve(__dirname, "fixtures/test-sales.xlsx");

test.describe("API Validation — Backend Calculation Correctness", () => {
  let salesFileId: string;

  test.beforeAll(async ({ request }) => {
    // Upload sales file once for all tests
    const fileBuffer = fs.readFileSync(SALES_FILE);
    const resp = await request.post(`${API}/api/upload/sales`, {
      multipart: {
        file: {
          name: "test-sales.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: fileBuffer,
        },
      },
    });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    expect(data.success).toBe(true);
    salesFileId = data.fileId;
  });

  // =========================================================================
  // Health Check
  // =========================================================================

  test("GET / should return API info", async ({ request }) => {
    const resp = await request.get(`${API}/`);
    const data = await resp.json();
    expect(data.version).toBe("5.1.0");
    expect(data.modulesAvailable).toBe(true);
  });

  test("GET /api/material-groups should return categories", async ({ request }) => {
    const resp = await request.get(`${API}/api/material-groups`);
    const data = await resp.json();
    expect(data.success).toBe(true);
    if (data.available) {
      expect(data.totalSkus).toBeGreaterThan(30000);
      expect(Object.keys(data.categories).length).toBeGreaterThan(10);
    }
  });

  // =========================================================================
  // Upload Validation
  // =========================================================================

  test("upload should return correct metadata", async ({ request }) => {
    const fileBuffer = fs.readFileSync(SALES_FILE);
    const resp = await request.post(`${API}/api/upload/sales`, {
      multipart: {
        file: {
          name: "test.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: fileBuffer,
        },
      },
    });
    const data = await resp.json();

    expect(data.success).toBe(true);
    expect(data.recordCount).toBeGreaterThan(2700);
    expect(data.detectedSites).toContain("1002");
    expect(data.detectedSkus).toBeGreaterThan(300);
    expect(data.dateRange.start).toBe("2026-01");
  });

  test("upload should reject missing file", async ({ request }) => {
    const resp = await request.post(`${API}/api/upload/sales`, {
      multipart: {},
    });
    expect(resp.ok()).toBeFalsy();
  });

  // =========================================================================
  // Calculation — Compare Mode
  // =========================================================================

  test("compare mode should return split and consolidated results", async ({ request }) => {
    const resp = await request.post(`${API}/api/calculate`, {
      data: {
        salesFileId,
        params: {
          calcMode: "compare",
          granularity: "monthly",
          selectedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          leadTime: 30,
          minMonths: 2,
          enableOutlier: true,
          enableMa: false,
          zScores: { A: 2.05, B: 1.65, C: 1.28 },
          abcThresholds: { A: 0.8, B: 0.95 },
        },
      },
    });

    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data.success).toBe(true);
    expect(data.mode).toBe("compare");
    expect(data.version).toBe("5.1.0");

    // Comparison stats
    expect(data.comparison.inventorySaved).toBeGreaterThanOrEqual(0);
    expect(data.comparison.savingsPercentage).toBeGreaterThanOrEqual(0);

    // Split results
    expect(data.allSummary.results.length).toBeGreaterThan(0);
    expect(data.totalSummary.results.length).toBeGreaterThan(0);

    // Verify result structure
    const firstResult = data.allSummary.results[0];
    expect(firstResult).toHaveProperty("sku");
    expect(firstResult).toHaveProperty("safetyStock");
    expect(firstResult).toHaveProperty("reorderPoint");
    expect(firstResult).toHaveProperty("maxInventory");
    expect(firstResult).toHaveProperty("meanDemand");
    expect(firstResult).toHaveProperty("stdDev");
    expect(firstResult).toHaveProperty("cv");
    expect(firstResult).toHaveProperty("abcClass");
    expect(firstResult).toHaveProperty("isPriceMissing");

    // Parameters snapshot
    expect(data.parameters.granularity).toBe("monthly");
    expect(data.parameters.engineVersion).toBe("5.1.0");
    expect(data.parameters.leadTimeDays).toBe(30);
  });

  // =========================================================================
  // Calculation — Numerical Correctness
  // =========================================================================

  test("safety stock formula: SS = Z * sigma * sqrt(LT/30)", async ({ request }) => {
    const resp = await request.post(`${API}/api/calculate`, {
      data: {
        salesFileId,
        params: {
          calcMode: "total",
          granularity: "monthly",
          selectedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          leadTime: 30,
          minMonths: 2,
          enableOutlier: true,
          enableMa: false,
          zScores: { A: 2.05, B: 1.65, C: 1.28 },
        },
      },
    });

    const data = await resp.json();
    const results = data.results as Array<{
      sku: string;
      safetyStock: number;
      meanDemand: number;
      stdDev: number;
      cv: number;
      reorderPoint: number;
      maxInventory: number;
      leadTimeDays: number;
      abcClass: string;
    }>;

    for (const r of results.slice(0, 10)) {
      if (r.meanDemand <= 0 || r.stdDev <= 0) continue;

      const zMap: Record<string, number> = { A: 2.05, B: 1.65, C: 1.28 };
      const z = zMap[r.abcClass] ?? 1.65;
      const ltFactor = Math.sqrt(r.leadTimeDays / 30);

      // SS = ceil(Z * sigma * sqrt(LT/30))
      const expectedSS = Math.ceil(z * r.stdDev * ltFactor);
      expect(r.safetyStock).toBe(expectedSS);

      // CV = sigma / mean
      const expectedCV = r.stdDev / r.meanDemand;
      expect(r.cv).toBeCloseTo(expectedCV, 3);

      // ROP = ceil(mean/30 * LT + SS)
      const dailyDemand = r.meanDemand / 30;
      const ltDemand = dailyDemand * r.leadTimeDays;
      const expectedROP = Math.ceil(ltDemand + r.safetyStock);
      expect(r.reorderPoint).toBe(expectedROP);

      // Max = ceil(ROP + LT_demand)  — (s,S) policy
      const expectedMax = Math.ceil(r.reorderPoint + ltDemand);
      expect(r.maxInventory).toBe(expectedMax);
    }
  });

  // =========================================================================
  // Calculation — Granularity
  // =========================================================================

  test("weekly granularity should produce valid results", async ({ request }) => {
    const resp = await request.post(`${API}/api/calculate`, {
      data: {
        salesFileId,
        params: {
          calcMode: "total",
          granularity: "weekly",
          selectedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          leadTime: 30,
          minMonths: 2,
          enableOutlier: true,
        },
      },
    });

    const data = await resp.json();
    expect(data.success).toBe(true);
    expect(data.parameters.granularity).toBe("weekly");
    expect(data.results.length).toBeGreaterThan(0);
  });

  test("daily granularity should produce valid results", async ({ request }) => {
    const resp = await request.post(`${API}/api/calculate`, {
      data: {
        salesFileId,
        params: {
          calcMode: "total",
          granularity: "daily",
          selectedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          leadTime: 7,
          minMonths: 2,
          enableOutlier: true,
        },
      },
    });

    const data = await resp.json();
    expect(data.success).toBe(true);
    expect(data.parameters.granularity).toBe("daily");
  });

  // =========================================================================
  // Calculation — Category Lead Times
  // =========================================================================

  test("category lead time should override global LT", async ({ request }) => {
    // Calculate with default LT=30
    const resp1 = await request.post(`${API}/api/calculate`, {
      data: {
        salesFileId,
        params: {
          calcMode: "total",
          leadTime: 30,
          categoryLeadTimes: {},
        },
      },
    });
    const data1 = await resp1.json();

    // Calculate with category override LT=60 for wire (16120)
    const resp2 = await request.post(`${API}/api/calculate`, {
      data: {
        salesFileId,
        params: {
          calcMode: "total",
          leadTime: 30,
          categoryLeadTimes: { "16120": 60 },
        },
      },
    });
    const data2 = await resp2.json();

    expect(data1.success).toBe(true);
    expect(data2.success).toBe(true);

    // Find a common wire SKU and compare
    const sku1 = data1.results.find((r: { sku: string }) => r.sku.startsWith("235M"));
    const sku2 = data2.results.find((r: { sku: string }) => r.sku === sku1?.sku);

    if (sku1 && sku2) {
      // LT=60 should produce higher SS than LT=30
      expect(sku2.safetyStock).toBeGreaterThan(sku1.safetyStock);
      expect(sku2.leadTimeDays).toBe(60);
      expect(sku1.leadTimeDays).toBe(30);
    }
  });

  // =========================================================================
  // Error Handling
  // =========================================================================

  test("invalid calcMode should return 400", async ({ request }) => {
    const resp = await request.post(`${API}/api/calculate`, {
      data: {
        salesFileId,
        params: { calcMode: "invalid" },
      },
    });
    expect(resp.status()).toBe(400);
  });

  test("invalid granularity should return 400", async ({ request }) => {
    const resp = await request.post(`${API}/api/calculate`, {
      data: {
        salesFileId,
        params: { granularity: "hourly" },
      },
    });
    expect(resp.status()).toBe(400);
  });

  test("missing salesFileId should return error", async ({ request }) => {
    const resp = await request.post(`${API}/api/calculate`, {
      data: {
        salesFileId: "non-existent-id",
        params: {},
      },
    });
    const data = await resp.json();
    expect(data.success).toBe(false);
  });
});
