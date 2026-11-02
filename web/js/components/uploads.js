// @ts-check
/**
 * 上傳區段：銷貨明細（必填）、單價表與庫存計畫（選填）。
 *
 * 每張卡片的狀態：未上傳 → 上傳中（進度條）→ 完成（顯示解析摘要）；失敗時顯示錯誤訊息。
 */

import { api, ApiClientError } from "../api/client.js";
import { h, replaceChildren } from "../utils/dom.js";
import { formatBytes } from "../utils/format.js";
import { setUpload } from "../state/workflow.js";
import { setActiveTab } from "./tabs.js";
import { watch } from "../state/store.js";

/** @typedef {import("../state/workflow.js").WorkflowStore} WorkflowStore */
/** @typedef {import("../state/workflow.js").Uploads} Uploads */
/** @typedef {keyof Uploads} Slot */

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls"];

/** @type {Array<{ slot: Slot, title: string, hint: string, isRequired: boolean }>} */
const SLOTS = [
  { slot: "sales", title: "銷貨明細", hint: "出貨點、料號、日期、數量。", isRequired: true },
  { slot: "price", title: "單價表", hint: "料號、單價。用於依金額做 ABC 分級。", isRequired: false },
  { slot: "plan", title: "庫存計畫", hint: "ERP 計畫：目前庫存、需求、供給、調撥。", isRequired: false },
];

