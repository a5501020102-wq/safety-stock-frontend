"use client";

import { useCallback, useRef, useState } from "react";
import { ApiClientError, api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useUploadSlot, type UploadSlotType } from "@/lib/workflow-context";
import type {
  UploadPlanResponse,
  UploadPriceResponse,
  UploadSalesResponse,
} from "@/lib/types";

type UploadValue =
  | UploadSalesResponse
  | UploadPriceResponse
  | UploadPlanResponse;

type UploadFn = (
  file: File,
  options?: { onProgress?: (e: { percent: number }) => void }
) => Promise<UploadValue>;

interface UploadCardProps {
  slot: UploadSlotType;
  numeral: string; // "I" / "II" / "III"
  title: React.ReactNode; // 封面大字
  required?: boolean;
  hint: string; // 欄位提示
}

/**
 * UploadCard
 * ---------------------------------------------------------------------------
 * Editorial drop-zone card for a single file slot (sales / price / plan).
 *
 * States:
 *   1. Empty  — drag & drop zone with "browse" fallback
 *   2. Busy   — uploading with progress %
 *   3. Done   — shows detected metadata (sites, SKUs, date range)
 *   4. Error  — shows message + "Try again" button
 *
 * Layout follows the luxury spec: 0 radius, top-border only, generous
 * padding, gold accent on drag-over and focus, 500ms transitions.
 */
export function UploadCard({
  slot,
  numeral,
  title,
  required = false,
  hint,
}: UploadCardProps) {
  const { value, set, clear } = useUploadSlot(slot);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setDragOver] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFn: UploadFn =
    slot === "sales"
      ? (api.uploadSales as UploadFn)
      : slot === "price"
      ? (api.uploadPrice as UploadFn)
      : (api.uploadPlan as UploadFn);

  const handleFile = useCallback(
    async (file: File) => {
      // Front-end extension guard (backend re-validates).
      const name = file.name.toLowerCase();
      if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
        setError("僅支援 .xlsx 或 .xls 檔案");
        return;
      }
      setError(null);
      setUploading(true);
      setProgress(0);

      try {
        const result = await uploadFn(file, {
          onProgress: ({ percent }) => setProgress(percent),
        });
        set(result);
      } catch (e) {
        if (e instanceof ApiClientError) {
          setError(e.message);
        } else if (e instanceof DOMException && e.name === "AbortError") {
          setError("已取消上傳");
        } else {
          setError((e as Error).message || "上傳失敗");
        }
      } finally {
        setUploading(false);
      }
    },
    [uploadFn, set]
  );

  const onBrowse = () => inputRef.current?.click();

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected after a failure.
    e.target.value = "";
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isUploading && !value) setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the card entirely (currentTarget === target).
    if (e.target === e.currentTarget) setDragOver(false);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (isUploading || value) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onReset = () => {
    clear();
    setError(null);
    setProgress(0);
  };

  // --------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------

  const borderAccent = isDragOver
    ? "border-t-accent"
    : value
    ? "border-t-foreground"
    : "border-t-foreground/40";

  return (
    <article
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "relative flex flex-col border-t-[3px] transition-colors duration-500 ease-luxury",
        borderAccent,
        "bg-background p-8 md:p-10 min-h-[22rem]",
        isDragOver && "bg-muted/40"
      )}
      aria-label={`${slot} upload slot`}
    >
      {/* Slot overline */}
      <div className="flex items-center justify-between gap-4">
        <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          <span className="text-foreground">{numeral}</span>
          <span className="mx-3">·</span>
          {required ? "Required" : "Optional"}
        </span>
        {value && !isUploading ? (
          <button
            type="button"
            onClick={onReset}
            className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors duration-500 ease-luxury"
          >
            Clear
          </button>
        ) : null}
      </div>

      {/* Card title */}
      <h3 className="mt-6 font-serif text-3xl md:text-4xl leading-[1.05] text-foreground">
        {title}
      </h3>

      <p className="mt-3 font-sans text-sm leading-relaxed text-muted-foreground">
        {hint}
      </p>

      {/* Divider */}
      <div className="mt-6 h-px w-full bg-foreground/15" />

      {/* Body changes by state */}
      <div className="mt-6 flex-1 flex flex-col">
        {isUploading ? (
          <UploadBusy progress={progress} />
        ) : value ? (
          <UploadDone slot={slot} value={value} />
        ) : (
          <UploadIdle onBrowse={onBrowse} hasError={Boolean(error)} />
        )}
      </div>

      {/* Error message */}
      {error && !isUploading ? (
        <p className="mt-4 font-sans text-xs text-[color:var(--color-shortage)]">
          {error}
        </p>
      ) : null}

      {/* Hidden native input */}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={onInputChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </article>
  );
}

