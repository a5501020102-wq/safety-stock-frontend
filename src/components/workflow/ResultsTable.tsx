"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { useWorkflow } from "@/lib/workflow-context";
import type { CalculationResponse, SkuResult, StockStatus } from "@/lib/types";

/**
 * ResultsTable
 * ---------------------------------------------------------------------------
 * The main results table for Section 03.
 *
 * - In compare mode we show two sibling tables (Split vs Consolidated).
 * - In single modes we show one table.
 *
 * Controls:
 *   - Tab: all / shortage / healthy / overstock (status filter)
 *   - Search: sku or name substring
 *   - Site filter: dropdown (only shown when >1 site exists in the data)
 *   - Sort: click column headers to toggle asc/desc
 *   - Pagination: page size 50, arrow + page numbers
 *
 * All state is local to this component (no need to persist these UI prefs).
 */
export function ResultsTable() {
  const { calculationResult } = useWorkflow();
  if (!calculationResult) return null;

  if (calculationResult.mode === "compare") {
    const { allSummary, totalSummary } = calculationResult;
    return (
      <div className="mt-16 flex flex-col gap-20">
        <TableBlock
          heading="Split · Per site"
          italicAccent="spread"
          deck="Each shipping point computed independently."
          results={allSummary.results}
          mode="all"
        />
        <TableBlock
          heading="Consolidated · Single"
          italicAccent="warehouse"
          deck="All sites pooled into one virtual warehouse."
          results={totalSummary.results}
          mode="total"
        />
      </div>
    );
  }

  return (
    <div className="mt-16">
      <TableBlock
        heading={calculationResult.mode === "total" ? "Consolidated" : "Per site"}
        italicAccent="results"
        deck="All SKUs that passed the minimum-months filter."
        results={calculationResult.results}
        mode={calculationResult.mode}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TableBlock — one complete results table with its own local filter / sort
// ---------------------------------------------------------------------------

type SortKey =
  | "site"
  | "sku"
  | "abcClass"
  | "meanDemand"
  | "stdDev"
  | "cv"
  | "safetyStock"
  | "reorderPoint"
  | "maxInventory";
type SortDir = "asc" | "desc";

const STATUS_FILTERS: Array<{
  key: "all" | StockStatus;
  label: string;
  description: string;
}> = [
  { key: "all", label: "All", description: "Every SKU" },
  { key: "red", label: "Shortage", description: "Below safety" },
  { key: "green", label: "Healthy", description: "Within range" },
  { key: "blue", label: "Overstock", description: "Above 3× SS" },
];

function TableBlock({
  heading,
  italicAccent,
  deck,
  results,
  mode,
}: {
  heading: string;
  italicAccent: string;
  deck: string;
  results: SkuResult[];
  mode: "all" | "total" | "single";
}) {
  // Filter state
  const [statusFilter, setStatusFilter] = useState<"all" | StockStatus>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "safetyStock",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Derive the list of sites for the filter dropdown
  const sites = useMemo(() => {
    const s = new Set<string>();
    for (const r of results) if (r.site) s.add(r.site);
    return Array.from(s).sort();
  }, [results]);

  const showSiteFilter = mode === "all" && sites.length > 1;

  // Status counts (for tab badges)
  const statusCounts = useMemo(() => {
    const c: Record<"all" | StockStatus, number> = {
      all: results.length,
      red: 0,
      green: 0,
      blue: 0,
      gray: 0,
    };
    for (const r of results) c[r.status]++;
    return c;
  }, [results]);

  // Pipeline: site -> status -> search -> sort -> paginate
  const filteredSorted = useMemo(() => {
    let list = results;
    if (showSiteFilter && siteFilter !== "all") {
      list = list.filter((r) => r.site === siteFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.sku.toLowerCase().includes(q) ||
          (r.name ?? "").toLowerCase().includes(q)
      );
    }
    // Sort (immutable: clone before sorting)
    const sorted = [...list].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === bv) return 0;
      const dir = sort.dir === "asc" ? 1 : -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
    return sorted;
  }, [results, siteFilter, statusFilter, query, sort, showSiteFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageSlice = filteredSorted.slice(start, start + pageSize);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, siteFilter, query, sort]);

  const onSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    );
  };

  return (
    <section>
      {/* Heading */}
      <div className="border-t border-foreground/20 pt-6">
        <span className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Table
        </span>
        <h3 className="mt-2 font-serif text-3xl md:text-4xl leading-tight text-foreground">
          {heading} <em className="italic text-accent">{italicAccent}.</em>
        </h3>
        <p className="mt-2 font-sans text-sm text-muted-foreground max-w-xl">
          {deck}
        </p>
      </div>

      {/* Controls row */}
      <div className="mt-8 flex flex-col lg:flex-row lg:items-end gap-6 lg:gap-10">
        <StatusTabs
          counts={statusCounts}
          active={statusFilter}
          onChange={setStatusFilter}
        />
        <div className="flex flex-col sm:flex-row gap-4 lg:ml-auto">
          {showSiteFilter ? (
            <SiteDropdown
              sites={sites}
              value={siteFilter}
              onChange={setSiteFilter}
            />
          ) : null}
          <SearchInput value={query} onChange={setQuery} />
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {mode === "all" ? (
                <HeaderCell sortKey="site" sort={sort} onSort={onSort}>
                  Site
                </HeaderCell>
              ) : null}
              <HeaderCell sortKey="sku" sort={sort} onSort={onSort}>
                SKU
              </HeaderCell>
              <HeaderCell sortKey={null}>Name</HeaderCell>
              <HeaderCell sortKey="abcClass" sort={sort} onSort={onSort} align="center">
                ABC
              </HeaderCell>
              <HeaderCell sortKey="meanDemand" sort={sort} onSort={onSort} align="right">
                Mean
              </HeaderCell>
              <HeaderCell sortKey="stdDev" sort={sort} onSort={onSort} align="right">
                σ
              </HeaderCell>
              <HeaderCell sortKey="cv" sort={sort} onSort={onSort} align="right">
                CV
              </HeaderCell>
              <HeaderCell sortKey="safetyStock" sort={sort} onSort={onSort} align="right">
                Safety
              </HeaderCell>
              <HeaderCell sortKey="reorderPoint" sort={sort} onSort={onSort} align="right">
                ROP
              </HeaderCell>
              <HeaderCell sortKey="maxInventory" sort={sort} onSort={onSort} align="right">
                Max
              </HeaderCell>
            </tr>
          </thead>
          <tbody>
            {pageSlice.length === 0 ? (
              <tr>
                <td
                  colSpan={mode === "all" ? 10 : 9}
                  className="py-20 text-center font-serif italic text-muted-foreground border-t border-foreground/10"
                >
                  No SKUs match the current filters.
                </td>
              </tr>
            ) : (
              pageSlice.map((r) => (
                <ExpandableResultRow key={`${r.site}-${r.sku}`} row={r} mode={mode} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 ? (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          onChange={setPage}
          totalItems={filteredSorted.length}
          pageSize={pageSize}
        />
      ) : (
        <div className="mt-4 font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {filteredSorted.length} rows
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Table row
// ---------------------------------------------------------------------------

function ExpandableResultRow({
  row,
  mode,
}: {
  row: SkuResult;
  mode: "all" | "total" | "single";
}) {
  const [expanded, setExpanded] = useState(false);
  const colCount = mode === "all" ? 10 : 9;

  return (
    <>
      <tr
        onClick={() => setExpanded((p) => !p)}
        className={cn(
          "border-t border-foreground/10 hover:bg-[#F3EEE7] transition-colors duration-300 cursor-pointer select-none",
          expanded && "bg-[#F3EEE7]"
        )}
      >
        {mode === "all" ? (
          <Cell>
            <span className="font-mono text-xs text-muted-foreground">
              {row.site}
            </span>
          </Cell>
        ) : null}
        <Cell>
          <span className="font-mono text-xs text-foreground">{row.sku}</span>
        </Cell>
        <Cell>
          <span className="font-sans text-sm text-foreground/80 line-clamp-1 max-w-xs block">
            {row.name || "—"}
          </span>
        </Cell>
        <Cell align="center">
          <AbcBadge cls={row.abcClass} priceMissing={row.isPriceMissing} />
        </Cell>
        <NumericCell value={row.meanDemand} decimals={0} />
        <NumericCell value={row.stdDev} decimals={0} />
        <NumericCell value={row.cv} decimals={2} />
        <NumericCell value={row.safetyStock} decimals={0} bold statusTone={row.status} />
        <NumericCell value={row.reorderPoint} decimals={0} />
        <NumericCell value={row.maxInventory} decimals={0} />
      </tr>
      {expanded ? (
        <tr>
          <td
            colSpan={colCount}
            className="border-l-2 border-l-[color:var(--color-accent)] bg-[#F3EEE7]/50 px-6 py-5"
          >
            <DemandHeatmap values={row.monthlyValues} safetyStock={row.safetyStock} mean={row.meanDemand} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Demand heatmap (expandable row content)
// ---------------------------------------------------------------------------

function DemandHeatmap({
  values,
  safetyStock,
  mean,
}: {
  values: number[];
  safetyStock: number;
  mean: number;
}) {
  if (!values || values.length === 0) {
    return (
      <span className="font-serif italic text-sm text-muted-foreground">
        No period data available.
      </span>
    );
  }

  const maxVal = Math.max(...values, 1);

  return (
    <div>
      <span className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Period demand
      </span>

      <div className="mt-3 flex flex-wrap gap-1">
        {values.map((v, i) => {
          const tone = demandTone(v, mean, safetyStock);
          const height = Math.max(4, Math.round((v / maxVal) * 32));
          return (
            <div
              key={i}
              className="flex flex-col items-center gap-1"
              title={`Period ${i + 1}: ${formatNumber(v, 0)}`}
            >
              <div
                className={cn("w-5 transition-all duration-300", tone)}
                style={{ height: `${height}px` }}
              />
              <span className="font-mono text-[9px] text-muted-foreground/60 tabular-nums">
                {v > 0 ? formatNumber(v, 0) : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-6 font-sans text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-[rgba(58,90,64,0.20)]" />
          Above mean
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-[rgba(194,167,112,0.20)]" />
          Below mean
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-[rgba(139,38,53,0.15)]" />
          Zero demand
        </span>
        <span className="ml-auto font-mono tabular-nums">
          {values.length} periods · SS: {formatNumber(safetyStock, 0)}
        </span>
      </div>
    </div>
  );
}

function demandTone(value: number, mean: number, _ss: number): string {
  if (value <= 0) return "bg-[rgba(139,38,53,0.15)]";
  if (value >= mean) return "bg-[rgba(58,90,64,0.20)]";
  return "bg-[rgba(194,167,112,0.20)]";
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function HeaderCell({
  children,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  children: React.ReactNode;
  sortKey: SortKey | null;
  sort?: { key: SortKey; dir: SortDir };
  onSort?: (k: SortKey) => void;
  align?: "left" | "center" | "right";
}) {
  const clickable = sortKey && onSort;
  const active = sortKey && sort?.key === sortKey;
  return (
    <th
      scope="col"
      className={cn(
        "py-3 px-3 font-sans text-[10px] uppercase tracking-[0.25em] text-muted-foreground select-none",
        "border-b border-foreground/30",
        clickable && "cursor-pointer hover:text-foreground transition-colors duration-300",
        align === "right" && "text-right",
        align === "center" && "text-center",
        active && "text-foreground"
      )}
      onClick={() => clickable && onSort(sortKey!)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? (
          <span className="text-accent">{sort!.dir === "asc" ? "↑" : "↓"}</span>
        ) : null}
      </span>
    </th>
  );
}

function Cell({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
}) {
  return (
    <td
      className={cn(
        "py-3 px-3",
        align === "right" && "text-right",
        align === "center" && "text-center"
      )}
    >
      {children}
    </td>
  );
}

function NumericCell({
  value,
  decimals,
  bold = false,
  statusTone,
}: {
  value: number | null | undefined;
  decimals: number;
  bold?: boolean;
  statusTone?: StockStatus;
}) {
  const tone =
    statusTone === "red"
      ? "text-[color:var(--color-shortage)]"
      : statusTone === "blue"
      ? "text-[color:var(--color-overstock)]"
      : "text-foreground";

  return (
    <td className="py-3 px-3 text-right">
      <span
        className={cn(
          "font-mono tabular-nums",
          bold ? "text-base font-medium" : "text-sm",
          bold ? tone : "text-foreground"
        )}
      >
        {formatNumber(value, decimals)}
      </span>
    </td>
  );
}

function AbcBadge({ cls, priceMissing }: { cls: "A" | "B" | "C"; priceMissing?: boolean }) {
  const bg =
    priceMissing
      ? "border border-dashed border-foreground/30 text-muted-foreground bg-transparent"
      : cls === "A"
      ? "bg-[color:var(--color-abc-a)] text-background"
      : cls === "B"
      ? "bg-[color:var(--color-abc-b)] text-background"
      : "bg-[color:var(--color-abc-c)] text-background";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-6 h-6",
        "font-mono text-[10px] font-medium",
        bg
      )}
      title={priceMissing ? "Price data missing — defaulted to class C" : undefined}
    >
      {priceMissing ? "C*" : cls}
    </span>
  );
}

function StatusTabs({
  counts,
  active,
  onChange,
}: {
  counts: Record<"all" | StockStatus, number>;
  active: "all" | StockStatus;
  onChange: (v: "all" | StockStatus) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-6">
      {STATUS_FILTERS.map((f) => {
        const isActive = active === f.key;
        const count = counts[f.key];
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            className={cn(
              "text-left pb-2 border-b transition-colors duration-500 ease-luxury",
              isActive
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="block font-sans text-[10px] uppercase tracking-[0.3em]">
              {f.description}
            </span>
            <span className="mt-1 block font-serif text-xl leading-none">
              {f.label}{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {count}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SiteDropdown({
  sites,
  value,
  onChange,
}: {
  sites: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Site
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-1 bg-transparent border-0 border-b border-foreground py-2 pr-6 min-w-[10rem]",
          "font-sans text-sm text-foreground appearance-none cursor-pointer",
          "focus:outline-none focus:border-accent transition-colors duration-500 ease-luxury"
        )}
      >
        <option value="all">All sites</option>
        {sites.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Search
      </label>
      <input
        type="search"
        placeholder="SKU or product name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-1 bg-transparent border-0 border-b border-foreground py-2 w-full sm:w-64",
          "font-sans text-sm text-foreground placeholder:italic placeholder:text-muted-foreground/60",
          "focus:outline-none focus:border-accent transition-colors duration-500 ease-luxury"
        )}
      />
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="mt-6 flex items-center justify-between gap-4 border-t border-foreground/10 pt-4">
      <div className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        {start}–{end} of {totalItems}
      </div>
      <div className="flex items-center gap-2">
        <PageBtn disabled={page <= 1} onClick={() => onChange(page - 1)}>
          ←
        </PageBtn>
        <span className="px-2 font-mono text-xs text-foreground tabular-nums">
          {page} / {totalPages}
        </span>
        <PageBtn disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          →
        </PageBtn>
      </div>
    </div>
  );
}

function PageBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center w-8 h-8 border",
        "font-mono text-sm",
        disabled
          ? "border-foreground/10 text-foreground/20 cursor-not-allowed"
          : "border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors duration-500 ease-luxury"
      )}
    >
      {children}
    </button>
  );
}
