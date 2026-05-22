import { TabbedLayout } from "@/components/layout/TabbedLayout";
import { WorkflowProvider } from "@/lib/workflow-context";
import { UploadsSection } from "@/components/workflow/UploadsSection";
import { ParametersForm } from "@/components/workflow/ParametersForm";
import { CalculateBar } from "@/components/workflow/CalculateBar";
import { ResultsSummary } from "@/components/workflow/ResultsSummary";
import { ResultsTable } from "@/components/workflow/ResultsTable";
import { AnalysisEmpty } from "@/components/workflow/AnalysisEmpty";
import { AnalysisOverlay } from "@/components/workflow/AnalysisOverlay";

export default function Home() {
  return (
    <main className="relative">
      {/* Single-line banner — 不再大字標題，內容讓給 tab 內容 */}
      <header className="relative border-b border-foreground/15 px-6 py-4 md:px-12">
        <div className="flex flex-wrap items-baseline gap-4">
          <span className="h-px w-8 bg-foreground" aria-hidden="true" />
          <span className="font-sans text-[10px] tracking-[0.25em] text-muted-foreground">
            2026 年第 05 版 · 安全庫存分析
          </span>
        </div>
      </header>

      <WorkflowProvider>
        <TabbedLayout
          sources={<UploadsSection />}
          configuration={
            <>
              <ParametersForm />
              <CalculateBar />
            </>
          }
          analysis={
            <>
              <AnalysisEmpty />
              <AnalysisOverlay>
                <ResultsSummary />
                <ResultsTable />
              </AnalysisOverlay>
            </>
          }
        />
      </WorkflowProvider>

      <footer className="border-t border-foreground/20 px-6 py-6 md:px-12">
        <p className="font-sans text-xs text-muted-foreground">安全庫存計算系統</p>
      </footer>
    </main>
  );
}