// ---------------------------------------------------------------------------
// Sub-states
// ---------------------------------------------------------------------------

function UploadIdle({
  onBrowse,
  hasError,
}: {
  onBrowse: () => void;
  hasError: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col items-start justify-end gap-4">
      <p className="font-serif italic text-base text-muted-foreground">
        {hasError
          ? "Try again. Drag a file or browse from your machine."
          : "Drop an .xlsx file here, or browse from your machine."}
      </p>
      <button
        type="button"
        onClick={onBrowse}
        className="group/btn relative inline-flex items-center justify-center overflow-hidden border border-foreground bg-foreground px-8 py-3 font-sans text-[11px] uppercase tracking-[0.2em] text-background"
      >
        {/* Gold slides in from the left on button hover; text stays white */}
        <span
          aria-hidden="true"
          className="absolute inset-0 -translate-x-full bg-accent transition-transform duration-500 ease-luxury group-hover/btn:translate-x-0"
        />
        <span className="relative z-10">Browse files</span>
      </button>
    </div>
  );
}

function UploadBusy({ progress }: { progress: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(progress)));
  return (
    <div className="flex-1 flex flex-col justify-end gap-4">
      <div className="flex items-end justify-between">
        <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Transmitting
        </span>
        <span className="font-mono text-sm tabular-nums text-foreground">
          {pct}
          <span className="text-muted-foreground text-xs">%</span>
        </span>
      </div>
      <div className="h-px w-full bg-foreground/15 relative overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-accent transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="font-serif italic text-sm text-muted-foreground">
        Reading the ledger…
      </p>
    </div>
  );
}

function UploadDone({
  slot,
  value,
}: {
  slot: UploadSlotType;
  value: UploadValue;
}) {
  const rows: Array<[string, React.ReactNode]> = [];
  rows.push([
    "File",
    <span key="f" className="font-mono text-xs break-all">
      {value.filename}
    </span>,
  ]);
  rows.push(["Size", `${formatKB(value.fileSizeBytes)}`]);

  if (slot === "sales") {
    const v = value as UploadSalesResponse;
    rows.push(["Records", v.recordCount.toLocaleString()]);
    rows.push([
      "Sites",
      v.detectedSites.length > 0 ? v.detectedSites.join(", ") : "—",
    ]);
    rows.push(["SKUs", v.detectedSkus.toLocaleString()]);
    rows.push([
      "Range",
      v.dateRange.start && v.dateRange.end
        ? `${v.dateRange.start} → ${v.dateRange.end}`
        : "—",
    ]);
    if (v.maxDate) {
      rows.push(["Latest", v.maxDate.split("T")[0]]);
    }
  } else if (slot === "price") {
    const v = value as UploadPriceResponse;
    rows.push(["Records", v.recordCount.toLocaleString()]);
  } else if (slot === "plan") {
    const v = value as UploadPlanResponse;
    rows.push(["Items", v.itemCount.toLocaleString()]);
    rows.push([
      "Months",
      v.detectedMonths.length > 0 ? `${v.detectedMonths.length} detected` : "—",
    ]);
  }

  return (
    <dl className="flex-1 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 content-start text-sm">
      {rows.map(([label, val]) => (
        <div
          key={label}
          className="contents text-sm"
        >
          <dt className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground pt-1">
            {label}
          </dt>
          <dd className="font-sans text-foreground">
            {val}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatKB(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
