"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  CalculateRequestParams,
  CalculationResponse,
  UploadPlanResponse,
  UploadPriceResponse,
  UploadSalesResponse,
} from "./types";

/**
 * WorkflowContext
 * ---------------------------------------------------------------------------
 * Holds the single-page tool's cross-section state: uploaded files,
 * calculation parameters, and the most recent results.
 *
 * Persists a SMALL subset to localStorage so a refresh doesn't send the user
 * back to step one (just the lightweight metadata — not the full result set,
 * which is re-fetched by re-running calculate).
 *
 * Design:
 *  - One provider near the root of the interactive tree.
 *  - Reducers are intentionally tiny and explicit (no Redux).
 *  - Each section reads only what it needs via the hooks exposed below.
 */

export type UploadSlotType = "sales" | "price" | "plan";

type UploadValue = UploadSalesResponse | UploadPriceResponse | UploadPlanResponse;

export interface WorkflowState {
  uploads: {
    sales: UploadSalesResponse | null;
    price: UploadPriceResponse | null;
    plan: UploadPlanResponse | null;
  };
  parameters: CalculateRequestParams;
  calculationResult: CalculationResponse | null;
  isCalculating: boolean;
  calculationError: string | null;
}

export interface WorkflowActions {
  setUpload(slot: "sales", value: UploadSalesResponse): void;
  setUpload(slot: "price", value: UploadPriceResponse): void;
  setUpload(slot: "plan", value: UploadPlanResponse): void;
  clearUpload(slot: UploadSlotType): void;
  setParameters(patch: Partial<CalculateRequestParams>): void;
  setCalculationResult(result: CalculationResponse | null): void;
  setCalculating(flag: boolean): void;
  setCalculationError(message: string | null): void;
  reset(): void;
}

const DEFAULT_PARAMETERS: CalculateRequestParams = {
  calcMode: "compare",
  granularity: "monthly",
  selectedMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  dateFrom: null,
  dateTo: null,
  leadTime: 30,
  minMonths: 2,
  enableOutlier: true,
  enableMa: false,
  maWindow: 3,
  zScores: { A: 2.05, B: 1.65, C: 1.28 },
  abcThresholds: { A: 0.8, B: 0.95 },
  targetSite: null,
  trendMode: "none",
  workingDaysPerMonth: null,
};

const INITIAL_STATE: WorkflowState = {
  uploads: { sales: null, price: null, plan: null },
  parameters: DEFAULT_PARAMETERS,
  calculationResult: null,
  isCalculating: false,
  calculationError: null,
};

type WorkflowContextValue = WorkflowState & WorkflowActions;

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

// ---------------------------------------------------------------------------
// localStorage helpers (light persistence for upload slots + params only)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "ss-workflow:v1";

interface PersistedShape {
  uploads: WorkflowState["uploads"];
  parameters: CalculateRequestParams;
}

function loadPersisted(): Partial<PersistedShape> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedShape;
    return parsed;
  } catch {
    return {};
  }
}

function savePersisted(payload: PersistedShape) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage full / disabled — not fatal.
  }
}

function clearPersisted() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<WorkflowState["uploads"]>(INITIAL_STATE.uploads);
  const [parameters, setParametersState] = useState<CalculateRequestParams>(DEFAULT_PARAMETERS);
  const [calculationResult, setCalculationResult] = useState<CalculationResponse | null>(null);
  const [isCalculating, setCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  // Hydrate from localStorage on mount (client-only).
  // calculationResult is NOT restored — user must re-calculate after refresh.
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted.uploads) setUploads(persisted.uploads);
    if (persisted.parameters) {
      setParametersState({ ...DEFAULT_PARAMETERS, ...persisted.parameters });
    }
  }, []);

  // Persist on changes (uploads + parameters only).
  useEffect(() => {
    savePersisted({ uploads, parameters });
  }, [uploads, parameters]);

  const setUpload = useCallback((slot: UploadSlotType, value: UploadValue) => {
    setUploads((prev) => ({ ...prev, [slot]: value }));
  }, []) as WorkflowActions["setUpload"];

  const clearUpload = useCallback((slot: UploadSlotType) => {
    setUploads((prev) => ({ ...prev, [slot]: null }));
  }, []);

  const setParameters = useCallback((patch: Partial<CalculateRequestParams>) => {
    setParametersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setUploads(INITIAL_STATE.uploads);
    setParametersState(DEFAULT_PARAMETERS);
    setCalculationResult(null);
    setCalculating(false);
    setCalculationError(null);
    clearPersisted();
  }, []);

  const value = useMemo<WorkflowContextValue>(
    () => ({
      uploads,
      parameters,
      calculationResult,
      isCalculating,
      calculationError,
      setUpload,
      clearUpload,
      setParameters,
      setCalculationResult,
      setCalculating,
      setCalculationError,
      reset,
    }),
    [
      uploads,
      parameters,
      calculationResult,
      isCalculating,
      calculationError,
      setUpload,
      clearUpload,
      setParameters,
      reset,
    ]
  );

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useWorkflow(): WorkflowContextValue {
  const ctx = useContext(WorkflowContext);
  if (!ctx) {
    throw new Error("useWorkflow must be used inside a <WorkflowProvider>");
  }
  return ctx;
}

/**
 * Convenience hook for a single upload slot.
 *
 * Returns the unioned `UploadValue | null` so callers narrow at the usage
 * site (e.g. `if (slot === "sales") { ... value as UploadSalesResponse }`).
 * UploadCard already does this via props, so overloading here added
 * complexity without real type-safety benefit.
 */
export function useUploadSlot(slot: UploadSlotType): {
  value: UploadValue | null;
  set: (value: UploadValue) => void;
  clear: () => void;
} {
  const { uploads, setUpload, clearUpload } = useWorkflow();
  const value = uploads[slot];
  const set = useCallback(
    (v: UploadValue) => {
      (setUpload as (s: UploadSlotType, v: UploadValue) => void)(slot, v);
    },
    [setUpload, slot]
  );
  const clear = useCallback(() => clearUpload(slot), [clearUpload, slot]);
  return { value, set, clear };
}
