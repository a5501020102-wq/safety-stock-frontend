"use client";

import { UploadCard } from "./UploadCard";
import { useWorkflow } from "@/lib/workflow-context";

/**
 * UploadsSection
 * ---------------------------------------------------------------------------
 * Renders the three upload slots (sales / price / plan) in an editorial grid.
 *
 * - Sales is required and sits first (wider column on desktop to signal
 *   primacy).
 * - Price and plan are optional and share the remaining width.
 *
 * A small status strip below summarizes which files are loaded, so users
 * scanning to Section 02 can tell at a glance whether they're ready to
 * calculate.
 */
export function UploadsSection() {
  const { uploads } = useWorkflow();

  const loadedCount = [uploads.sales, uploads.price, uploads.plan].filter(Boolean).length;

  const ready = Boolean(uploads.sales);

  return (
    <div className="mt-16">
      {/* Three-slot editorial grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 md:gap-10">
        {/* Sales — required, wider on lg */}
        <div className="lg:col-span-6">
          <UploadCard
            slot="sales"
            numeral="I"
            required
            title={
              <>
                Sales
                <br />
                <em className="italic text-accent">ledger.</em>
              </>
            }
            hint="出貨點、料號、日期、數量。此檔必填。"
          />
        </div>

        {/* Price */}
        <div className="lg:col-span-3">
          <UploadCard
            slot="price"
            numeral="II"
            title={
              <>
                Price
                <br />
                <em className="italic text-accent">list.</em>
              </>
            }
            hint="料號 · 單價。用於 ABC 分級。選填。"
          />
        </div>

        {/* Plan */}
        <div className="lg:col-span-3">
          <UploadCard
            slot="plan"
            numeral="III"
            title={
              <>
                Stock
                <br />
                <em className="italic text-accent">plan.</em>
              </>
            }
            hint="ERP 計畫：需求 / 供給 / 調撥。選填。"
          />
        </div>
      </div>

      {/* Status strip */}
      <div className="mt-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-4 border-t border-foreground/15 pt-6">
        <div>
          <span className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Status</span>
          <p className="mt-2 font-serif italic text-lg leading-tight text-foreground">
            {ready ? (
              <>
                {loadedCount} of 3 sources linked. Ready for{" "}
                <em className="not-italic font-serif text-accent">Configuration</em>.
              </>
            ) : (
              <>Awaiting the sales ledger.</>
            )}
          </p>
        </div>
        {ready ? (
          <a
            href="#configuration"
            className="font-sans text-[11px] uppercase tracking-[0.2em] text-foreground border-b border-foreground pb-1 hover:text-accent hover:border-accent transition-colors duration-500 ease-luxury"
          >
            Proceed to 02 · Configuration →
          </a>
        ) : null}
      </div>
    </div>
  );
}
