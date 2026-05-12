/**
 * API client — thin fetch wrapper around the Flask backend.
 *
 * Design:
 *  - Base URL is env-driven (NEXT_PUBLIC_API_URL). In production set to the
 *    Render deployment; in dev defaults to localhost:5000.
 *  - Parses JSON responses and throws a typed ApiClientError when the backend
 *    returns { success: false, error, code } so callers get one try/catch.
 *  - Exposes a separate helper for binary downloads (Excel / CSV / SAP).
 *  - Never stores anything in localStorage itself — callers decide what to
 *    persist. Keeps this module side-effect-free.
 */

import type {
  ApiError,
  ApiErrorCode,
  CalculateRequest,
  CalculationResponse,
  ExcelExportRequest,
  MaDetailRequest,
  MaDetailResponse,
  MaterialGroupsResponse,
  SapExportRequest,
  UploadPlanResponse,
  UploadPriceResponse,
  UploadSalesResponse,
} from "./types";

const DEFAULT_API = "http://localhost:5000";

// Warn once (client-side) if NEXT_PUBLIC_API_URL wasn't set. A silent
// fallback to localhost:5000 in production would look like a CORS bug to
// the end user.
let _apiWarned = false;

export function getApiBase(): string {
  // NEXT_PUBLIC_ env vars are inlined at build time; safe to read on both
  // server and client.
  const url = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!url) {
    if (typeof window !== "undefined" && !_apiWarned) {
      _apiWarned = true;
      console.warn(
        "[api] NEXT_PUBLIC_API_URL is not set. Falling back to http://localhost:5000. " +
          "Set this in .env.local (dev) or your deployment env (prod)."
      );
    }
    return DEFAULT_API;
  }
  return url;
}

// ----------------------------------------------------------------------------
// Error class
// ----------------------------------------------------------------------------

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly detail?: string;

  constructor(message: string, code: ApiErrorCode, status: number, detail?: string) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

// ----------------------------------------------------------------------------
// Upload with progress — uses XMLHttpRequest because `fetch` doesn't expose
// upload progress events in any cross-browser way.
// ----------------------------------------------------------------------------

export interface UploadProgressEvent {
  loaded: number; // bytes sent so far
  total: number; // total bytes (0 if unknown)
  percent: number; // 0-100 (0 if total unknown)
}

export interface UploadOptions {
  /** 0-100 progress callback */
  onProgress?: (event: UploadProgressEvent) => void;
  /** Abort the upload if the signal fires. */
  signal?: AbortSignal;
}

/**
 * POST a single file to the given path and return the parsed JSON response.
 *
 * Emits `onProgress` while the browser streams the body. Honors `signal` for
 * cancellation. Surfaces the backend's standard `{success, error, code}`
 * error contract as an ApiClientError.
 */
export function uploadFileWithProgress<T>(path: string, file: File, options: UploadOptions = {}): Promise<T> {
  const { onProgress, signal } = options;
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload aborted", "AbortError"));
      return;
    }

    const url = `${getApiBase()}${path}`;
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (!onProgress) return;
      const total = e.lengthComputable ? e.total : 0;
      const percent = total > 0 ? (e.loaded / total) * 100 : 0;
      onProgress({ loaded: e.loaded, total, percent });
    });

    xhr.addEventListener("load", () => {
      let data: unknown;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new ApiClientError(`Upload: non-JSON response (HTTP ${xhr.status})`, "INTERNAL_ERROR", xhr.status));
        return;
      }

      if (isApiError(data)) {
        reject(new ApiClientError(data.error, data.code, xhr.status, data.detail));
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiClientError(`Upload failed with HTTP ${xhr.status}`, "INTERNAL_ERROR", xhr.status));
        return;
      }

      resolve(data as T);
    });

    xhr.addEventListener("error", () => {
      reject(new ApiClientError("Network error during upload", "INTERNAL_ERROR", 0));
    });

    xhr.addEventListener("abort", () => {
      reject(new DOMException("Upload aborted", "AbortError"));
    });

    if (signal) {
      const onAbort = () => xhr.abort();
      signal.addEventListener("abort", onAbort, { once: true });
      // Make sure we clean up the listener once the request settles.
      xhr.addEventListener("loadend", () => signal.removeEventListener("abort", onAbort));
    }

    xhr.open("POST", url);
    xhr.send(form);
  });
}

