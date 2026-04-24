import { VerticalLabel } from "@/components/layout/VerticalLabel";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { WorkflowProvider } from "@/lib/workflow-context";
import { UploadsSection } from "@/components/workflow/UploadsSection";
import { ParametersForm } from "@/components/workflow/ParametersForm";
import { CalculateBar } from "@/components/workflow/CalculateBar";
import { ResultsSummary } from "@/components/workflow/ResultsSummary";
import { ResultsTable } from "@/components/workflow/ResultsTable";
import { AnalysisEmpty } from "@/components/workflow/AnalysisEmpty";

/**
 * Home page — Safety Stock Editorial v5.0
 *
 * Structure (single-page editorial):
 *   Cover               — Masthead with hero
 *   Section 01 · Sources        (Phase 2: Upload cards)
 *   Section 02 · Configuration  (Phase 3: Parameters form)
 *   Section 03 · Analysis       (Phase 4: Results + Export)
 *
 * Phase 1 renders the Cover + three section headers with placeholder
 * bodies so we can verify the page structure before wiring in the real
 * interactive content.
 */
export default function Home() {
  return (
    <main className="relative">
      {/* ==========================================================
          Cover · Masthead
          ========================================================== */}
      <section className="relative min-h-[90vh] px-8 md:px-16 py-20 md:py-32">
        {/* Overline */}
        <div className="flex items-center gap-6">
          <span className="h-px w-8 md:w-12 bg-foreground" />
          <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Vol. 05 — 2026 · Editorial Intelligence
          </span>
        </div>

        {/* Hero headline */}
        <h1 className="mt-16 md:mt-24 font-serif leading-[0.9] tracking-tight text-foreground text-5xl sm:text-6xl md:text-8xl lg:text-9xl">
          Safety
          <br />
          <span className="italic text-accent">Stock.</span>
          <br />
          Curated.
        </h1>

        {/* Subheading */}
        <p className="mt-12 max-w-xl font-sans text-base md:text-lg leading-relaxed text-muted-foreground">
          A deliberate approach to inventory intelligence. Upload your sales history, configure your policy, and read
          the resulting analysis like the editorial spread it deserves to be.
        </p>

        {/* Masthead footer rule */}
        <div className="mt-24 border-t border-foreground/20 pt-6 flex items-end justify-between">
          <div>
            <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Issue · 05</span>
          </div>
          <div className="text-right">
            <span className="font-serif italic text-sm text-muted-foreground">Safety Stock Automation v5.0</span>
          </div>
        </div>

        {/* Vertical side label (lg+) */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <VerticalLabel side="left">SS · Editorial / Vol. 05</VerticalLabel>
        </div>

        {/* Right-side editorial apparatus (xl+) */}
        <aside aria-hidden="true" className="absolute right-16 top-32 hidden xl:flex flex-col gap-16 w-52 select-none">
          <div className="text-right">
            <span className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Printed
            </span>
            <span className="mt-3 block font-serif text-2xl italic leading-none text-foreground">MMXXVI</span>
            <span className="mt-1 block font-sans text-xs tracking-[0.2em] text-muted-foreground">APR · XV</span>
          </div>

          <div className="text-right border-t border-foreground/20 pt-6">
            <span className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              In this issue
            </span>
            <ol className="mt-4 space-y-2 font-serif text-sm text-foreground">
              <li>
                <span className="font-sans text-[10px] tracking-[0.2em] text-muted-foreground mr-2">I</span>
                Sources
              </li>
              <li>
                <span className="font-sans text-[10px] tracking-[0.2em] text-muted-foreground mr-2">II</span>
                Configuration
              </li>
              <li>
                <span className="font-sans text-[10px] tracking-[0.2em] text-muted-foreground mr-2">III</span>
                Analysis
              </li>
            </ol>
          </div>

          <div className="text-right border-t border-foreground/20 pt-6">
            <p className="font-serif italic text-sm leading-relaxed text-muted-foreground">
              &ldquo;The most valuable inventory is the one you didn&apos;t need to carry.&rdquo;
            </p>
            <span className="mt-3 block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              — Editor&apos;s note
            </span>
          </div>
        </aside>
      </section>

      {/* ==========================================================
          Interactive tree — everything beyond the cover lives inside
          a single WorkflowProvider so state flows across sections.
          ========================================================== */}
      <WorkflowProvider>
        {/* Section 01 · Sources */}
        <section id="sources" className="relative px-8 md:px-16 py-20 md:py-32">
          <SectionHeader
            numeral="01"
            overline="Sources"
            title="Materials,"
            italicAccent="selected."
            deck={
              <>
                Three inputs set the foundation for every analysis that follows. Only the sales ledger is required;
                price and plan sheets refine the interpretation.
              </>
            }
            meta="Upload"
          />

          <UploadsSection />
        </section>

        {/* Section 02 · Configuration */}
        <section id="configuration" className="relative px-8 md:px-16 py-20 md:py-32">
          <SectionHeader
            numeral="02"
            overline="Configuration"
            title="The"
            italicAccent="policy."
            deck={
              <>
                Service level, lead time, ABC thresholds — the knobs that turn raw demand into a considered reorder
                point.
              </>
            }
            meta="Parameters"
          />

          <ParametersForm />

          {/* The calculate trigger lives at the bottom of Configuration
              because it reads from the params above. Its result renders
              in Section 03 below. */}
          <CalculateBar />
        </section>

        {/* Section 03 · Analysis */}
        <section id="analysis" className="relative px-8 md:px-16 py-20 md:py-32">
          <SectionHeader
            numeral="03"
            overline="Analysis"
            title="The"
            italicAccent="calculation."
            deck={
              <>
                The results spread: summary statistics, per-SKU detail, excluded items, and export to Excel or SAP MM17.
              </>
            }
            meta="Results"
          />

          <AnalysisEmpty />
          <ResultsSummary />
          <ResultsTable />
        </section>
      </WorkflowProvider>

      {/* ==========================================================
          Colophon (footer)
          ========================================================== */}
      <footer className="border-t border-foreground/20 px-8 md:px-16 py-16">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          <div>
            <span className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Colophon
            </span>
            <p className="mt-4 font-serif italic text-lg text-foreground">
              Set in Playfair Display &amp; Inter.
              <br />
              Printed on warm alabaster, bound in charcoal.
            </p>
          </div>
          <div className="text-left md:text-right">
            <span className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Engine</span>
            <span className="mt-2 block font-mono text-xs text-foreground">Python · Flask · Next.js 16</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
