// @ts-check
/**
 * 後端 API 客戶端。
 *
 * - 後端錯誤一律是 { success: false, error, code }，轉成 ApiClientError 讓呼叫端單一 try/catch
 * - 上傳用 XMLHttpRequest，因為 fetch 無法回報上傳進度
 * - 本模組不讀寫 localStorage，是否保存由呼叫端決定
 */

import { API_BASE } from "../../config.js";

/** @typedef {import("./types").ApiErrorCode} ApiErrorCode */
/** @typedef {import("./types").CalculateRequest} CalculateRequest */
/** @typedef {import("./types").CalculationResponse} CalculationResponse */
/** @typedef {import("./types").ExcelExportRequest} ExcelExportRequest */
/** @typedef {import("./types").SapExportRequest} SapExportRequest */
/** @typedef {import("./types").MaterialGroupsResponse} MaterialGroupsResponse */
/** @typedef {import("./types").UploadSalesResponse} UploadSalesResponse */
/** @typedef {import("./types").UploadPriceResponse} UploadPriceResponse */
/** @typedef {import("./types").UploadPlanResponse} UploadPlanResponse */
/** @typedef {"sales" | "price" | "plan"} UploadSlot */
/** @typedef {UploadSalesResponse | UploadPriceResponse | UploadPlanResponse} UploadResponse */

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;
const PERCENT = 100;

export class ApiClientError extends Error {
  /**
   * @param {string} message
   * @param {ApiErrorCode} code
   * @param {number} status
   * @param {string} [detail]
   */
  constructor(message, code, status, detail) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

/**
 * @param {unknown} data
 * @returns {data is import("./types").ApiError}
 */
function isApiError(data) {
  return typeof data === "object" && data !== null && "success" in data && data.success === false;
}

/** @param {number} status */
function isOk(status) {
  return status >= HTTP_OK_MIN && status <= HTTP_OK_MAX;
}

/**
 * @template T
 * @param {string} path
 * @param {RequestInit} [init]
 * @returns {Promise<T>}
 */
async function jsonRequest(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
    cache: "no-store",
  });
  /** @type {unknown} */
  let data;
  try {
    data = await res.json();
  } catch {
    throw new ApiClientError(`伺服器回應格式錯誤（HTTP ${res.status}）`, "INTERNAL_ERROR", res.status);
  }
  if (isApiError(data)) throw new ApiClientError(data.error, data.code, res.status, data.detail);
  if (!res.ok) throw new ApiClientError(`HTTP ${res.status}`, "INTERNAL_ERROR", res.status);
  return /** @type {T} */ (data);
}

/**
 * 從 Content-Disposition 取出下載檔名；優先使用 RFC 5987 的 filename*= 形式。
 * @param {string | null} header
 * @returns {string}
 */
export function parseContentDispositionFilename(header) {
  if (!header) return "download";
  const extended = header.match(/filename\*=(?:UTF-8'')?([^;\s]+)/i);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].replace(/^"|"$/g, ""));
    } catch {
      // 百分比編碼錯誤時改用一般形式
    }
  }
  const plain = header.match(/filename=("?)([^";]+)\1/i);
  return plain ? plain[2].trim() : "download";
}

/**
 * 下載二進位檔；錯誤回應仍是 JSON（後端在驗證通過前不會開始輸出檔案）。
 * @param {string} path
 * @param {unknown} body
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
async function downloadRequest(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    /** @type {unknown} */
    let data;
    try {
      data = await res.json();
    } catch {
      throw new ApiClientError(`下載失敗（HTTP ${res.status}）`, "EXPORT_FAILED", res.status);
    }
    if (isApiError(data)) throw new ApiClientError(data.error, data.code, res.status, data.detail);
    throw new ApiClientError(`HTTP ${res.status}`, "EXPORT_FAILED", res.status);
  }
  const blob = await res.blob();
  return { blob, filename: parseContentDispositionFilename(res.headers.get("content-disposition")) };
}

/**
 * 上傳單一檔案並回報進度。
 * @template T
 * @param {string} path
 * @param {File} file
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<T>}
 */
function uploadWithProgress(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (onProgress && e.lengthComputable && e.total > 0) onProgress((e.loaded / e.total) * PERCENT);
    });
    xhr.addEventListener("load", () => {
      /** @type {unknown} */
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new ApiClientError(`上傳回應格式錯誤（HTTP ${xhr.status}）`, "INTERNAL_ERROR", xhr.status));
        return;
      }
      if (isApiError(data)) reject(new ApiClientError(data.error, data.code, xhr.status, data.detail));
      else if (!isOk(xhr.status))
        reject(new ApiClientError(`上傳失敗（HTTP ${xhr.status}）`, "INTERNAL_ERROR", xhr.status));
      else resolve(/** @type {T} */ (data));
    });
    xhr.addEventListener("error", () => reject(new ApiClientError("上傳時網路連線中斷", "INTERNAL_ERROR", 0)));

    xhr.open("POST", `${API_BASE}${path}`);
    xhr.send(form);
  });
}

export const api = {
  /** @returns {Promise<MaterialGroupsResponse>} */
  materialGroups() {
    return jsonRequest("/api/material-groups");
  },

  /**
   * @param {UploadSlot} slot
   * @param {File} file
   * @param {(percent: number) => void} [onProgress]
   * @returns {Promise<UploadResponse>}
   */
  upload(slot, file, onProgress) {
    return uploadWithProgress(`/api/upload/${slot}`, file, onProgress);
  },

  /**
   * @param {CalculateRequest} body
   * @returns {Promise<CalculationResponse>}
   */
  calculate(body) {
    return jsonRequest("/api/calculate", { method: "POST", body: JSON.stringify(body) });
  },

  /** @param {ExcelExportRequest} body */
  exportExcel(body) {
    return downloadRequest("/api/export/excel", body);
  },

  /** @param {SapExportRequest} body */
  exportSap(body) {
    return downloadRequest("/api/export/sap", body);
  },
};
