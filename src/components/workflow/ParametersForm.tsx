"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";
import { useWorkflow } from "@/lib/workflow-context";
import type { CalcMode, Granularity, MaterialCategory } from "@/lib/types";

/**
 * ParametersForm
 * ---------------------------------------------------------------------------
 * Section 02 · Configuration. All inputs bind two-way to WorkflowContext.
 *
 * Editorial layout: 12-column asymmetric grid.
 *   Strategy column (lg col-span-7) on the left
 *   Months column   (lg col-span-5) on the right
 *
 * Visual rules (from design spec):
 *   - 0 radius everywhere
 *   - Inputs use bottom-border only, italic placeholder
 *   - Toggles & radios are minimal; gold = active
 *   - Generous spacing between groups; thin dividers
 */
export function ParametersForm() {
  const { parameters, setParameters, uploads } = useWorkflow();

  const set = setParameters;

  // ----- Calc mode -----------------------------------------------------------
  const calcModes: { value: CalcMode; label: string; deck: string }[] = [
    {
      value: "compare",
      label: "Compare",
      deck: "Run both split and consolidated; show inventory savings.",
    },
    {
      value: "all",
      label: "Split",
      deck: "Each shipping site computed independently.",
    },
    {
      value: "total",
      label: "Consolidated",
      deck: "All sites pooled into a single virtual warehouse.",
    },
  ];

  // ----- Granularity options ---------------------------------------------------
  const granularityOptions: { value: Granularity; label: string; deck: string }[] = [
    {
      value: "monthly",
      label: "Monthly",
      deck: "Standard period — one data point per calendar month.",
    },
    {
      value: "weekly",
      label: "Weekly",
      deck: "ISO weeks — finer resolution for fast-moving items.",
    },
    {
      value: "daily",
      label: "Daily",
      deck: "Maximum granularity — best for very short lead times.",
    },
  ];

  // ----- Z-score options per ABC class ---------------------------------------
  const zScoreOptions: Record<"A" | "B" | "C", { value: number; label: string }[]> = {
    A: [
      { value: 1.65, label: "95% (1.65)" },
      { value: 2.05, label: "98% (2.05)" },
      { value: 2.33, label: "99% (2.33)" },
    ],
    B: [
      { value: 1.28, label: "90% (1.28)" },
      { value: 1.65, label: "95% (1.65)" },
      { value: 1.96, label: "97.5% (1.96)" },
    ],
    C: [
      { value: 1.04, label: "85% (1.04)" },
      { value: 1.28, label: "90% (1.28)" },
      { value: 1.65, label: "95% (1.65)" },
    ],
  };

  const months = [
    [1, "Jan"],
    [2, "Feb"],
    [3, "Mar"],
    [4, "Apr"],
    [5, "May"],
    [6, "Jun"],
    [7, "Jul"],
    [8, "Aug"],
    [9, "Sep"],
    [10, "Oct"],
    [11, "Nov"],
    [12, "Dec"],
  ] as const;

  const isMonthSelected = (m: number) =>
    parameters.selectedMonths?.includes(m) ?? false;

  const toggleMonth = (m: number) => {
    const cur = new Set(parameters.selectedMonths ?? []);
    if (cur.has(m)) cur.delete(m);
    else cur.add(m);
    set({ selectedMonths: Array.from(cur).sort((a, b) => a - b) });
  };

  const allMonths = () => set({ selectedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] });
  const noMonths = () => set({ selectedMonths: [] });

  // ----- Date range (from uploaded data) ------------------------------------
  const dataDateRange = {
    min: (uploads.sales as { dateRange?: { start?: string } } | null)?.dateRange?.start ?? "",
    max: (uploads.sales as { dateRange?: { end?: string } } | null)?.dateRange?.end ?? "",
  };
  const [seasonalOpen, setSeasonalOpen] = useState(false);

  // ----- Category lead times (Advanced) ------------------------------------
  const [materialCategories, setMaterialCategories] = useState<
    Record<string, MaterialCategory>
  >({});
  const [masterAvailable, setMasterAvailable] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.materialGroups().then((res) => {
      if (cancelled) return;
      if (res.available) {
        setMaterialCategories(res.categories);
        setMasterAvailable(true);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const setCategoryLt = (catId: string, value: number | null) => {
    const prev = parameters.categoryLeadTimes ?? {};
    if (value === null) {
      const next = { ...prev };
      delete next[catId];
      set({ categoryLeadTimes: next });
    } else {
      set({ categoryLeadTimes: { ...prev, [catId]: value } });
    }
  };

  // -------------------------------------------------------------------------
  return (
    <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
      {/* ============================================================
          Left column · Strategy (7/12)
          ============================================================ */}
      <div className="lg:col-span-7 flex flex-col gap-12">
        {/* --- Calc mode --- */}
        <Group
          label="Calculation mode"
          deck="Three lenses on the same data."
        >
          <div className="flex flex-col">
            {calcModes.map((m) => (
              <RadioRow
                key={m.value}
                name="calcMode"
                value={m.value}
                checked={parameters.calcMode === m.value}
                onChange={() => set({ calcMode: m.value })}
                label={m.label}
                deck={m.deck}
              />
            ))}
          </div>
        </Group>

        <Divider />

        {/* --- Aggregation granularity --- */}
        <Group
          label="Aggregation"
          deck="Time-period granularity for demand analysis."
        >
          <div className="flex flex-col">
            {granularityOptions.map((g) => (
              <RadioRow
                key={g.value}
                name="granularity"
                value={g.value}
                checked={(parameters.granularity ?? "monthly") === g.value}
                onChange={() => set({ granularity: g.value })}
                label={g.label}
                deck={g.deck}
              />
            ))}
          </div>
        </Group>

        <Divider />

        {/* --- ABC service levels --- */}
        <Group
          label="Service level (ABC)"
          deck="Differentiated Z-scores by ABC tier. Higher = more cushion."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-6">
            {(["A", "B", "C"] as const).map((tier) => (
              <UnderlineSelect
                key={tier}
                tier={tier}
                value={parameters.zScores?.[tier] ?? 0}
                options={zScoreOptions[tier]}
                onChange={(val) =>
                  set({
                    zScores: {
                      A: parameters.zScores?.A ?? 2.05,
                      B: parameters.zScores?.B ?? 1.65,
                      C: parameters.zScores?.C ?? 1.28,
                      [tier]: val,
                    },
                  })
                }
              />
            ))}
          </div>
        </Group>

        <Divider />

        {/* --- Numeric inputs --- */}
        <Group
          label="Time"
          deck="Days from order to delivery; minimum months of data required to compute."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <UnderlineNumber
              label="Lead time"
              suffix="days"
              value={parameters.leadTime ?? 30}
              min={1}
              max={365}
              onChange={(v) => set({ leadTime: v })}
            />
            <UnderlineNumber
              label={parameters.granularity === "monthly" ? "Minimum months" : "Minimum periods"}
              suffix={parameters.granularity === "monthly" ? "months of data" : "active periods"}
              value={parameters.minMonths ?? 2}
              min={0}
              max={12}
              onChange={(v) => set({ minMonths: v })}
            />
            {parameters.granularity === "monthly" ? (
              <UnderlineNumber
                label="Working days / month"
                suffix="days"
                value={parameters.workingDaysPerMonth ?? 30}
                min={1}
                max={31}
                onChange={(v) => set({ workingDaysPerMonth: v === 30 ? null : v })}
              />
            ) : null}
          </div>
        </Group>

        <Divider />

        {/* --- Toggles --- */}
        <Group
          label="Refinements"
          deck="Statistical filters applied before computing safety stock."
        >
          <div className="flex flex-col gap-6">
            <ToggleRow
              label="MAD outlier detection"
              deck="Removes extreme months using median absolute deviation."
              checked={parameters.enableOutlier ?? true}
              onChange={(c) => set({ enableOutlier: c })}
            />
            <ToggleRow
              label="Moving average"
              deck="Smooths month-to-month noise with a rolling window."
              checked={parameters.enableMa ?? false}
              onChange={(c) => set({ enableMa: c })}
            />
            {/* MA window slider — appears only when MA is enabled */}
            {parameters.enableMa ? (
              <div className="pl-8 border-l border-foreground/15 ml-2">
                <span className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Window
                </span>
                <div className="mt-3 flex items-center gap-6">
                  <input
                    type="range"
                    min={2}
                    max={12}
                    step={1}
                    value={parameters.maWindow ?? 3}
                    onChange={(e) => set({ maWindow: Number(e.target.value) })}
                    className="flex-1 accent-[color:var(--color-accent)]"
                    aria-label="Moving average window"
                  />
                  <span className="font-mono text-base tabular-nums text-foreground w-20 text-right">
                    {parameters.maWindow ?? 3}{" "}
                    <span className="text-muted-foreground text-xs">
                      {parameters.granularity === "weekly" ? "wk" : parameters.granularity === "daily" ? "d" : "mo"}
                    </span>
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </Group>

        <Divider />

        {/* --- Trend detection --- */}
        <Group
          label="Trend"
          deck="Show demand trend percentage in results."
        >
          <div className="flex flex-col">
            {([
              { value: "none", label: "None", deck: "Do not calculate trend." },
              { value: "short", label: "Short-term", deck: "Compare first half vs second half of the data range." },
              { value: "yoy", label: "YoY", deck: "Compare same months across the latest two years." },
            ] as const).map((opt) => (
              <RadioRow
                key={opt.value}
                name="trendMode"
                value={opt.value}
                checked={(parameters.trendMode ?? "none") === opt.value}
                onChange={() => set({ trendMode: opt.value })}
                label={opt.label}
                deck={opt.deck}
              />
            ))}
          </div>
        </Group>
      </div>

      {/* ============================================================
          Right column · Date range + Seasonal filter (5/12)
          ============================================================ */}
      <div className="lg:col-span-5 flex flex-col gap-12">
        {/* --- Date range --- */}
        <Group
          label="Date range"
          deck="Calculate using data from this period. Auto-filled from uploaded data."
        >
          <div className="flex flex-col gap-4">
            <DateInput
              label="From"
              value={parameters.dateFrom ?? ""}
              placeholder={dataDateRange.min}
              onChange={(v) => set({ dateFrom: v || null })}
            />
            <DateInput
              label="To"
              value={parameters.dateTo ?? ""}
              placeholder={dataDateRange.max}
              onChange={(v) => set({ dateTo: v || null })}
            />
            <span className="font-sans text-[10px] text-muted-foreground/60">
              Empty = use full range from uploaded data
            </span>
          </div>
        </Group>

        <Divider />

        {/* --- Seasonal filter (collapsible) --- */}
        <div>
          <button
            type="button"
            onClick={() => setSeasonalOpen((p) => !p)}
            className="font-sans text-[11px] uppercase tracking-[0.2em] text-muted-foreground border-b border-muted-foreground pb-1 hover:text-accent hover:border-accent transition-colors duration-500 ease-luxury"
          >
            {seasonalOpen ? "▵ Collapse" : "▿ Advanced"} · Seasonal filter
          </button>

          {seasonalOpen ? (
            <div className="mt-6">
              <p className="font-serif italic text-xs text-muted-foreground max-w-md">
                Exclude specific months across all years. Only checked months are included.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-y-3 gap-x-4">
                {months.map(([num, name]) => (
                  <MonthCheckbox
                    key={num}
                    label={name}
                    num={num}
                    checked={isMonthSelected(num)}
                    onChange={() => toggleMonth(num)}
                  />
                ))}
              </div>
              <div className="mt-4 flex items-center gap-4">
                <button
                  type="button"
                  onClick={allMonths}
                  className="font-sans text-[11px] uppercase tracking-[0.2em] text-foreground border-b border-foreground pb-1 hover:text-accent hover:border-accent transition-colors duration-500 ease-luxury"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={noMonths}
                  className="font-sans text-[11px] uppercase tracking-[0.2em] text-muted-foreground border-b border-muted-foreground pb-1 hover:text-accent hover:border-accent transition-colors duration-500 ease-luxury"
                >
                  Clear
                </button>
                <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
                  {parameters.selectedMonths?.length ?? 0} / 12
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Policy preview */}
        <div className="border-t border-foreground/15 pt-6">
          <span className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Policy preview
          </span>
          <p className="mt-3 font-serif italic text-base leading-relaxed text-foreground">
            {summarizePolicy(parameters)}
          </p>
        </div>
      </div>

      {/* ============================================================
          Full-width · Advanced category lead times (12/12)
          ============================================================ */}
      {masterAvailable ? (
        <div className="lg:col-span-12 border-t border-foreground/10 pt-8">
          <button
            type="button"
            onClick={() => setAdvancedOpen((p) => !p)}
            className="font-sans text-[11px] uppercase tracking-[0.2em] text-muted-foreground border-b border-muted-foreground pb-1 hover:text-accent hover:border-accent transition-colors duration-500 ease-luxury"
          >
            {advancedOpen ? "▵ Collapse" : "▿ Advanced"} · Category lead times
          </button>

          {advancedOpen ? (
            <div className="mt-8">
              <p className="font-serif italic text-sm text-muted-foreground max-w-xl">
                Override the global lead time for specific product categories.
                Empty fields inherit the global value above.
              </p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-6">
                {Object.entries(materialCategories)
                  .sort(([, a], [, b]) => b.totalCount - a.totalCount)
                  .map(([catId, cat]) => (
                    <CategoryLtInput
                      key={catId}
                      catId={catId}
                      name={cat.name}
                      count={cat.totalCount}
                      value={parameters.categoryLeadTimes?.[catId] ?? null}
                      defaultLt={parameters.leadTime ?? 30}
                      onChange={(v) => setCategoryLt(catId, v)}
                    />
                  ))}
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => set({ categoryLeadTimes: {} })}
                  className="font-sans text-[11px] uppercase tracking-[0.2em] text-muted-foreground border-b border-muted-foreground pb-1 hover:text-accent hover:border-accent transition-colors duration-500 ease-luxury"
                >
                  Reset all to default
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ===========================================================================
// Sub-primitives
// ===========================================================================

function DateInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
}) {
  const id = useId();
  const displayPlaceholder = placeholder
    ? placeholder.replace(/-/g, "/")
    : "YYYY/MM/DD";

  return (
    <div>
      <label
        htmlFor={id}
        className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={displayPlaceholder}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw);
        }}
        className={cn(
          "mt-2 w-full bg-transparent border-0 border-b py-2",
          "font-mono text-sm tabular-nums",
          "focus:outline-none transition-colors duration-500 ease-luxury",
          value
            ? "border-foreground text-foreground focus:border-accent"
            : "border-foreground/30 text-muted-foreground placeholder:italic focus:border-accent"
        )}
      />
    </div>
  );
}

function CategoryLtInput({
  catId,
  name,
  count,
  value,
  defaultLt,
  onChange,
}: {
  catId: string;
  name: string;
  count: number;
  value: number | null;
  defaultLt: number;
  onChange: (v: number | null) => void;
}) {
  const id = useId();
  const hasOverride = value !== null;

  return (
    <div>
      <label
        htmlFor={id}
        className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
      >
        {name}
      </label>
      <span className="block mt-1 font-mono text-[10px] text-muted-foreground/60">
        {catId} · {count.toLocaleString()} items
      </span>
      <div className="mt-2 flex items-center gap-3">
        <input
          id={id}
          type="number"
          min={1}
          max={365}
          placeholder={`${defaultLt}`}
          value={hasOverride ? value : ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(null);
            } else {
              const n = parseInt(raw, 10);
              if (!isNaN(n) && n >= 1 && n <= 365) onChange(n);
            }
          }}
          className={cn(
            "w-20 bg-transparent border-0 border-b py-2",
            "font-mono text-sm tabular-nums",
            "focus:outline-none transition-colors duration-500 ease-luxury",
            hasOverride
              ? "border-foreground text-foreground focus:border-accent"
              : "border-foreground/30 text-muted-foreground/50 focus:border-accent"
          )}
        />
        <span className="font-sans text-xs text-muted-foreground">days</span>
        {!hasOverride ? (
          <span className="font-serif italic text-xs text-muted-foreground/40">
            default: {defaultLt}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Group({
  label,
  deck,
  children,
}: {
  label: string;
  deck?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        {label}
      </span>
      {deck ? (
        <p className="mt-2 font-serif italic text-sm text-muted-foreground max-w-md">
          {deck}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-foreground/15" />;
}

function RadioRow({
  name,
  value,
  checked,
  onChange,
  label,
  deck,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  deck?: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "group/radio cursor-pointer flex items-start gap-4 py-4 border-t border-foreground/10 transition-colors duration-500 ease-luxury",
        "hover:border-foreground/40",
        checked && "border-foreground/40"
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {/* Custom marker — square that fills with foreground when checked */}
      <span
        aria-hidden="true"
        className={cn(
          "mt-1 inline-block w-3 h-3 border border-foreground transition-colors duration-500 ease-luxury",
          checked ? "bg-foreground" : "bg-transparent"
        )}
      />
      <div className="flex-1">
        <span
          className={cn(
            "font-serif text-xl leading-tight transition-colors duration-500 ease-luxury",
            checked ? "text-foreground" : "text-foreground/70"
          )}
        >
          {label}
        </span>
        {deck ? (
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            {deck}
          </p>
        ) : null}
      </div>
    </label>
  );
}

function UnderlineSelect({
  tier,
  value,
  options,
  onChange,
}: {
  tier: "A" | "B" | "C";
  value: number;
  options: { value: number; label: string }[];
  onChange: (val: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
      >
        Tier <span className="text-foreground">{tier}</span>
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "mt-2 w-full bg-transparent border-0 border-b border-foreground py-2",
          "font-sans text-base text-foreground appearance-none cursor-pointer",
          "focus:outline-none focus:border-accent transition-colors duration-500 ease-luxury"
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function UnderlineNumber({
  label,
  suffix,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  suffix?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
      >
        {label}
      </label>
      <div className="mt-2 flex items-baseline gap-3 border-b border-foreground py-2 transition-colors duration-500 ease-luxury focus-within:border-accent">
        <input
          id={id}
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            if (min !== undefined && next < min) return;
            if (max !== undefined && next > max) return;
            onChange(next);
          }}
          className={cn(
            "w-24 bg-transparent border-0 outline-none",
            "font-mono text-2xl tabular-nums text-foreground"
          )}
        />
        {suffix ? (
          <span className="font-serif italic text-sm text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  deck,
  checked,
  onChange,
}: {
  label: string;
  deck?: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex-1">
        <label
          htmlFor={id}
          className="font-serif text-lg leading-tight text-foreground cursor-pointer"
        >
          {label}
        </label>
        {deck ? (
          <p className="mt-1 font-sans text-sm text-muted-foreground">{deck}</p>
        ) : null}
      </div>

      {/* Switch */}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-12 items-center border transition-colors duration-500 ease-luxury shrink-0 mt-1",
          checked
            ? "bg-foreground border-foreground"
            : "bg-transparent border-foreground/40"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-4 w-4 transition-transform duration-500 ease-luxury",
            checked
              ? "translate-x-7 bg-accent"
              : "translate-x-1 bg-foreground/40"
          )}
        />
      </button>
    </div>
  );
}

function MonthCheckbox({
  label,
  num,
  checked,
  onChange,
}: {
  label: string;
  num: number;
  checked: boolean;
  onChange: () => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "group/m flex items-center gap-3 cursor-pointer py-2 px-3 border transition-colors duration-500 ease-luxury",
        checked
          ? // Selected: deeper "milk-tea paper" wash (#E3DBCF, step deeper
            // than --color-muted so it reads distinctly against the page)
            // with a 3px gold left stripe — evokes a bookmark tab clipped
            // to the edge of an editorial spread.
            "bg-[#E3DBCF] border-foreground/20 border-l-[3px] border-l-accent text-foreground"
          : // Unselected: transparent, near-invisible outline, faded type.
            // Hover lifts it gently so the grid feels responsive without
            // introducing noise to the at-rest view.
            "bg-transparent border-foreground/10 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={cn(
          "font-mono text-[10px] tracking-[0.2em] transition-colors duration-500 ease-luxury",
          checked ? "text-foreground/60" : "text-muted-foreground/60"
        )}
      >
        {String(num).padStart(2, "0")}
      </span>
      <span className="font-serif text-sm">{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summarizePolicy(p: ReturnType<typeof useWorkflow>["parameters"]): string {
  const z = p.zScores ?? { A: 2.05, B: 1.65, C: 1.28 };
  const months = p.selectedMonths?.length ?? 12;
  const ma = p.enableMa ? `, MA(${p.maWindow ?? 3})` : "";
  const outlier = p.enableOutlier ? "" : ", outliers kept";
  const gran = p.granularity ?? "monthly";
  const dateRange = p.dateFrom && p.dateTo ? ` · ${p.dateFrom}~${p.dateTo}` : "";
  const modeLabel =
    p.calcMode === "compare"
      ? "Compare"
      : p.calcMode === "all"
      ? "Split"
      : p.calcMode === "total"
      ? "Consolidated"
      : "Compare";

  return (
    `${modeLabel} · ${gran} · LT ${p.leadTime ?? 30}d · min ${p.minMonths ?? 2}m · ` +
    `Z(${z.A}/${z.B}/${z.C}) · ${months}/12 months${dateRange}${ma}${outlier}.`
  );
}
