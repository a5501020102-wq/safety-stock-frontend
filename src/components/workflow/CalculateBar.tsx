"use client";

import { useCallback, useEffect, useRef } from "react";
import { ApiClientError, api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useWorkflow } from "@/lib/workflow-context";

/**
 * CalculateBar
 * ---------------------------------------------------------------------------
 * The "action" strip that lives between Configuration (02) and Analysis (03).
 *
 * Responsibilities:
 *  - Disable the calculate button until the sales ledger is uploaded.
 *  - Provide a clear loading state while the server crunches.
 *  - Surface API errors with the standardized `code` + message contract.
 *  - After a successful calculation, smooth-scroll to #analysis so the user
 *    lands on the fresh results spread without hunting.
 */
export function CalculateBar() {
  const {
    uploads,
    parameters,
    isCalculating,
    calculationError,
    calculationResult,
    setCalculating,
    setCalculationError,
    setCalculationResult,
  } = useWorkflow();

  const hasSales = Boolean(uploads.sales?.fileId);
  const hasSelectedMonths = (parameters.selectedMonths?.length ?? 0) > 0;
  const canCalculate = hasSales && hasSelectedMonths && !isCalculating;

  // Keep a ref to the latest abort controller so we can cancel a stuck run.
  const abortRef = useRef<AbortController | null>(null);

  // If the user navigates away while a calc is in-flight, cancel it cleanly.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const run = useCallback(async () => {
    if (!canCalculate) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setCalculationError(null);
    setCalculating(true);

    try {
      const result = await api.calculate({
        salesFileId: uploads.sales!.fileId,
        priceFileId: uploads.price?.fileId ?? null,
        planFileId: uploads.plan?.fileId ?? null,
        params: parameters,
      });
      setCalculationResult(result);

      // Smooth-scroll to the results section after the next paint.
      requestAnimationFrame(() => {
        document.getElementById("analysis")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setCalculationError(`[${err.code}] ${err.message}`);
      } else if (err instanceof DOMException && err.name === "AbortError") {
        // Silent — user navigated away
      } else {
        setCalculationError((err as Error).message || "計算失敗");
      }
    } finally {
      setCalculating(false);
    }
  }, [
    canCalculate,
    parameters,
    uploads.sales,
    uploads.price,
    uploads.plan,
    setCalculating,
    setCalculationError,
    setCalculationResult,
  ]);

  // --------------------------------------------------------------------
  // Reason strip: helps the user understand why the button is disabled.
  // --------------------------------------------------------------------
  const reason = !hasSales
    ? "Upload the sales ledger to begin."
    : !hasSelectedMonths
    ? "Select at least one month."
    : isCalculating
    ? "Crunching the numbers…"
    : calculationResult
    ? "Results are ready below. Recalculate to iterate."
    : "All set. Press Calculate.";

  return (
    <div className="mt-20 md:mt-24 border-t border-foreground/25 pt-10">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
        {/* Reason / status */}
        <div className="flex-1">
          <span className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Next step
          </span>
          <p
            className={cn(
              "mt-3 font-serif italic text-xl md:text-2xl leading-tight",
              isCalculating ? "text-accent" : "text-foreground"
            )}
          >
            {reason}
          </p>

          {calculationError ? (
            <p className="mt-4 font-sans text-sm leading-relaxed text-[color:var(--color-shortage)]">
              {calculationError}
            </p>
          ) : null}
        </div>

        {/* Primary action */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={run}
            disabled={!canCalculate}
            className={cn(
              "group/cta relative inline-flex items-center justify-center overflow-hidden",
              "h-14 px-12 border border-foreground",
              "font-sans text-xs uppercase tracking-[0.3em]",
              "transition-colors duration-500 ease-luxury",
              canCalculate
                ? "bg-foreground text-background cursor-pointer"
                : "bg-transparent text-foreground/30 border-foreground/25 cursor-not-allowed"
            )}
            aria-busy={isCalculating}
            aria-disabled={!canCalculate}
          >
            {/* Gold slide-in on hover (only when enabled) */}
            {canCalculate && !isCalculating ? (
              <span
                aria-hidden="true"
                className="absolute inset-0 -translate-x-full bg-accent transition-transform duration-500 ease-luxury group-hover/cta:translate-x-0"
              />
            ) : null}

            <span className="relative z-10 flex items-center gap-3">
              {isCalculating ? (
                <>
                  <Spinner />
                  Calculating
                </>
              ) : calculationResult ? (
                "Recalculate"
              ) : (
                "Calculate"
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-3 h-3 border-t border-r border-background animate-spin"
      style={{ animationDuration: "800ms" }}
    />
  );
}
