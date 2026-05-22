"use client";

import { useWorkflow } from "@/lib/workflow-context";

/**
 * AnalysisEmpty
 * ---------------------------------------------------------------------------
 * 分析分頁的空狀態。三種互斥情境：
 *   1. 計算中 + 無舊結果 → 顯示 skeleton（佔位骨架）
 *   2. 未上傳銷貨明細     → 提示先上傳
 *   3. 已上傳但未計算     → 提示至「設定」分頁設定參數並按計算
 *
 * 若已有 calculationResult，本元件 return null，
 * 由 ResultsSummary / ResultsTable 顯示結果（計算中時上層套用 overlay）。
 */
export function AnalysisEmpty() {
  const { uploads, calculationResult, isCalculating } = useWorkflow();

  if (calculationResult) return null;

  const hasSales = Boolean(uploads.sales?.fileId);

  // 計算中 + 無舊結果：顯示 skeleton。
  if (isCalculating) {
    return (
      <div className="border-t border-foreground/15 pt-6">
        <span className="block font-sans text-[10px] tracking-[0.3em] text-muted-foreground">計算中</span>

        <div className="mt-6 space-y-4" aria-hidden="true">
          {/* 四個 stat card 骨架 */}
          <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border-t border-foreground/25 pt-6 pl-4">
                <div className="h-2 w-16 bg-muted" />
                <div className="mt-3 h-10 w-24 bg-muted" />
                <div className="mt-3 h-2 w-32 bg-muted" />
              </div>
            ))}
          </div>

          {/* 表格列骨架 */}
          <div className="mt-12 space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-full bg-muted/60" />
            ))}
          </div>
        </div>

        <span className="sr-only">計算中，結果即將顯示。</span>
      </div>
    );
  }

  return (
    <div className="border-t border-foreground/15 pt-6">
      <span className="block font-sans text-[10px] tracking-[0.3em] text-muted-foreground">尚未計算</span>

      <p className="mt-4 font-serif text-lg leading-tight text-foreground">
        {hasSales ? "請至「設定」分頁設定參數並按計算。" : "請先上傳銷貨明細以啟用此區塊。"}
      </p>

      <p className="mt-4 max-w-xl font-sans text-sm leading-relaxed text-muted-foreground">
        分析結果將顯示於此：參數快照、摘要卡片、完整結果表格、篩選與匯出功能。
      </p>
    </div>
  );
}