/** @param {string} filename */
function isAcceptedFile(filename) {
  const lower = filename.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * 上傳結果的摘要欄位。
 * @param {Slot} slot
 * @param {NonNullable<Uploads[Slot]>} value
 * @returns {Array<[string, string]>}
 */
export function describeUpload(slot, value) {
  /** @type {Array<[string, string]>} */
  const rows = [
    ["檔案", value.filename],
    ["大小", formatBytes(value.fileSizeBytes)],
  ];
  if (slot === "sales") {
    const v = /** @type {import("../api/types").UploadSalesResponse} */ (value);
    rows.push(["筆數", v.recordCount.toLocaleString("en-US")]);
    rows.push(["出貨點", v.detectedSites.length > 0 ? v.detectedSites.join(", ") : "—"]);
    rows.push(["料號", v.detectedSkus.toLocaleString("en-US")]);
    rows.push(["範圍", v.dateRange.start && v.dateRange.end ? `${v.dateRange.start} → ${v.dateRange.end}` : "—"]);
    if (v.maxDate) rows.push(["最新日期", v.maxDate.split("T")[0]]);
  } else if (slot === "price") {
    const v = /** @type {import("../api/types").UploadPriceResponse} */ (value);
    rows.push(["筆數", v.recordCount.toLocaleString("en-US")]);
  } else {
    const v = /** @type {import("../api/types").UploadPlanResponse} */ (value);
    rows.push(["項目", v.itemCount.toLocaleString("en-US")]);
    rows.push(["規劃期間", v.planningHorizon ?? "—"]);
  }
  return rows;
}

/**
 * 卡片內容：上傳中顯示進度、完成顯示摘要、否則顯示選擇檔案。
 * @param {{ slot: Slot, value: Uploads[Slot], isUploading: boolean, progress: number, hasError: boolean, onBrowse: () => void }} state
 * @returns {Node[]}
 */
function uploadBody({ slot, value, isUploading, progress, hasError, onBrowse }) {
  if (isUploading) {
    const pct = Math.round(Math.min(100, Math.max(0, progress)));
    const bar = h("div", { class: "progress-bar" });
    bar.style.width = `${pct}%`;
    return [
      h("div", { class: "upload-progress-head" }, h("span", null, "上傳中"), h("span", { class: "mono" }, `${pct}%`)),
      h("div", { class: "progress" }, bar),
      h("p", { class: "muted upload-note" }, "讀取檔案中…"),
    ];
  }
  if (value) {
    const rows = describeUpload(slot, value).map(([label, text]) =>
      h("div", { class: "meta-row" }, h("dt", null, label), h("dd", { class: "mono" }, text))
    );
    return [h("dl", { class: "meta-list" }, rows)];
  }
  const prompt = hasError ? "請重試：拖曳檔案到這裡，或選擇檔案。" : "拖曳 .xlsx 檔案到這裡，或選擇檔案。";
  return [
    h(
      "div",
      { class: "upload-drop" },
      h("p", { class: "muted" }, prompt),
      h("button", { type: "button", class: "btn", onClick: onBrowse }, "選擇檔案")
    ),
  ];
}

/**
 * 拖放上傳。
 * @param {HTMLElement} target
 * @param {() => boolean} canAccept 已有檔案或上傳中時不接受
 * @param {(file: File) => void} onFile
 */
function enableFileDrop(target, canAccept, onFile) {
  target.addEventListener("dragover", (e) => {
    e.preventDefault();
    target.classList.toggle("is-drag-over", canAccept());
  });
  target.addEventListener("dragleave", (e) => {
    if (e.target === target) target.classList.remove("is-drag-over");
  });
  target.addEventListener("drop", (e) => {
    e.preventDefault();
    target.classList.remove("is-drag-over");
    const file = e.dataTransfer?.files?.[0];
    if (file && canAccept()) onFile(file);
  });
}

/**
 * @param {WorkflowStore} store
 * @param {(typeof SLOTS)[number]} spec
 */
function createUploadCard(store, { slot, title, hint, isRequired }) {
  let isUploading = false;
  let progress = 0;
  /** @type {string | null} */
  let error = null;

  const input = h("input", {
    type: "file",
    accept: ACCEPTED_EXTENSIONS.join(","),
    class: "visually-hidden",
    tabindex: "-1",
    "aria-hidden": "true",
    onChange: () => {
      const file = input.files?.[0];
      input.value = "";
      if (file) void handleFile(file);
    },
  });
  const clearButton = h("button", { type: "button", class: "btn-link", onClick: () => clear() }, "清除");
  const body = h("div", { class: "upload-body" });
  const errorText = h("p", { class: "upload-error text-shortage", role: "alert" });

  const card = h(
    "article",
    { class: "card upload-card", "aria-label": `${title}上傳` },
    h(
      "div",
      { class: "upload-card-head" },
      h("span", { class: isRequired ? "tag tag-required" : "tag" }, isRequired ? "必填" : "選填"),
      clearButton
    ),
    h("h3", { class: "card-title" }, title),
    h("p", { class: "card-desc" }, hint),
    body,
    errorText,
    input
  );

  /** @param {File} file */
  async function handleFile(file) {
    if (!isAcceptedFile(file.name)) {
      error = "僅支援 .xlsx 或 .xls 檔案";
      render();
      return;
    }
    error = null;
    isUploading = true;
    progress = 0;
    render();
    try {
      const result = await api.upload(slot, file, (percent) => {
        progress = percent;
        render();
      });
      setUpload(store, slot, result);
    } catch (e) {
      error = e instanceof ApiClientError || e instanceof Error ? e.message : "上傳失敗";
    } finally {
      isUploading = false;
      render();
    }
  }

  function clear() {
    setUpload(store, slot, null);
    error = null;
    progress = 0;
    render();
  }

  enableFileDrop(
    card,
    () => !isUploading && !store.get().uploads[slot],
    (file) => void handleFile(file)
  );

  function render() {
    const value = store.get().uploads[slot];
    card.classList.toggle("is-done", Boolean(value) && !isUploading);
    clearButton.hidden = !value || isUploading;
    errorText.textContent = error && !isUploading ? error : "";
    const state = { slot, value, isUploading, progress, hasError: Boolean(error), onBrowse: () => input.click() };
    replaceChildren(body, uploadBody(state));
  }

  watch(store, (s) => s.uploads[slot], render);
  return card;
}

/**
 * @param {HTMLElement} section
 * @param {WorkflowStore} store
 */
export function mountUploads(section, store) {
  const statusText = h("p", { class: "status-text" });
  const nextButton = h(
    "button",
    { type: "button", class: "btn btn-primary", onClick: () => setActiveTab(store, "configuration") },
    "前往設定 →"
  );

  section.replaceChildren(
    h(
      "div",
      { class: "section-head" },
      h("h2", { class: "section-title" }, "資料來源"),
      h("p", { class: "muted" }, "支援 .xlsx 與 .xls。上傳的檔案只暫存在伺服器 60 分鐘，用於本次計算。")
    ),
    h(
      "div",
      { class: "upload-grid" },
      SLOTS.map((spec) => createUploadCard(store, spec))
    ),
    h("div", { class: "status-strip card" }, statusText, nextButton)
  );

  watch(
    store,
    (s) => s.uploads,
    (uploads) => {
      const loaded = [uploads.sales, uploads.price, uploads.plan].filter(Boolean).length;
      const isReady = Boolean(uploads.sales);
      statusText.textContent = isReady ? `${loaded} / 3 個資料來源已連結，可以前往參數設定。` : "請先上傳銷貨明細。";
      nextButton.hidden = !isReady;
    }
  );
}
