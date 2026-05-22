"use client";

import { useWorkflow } from "@/lib/workflow-context";

/**
 * AnalysisOverlay
 * ---------------------------------------------------------------------------
 * 包住 ResultsSummary + ResultsTable，當「重新計算」進行中（已有舊結果 + isCalculating）
 * 套上半透明 overlay 與 spinner，提示使用者結果即將更新。
 *
 * 無舊結果時：本元件透明傳遞 children，由 AnalysisEmpty 處理 skeleton。
 * 計算成功後 calculationResult 更新，overlay 自動消失。
 */
export function AnalysisOverlay({ children }: { children: React.ReactNode }) {
  const { isCalculating, calculationResult } = useWorkflow();
  const showOverlay = isCalculating && calculationResult !== null;

  return (
    <div className="relative">
      {children}
      {showOverlay ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-background/70 pt-32 backdrop-blur-[1px]"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-4">
            <span
              aria-hidden="true"
              className="inline-block h-4 w-4 animate-spin border-r border-t border-foreground"
              style={{ animationDuration: "800ms" }}
            />
            <span className="font-sans text-[10px] tracking-[0.3em] text-muted-foreground">計算中…</span>
          </div>
          <span className="sr-only">重新計算中，新結果即將顯示。</span>
        </div>
      ) : null}
    </div>
  );
}
