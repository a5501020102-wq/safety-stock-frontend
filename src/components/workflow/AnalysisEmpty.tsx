"use client";

import { useWorkflow } from "@/lib/workflow-context";

/**
 * AnalysisEmpty
 * ---------------------------------------------------------------------------
 * Placeholder shown inside Section 03 when no calculation has been run yet.
 *
 * Renders nothing once a result exists (ResultsSummary + ResultsTable take
 * over). Keeps the section from looking broken on first visit.
 */
export function AnalysisEmpty() {
  const { calculationResult, uploads, isCalculating } = useWorkflow();

  // If we have a result or are actively computing, render nothing here.
  if (calculationResult || isCalculating) return null;

  const hasSales = Boolean(uploads.sales?.fileId);

  return (
    <div className="mt-16 border-t border-foreground/15 pt-10">
      <div className="max-w-xl">
        <span className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Awaiting run
        </span>
        <p className="mt-3 font-serif italic text-xl leading-relaxed text-foreground/70">
          {hasSales
            ? "Press Calculate above to generate the spread."
            : "Upload the sales ledger to unlock this section."}
        </p>
        <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">
          The Analysis spread will render here: a parameters snapshot, summary
          cards, and a full results table with filters and export actions.
        </p>
      </div>
    </div>
  );
}
