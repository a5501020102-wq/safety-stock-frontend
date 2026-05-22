"use client";

import { useWorkflow } from "@/lib/workflow-context";
import { formatNumber } from "@/lib/format";
import type { CalculationResponse, CalculationSummary, ComparisonStats, ParametersSnapshot } from "@/lib/types";

/**
 * ResultsSummary
 * ---------------------------------------------------------------------------
 * Renders the "deck" of the Analysis spread:
 *   1. ParametersSnapshot strip (immutable record of what was computed)
 *   2. Four editorial stat cards (per-mode shape)
 *
 * For single mode (all / total) we show health distribution.
 * For compare mode we show the inventory-saving headline.
 */
export function ResultsSummary() {
  const { calculationResult } = useWorkflow();
  if (!calculationResult) return null;

  return (
    <div className="mt-16 flex flex-col gap-16">
      <ParametersRow parameters={calculationResult.parameters} />
      <StatCards result={calculationResult} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parameters snapshot strip
// ---------------------------------------------------------------------------

function ParametersRow({ parameters: p }: { parameters: ParametersSnapshot }) {
  const entries: Array<[string, React.ReactNode]> = [
    ["模式", formatMode(p.calcMode)],
    ["粒度", formatGranularity(p.granularity ?? "monthly")],
    ["範圍", p.dataMinDate && p.dataMaxDate ? `${p.dataMinDate} → ${p.dataMaxDate}` : "—"],
    ["排除", p.excludedMonth ?? "—"],
    ["前置期", `${p.leadTimeDays} 天`],
    ["最少期數", String(p.minMonths)],
    ["Z (A/B/C)", `${p.zScores.A} / ${p.zScores.B} / ${p.zScores.C}`],
    ["月份", `${p.selectedMonths.length}/12`],
    ["離群值", p.enableOutlier ? "MAD 已啟用" : "停用"],
    ["移動平均", p.enableMa ? `啟用（${p.maWindow}）` : "停用"],
    ["執行時間", `${Math.round(p.executionTimeMs)} ms`],
  ];

  return (
    <div className="border-t border-foreground/20 pt-6">
      <span className="block font-sans text-[10px] tracking-[0.3em] text-muted-foreground">計算條件</span>
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-4">
        {entries.map(([label, val]) => (
          <div key={label}>
            <dt className="font-sans text-[9px] tracking-[0.3em] text-muted-foreground/70">{label}</dt>
            <dd className="mt-1 font-mono text-sm text-foreground tabular-nums">{val}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat cards
// ---------------------------------------------------------------------------

function StatCards({ result }: { result: CalculationResponse }) {
  const cards = buildCards(result);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {cards.map((c) => (
        <StatCard key={c.label} {...c} />
      ))}
    </div>
  );
}

interface CardSpec {
  label: string;
  value: string;
  hint: string;
  accent?: boolean; // gold left stripe
}

function StatCard({ label, value, hint, accent = false }: CardSpec) {
  return (
    <article
      className={`relative border-t border-foreground/25 pt-6 pl-4 min-h-[8rem] ${
        accent ? "border-l-[3px] border-l-accent" : ""
      }`}
    >
      <span className="block font-sans text-[10px] tracking-[0.3em] text-muted-foreground">{label}</span>
      <p className="mt-3 font-serif text-4xl md:text-5xl leading-none tabular-nums text-foreground">{value}</p>
      <p className="mt-3 font-sans text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Shape the cards per-mode
// ---------------------------------------------------------------------------

function buildCards(result: CalculationResponse): CardSpec[] {
  if (result.mode === "compare") {
    const c: ComparisonStats = result.comparison;
    return [
      {
        label: "分倉 · 安全庫存",
        value: formatNumber(c.totalAllSafetyStock),
        hint: `${c.allSkuCount} 個料號（跨出貨點）`,
      },
      {
        label: "總倉 · 安全庫存",
        value: formatNumber(c.totalTotalSafetyStock),
        hint: `${c.totalSkuCount} 個料號（合併）`,
      },
      {
        label: "節省庫存",
        value: formatNumber(c.inventorySaved),
        hint: `減少 ${c.savingsPercentage.toFixed(1)}%`,
        accent: true,
      },
      {
        label: "節省金額",
        value: `$${formatNumber(Math.round(c.costSaved))}`,
        hint: `分倉價值的 ${c.savingsValuePercentage.toFixed(1)}%`,
        accent: true,
      },
    ];
  }

  const s: CalculationSummary = result.summary;
  return [
    {
      label: "有效料號",
      value: formatNumber(s.totalSkus),
      hint: `已排除 ${s.excludedCount} 筆（資料不足）`,
    },
    {
      label: "缺貨風險",
      value: formatNumber(s.shortageRiskCount),
      hint: "庫存低於安全線",
    },
    {
      label: "健康",
      value: formatNumber(s.healthyCount),
      hint: "在政策範圍內",
    },
    {
      label: "過量",
      value: formatNumber(s.overstockRiskCount),
      hint: "超過 3 倍安全庫存",
    },
  ];
}

function formatMode(mode: string): string {
  const map: Record<string, string> = {
    all: "分倉",
    total: "總倉",
    compare: "對比",
    single: "單倉",
  };
  return map[mode] ?? mode;
}

function formatGranularity(g: string): string {
  const map: Record<string, string> = {
    monthly: "月",
    weekly: "週",
    daily: "日",
  };
  return map[g] ?? g;
}
