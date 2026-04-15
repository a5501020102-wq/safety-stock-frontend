import { VerticalLabel } from "@/components/layout/VerticalLabel";

/**
 * Day 2 verification page.
 *
 * This is an editorial "cover" demonstrating the design system tokens.
 * Day 3 will replace the body below with the real upload / calculate /
 * results flow. For now we only render the cover so we can visually
 * validate:
 *
 *  - Playfair Display + Inter fonts load
 *  - Warm Alabaster background and Charcoal foreground
 *  - Generous vertical spacing
 *  - Vertical gridlines visible on md+ (see background)
 *  - Paper noise texture (subtle)
 *  - Gold accent on hover
 *  - Zero radius everywhere
 */
export default function Home() {
  return (
    <main className="relative">
      {/* ============================================================
          Cover / Masthead
          ============================================================ */}
      <section className="relative min-h-[90vh] px-8 md:px-16 py-20 md:py-32">
        {/* Overline: date + volume */}
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
          A deliberate approach to inventory intelligence. Upload your sales
          history, configure your policy, and read the resulting analysis
          like the editorial spread it deserves to be.
        </p>

        {/* Masthead footer rule */}
        <div className="mt-24 border-t border-foreground/20 pt-6 flex items-end justify-between">
          <div>
            <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Issue · 05
            </span>
          </div>
          <div className="text-right">
            <span className="font-serif italic text-sm text-muted-foreground">
              Safety Stock Automation v5.0
            </span>
          </div>
        </div>

        {/* Vertical side label — only visible on lg+ */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <VerticalLabel side="left">SS · Editorial / Vol. 05</VerticalLabel>
        </div>
      </section>

      {/* ============================================================
          Token sanity-check strip (removed in Day 3)
          ============================================================ */}
      <section className="border-t border-foreground/15 px-8 md:px-16 py-20">
        <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Design System · Sanity Check
        </span>

        <h2 className="mt-6 font-serif text-3xl md:text-4xl leading-tight">
          The <em className="text-accent">Details</em>.
        </h2>

        {/* Color swatches */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Swatch label="Alabaster" hex="#F9F8F6" textOnLight />
          <Swatch label="Charcoal" hex="#1A1A1A" />
          <Swatch label="Gold" hex="#D4AF37" />
          <Swatch label="Taupe" hex="#EBE5DE" textOnLight />
        </div>

        {/* Type specimen */}
        <div className="mt-16 grid md:grid-cols-2 gap-12">
          <div>
            <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Serif · Playfair Display
            </span>
            <p className="mt-3 font-serif text-3xl leading-tight">
              Elegance through
              <br />
              <em>restraint.</em>
            </p>
          </div>
          <div>
            <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Sans · Inter
            </span>
            <p className="mt-3 font-sans text-base leading-relaxed">
              Body copy is set in Inter at 16px with generous line-height for
              comfortable reading. 數字欄位則以 JetBrains Mono 呈現，確保表格
              對齊精準。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Local helper
// ---------------------------------------------------------------------------

function Swatch({
  label,
  hex,
  textOnLight = false,
}: {
  label: string;
  hex: string;
  textOnLight?: boolean;
}) {
  return (
    <div
      className="aspect-[3/4] p-4 flex flex-col justify-between shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow duration-700 hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
      style={{
        backgroundColor: hex,
        color: textOnLight ? "#1A1A1A" : "#F9F8F6",
      }}
    >
      <span className="font-sans text-[10px] uppercase tracking-[0.3em]">
        {label}
      </span>
      <span className="font-mono text-xs">{hex}</span>
    </div>
  );
}