// ----------------------------------------------------------------------------
// Core fetch helpers
// ----------------------------------------------------------------------------

async function jsonRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  // The backend returns JSON for both success and error cases.
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ApiClientError(`Server returned non-JSON response (HTTP ${res.status})`, "INTERNAL_ERROR", res.status);
  }

  // Error contract: { success: false, error, code }
  if (isApiError(data)) {
    throw new ApiClientError(data.error, data.code, res.status, data.detail);
  }

  if (!res.ok) {
    throw new ApiClientError(`HTTP ${res.status}`, "INTERNAL_ERROR", res.status);
  }

  return data as T;
}

function isApiError(data: unknown): data is ApiError {
  return (
    typeof data === "object" && data !== null && "success" in data && (data as { success: unknown }).success === false
  );
}

/**
 * Binary download. Returns the Blob along with the filename extracted from
 * Content-Disposition (so we can offer the correct save-as name).
 */
async function downloadRequest(path: string, body: unknown): Promise<{ blob: Blob; filename: string }> {
  const url = `${getApiBase()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    // Error responses from the backend are JSON even on binary endpoints
    // (they never start streaming a file before validating the request).
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new ApiClientError(`Download failed: HTTP ${res.status}`, "EXPORT_FAILED", res.status);
    }
    if (isApiError(data)) {
      throw new ApiClientError(data.error, data.code, res.status, data.detail);
    }
    throw new ApiClientError(`HTTP ${res.status}`, "EXPORT_FAILED", res.status);
  }

  const blob = await res.blob();
  const filename = parseContentDispositionFilename(res.headers.get("content-disposition"));
  return { blob, filename };
}

function parseContentDispositionFilename(header: string | null): string {
  if (!header) return "download";

  // Prefer RFC 5987 extended form: filename*=UTF-8''<percent-encoded>
  // Terminator: semicolon, whitespace, or end-of-string.
  const rfc5987 = header.match(/filename\*=(?:UTF-8'')?([^;\s]+)/i);
  if (rfc5987) {
    try {
      return decodeURIComponent(rfc5987[1].replace(/^"|"$/g, ""));
    } catch {
      // Malformed percent-encoding — fall through to plain form.
    }
  }

  // Fallback: filename="xxx" or filename=xxx
  const plain = header.match(/filename=("?)([^";]+)\1/i);
  if (plain) return plain[2].trim();

  return "download";
}

// ----------------------------------------------------------------------------
// Endpoints
// ----------------------------------------------------------------------------

export const api = {
  /** Root health check. */
  health(): Promise<{
    status: string;
    service: string;
    version: string;
    legacyUi: string;
    modulesAvailable: boolean;
  }> {
    return jsonRequest("/");
  },

  /** Fetch material group categories for category-LT panel. */
  materialGroups(): Promise<MaterialGroupsResponse> {
    return jsonRequest("/api/material-groups");
  },

  /** Upload sales Excel. Emits progress events; supports abort via signal. */
  uploadSales(file: File, options?: UploadOptions): Promise<UploadSalesResponse> {
    return uploadFileWithProgress("/api/upload/sales", file, options);
  },

  /** Upload price Excel (optional). */
  uploadPrice(file: File, options?: UploadOptions): Promise<UploadPriceResponse> {
    return uploadFileWithProgress("/api/upload/price", file, options);
  },

  /** Upload plan Excel (optional). */
  uploadPlan(file: File, options?: UploadOptions): Promise<UploadPlanResponse> {
    return uploadFileWithProgress("/api/upload/plan", file, options);
  },

  /** Run safety stock calculation. */
  calculate(body: CalculateRequest): Promise<CalculationResponse> {
    return jsonRequest("/api/calculate", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** Generate Excel file. */
  exportExcel(body: ExcelExportRequest) {
    return downloadRequest("/api/export/excel", body);
  },

  /** Generate SAP MM17 file. */
  exportSap(body: SapExportRequest) {
    return downloadRequest("/api/export/sap", body);
  },

  /** Moving-average detail for a single SKU (pure compute). */
  maDetail(body: MaDetailRequest): Promise<MaDetailResponse> {
    return jsonRequest("/api/ma-detail", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
