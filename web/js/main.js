// @ts-check
/** 進入點：建立狀態並掛載各區段。 */

import { createWorkflowStore } from "./state/workflow.js";
import { mountTabs, tabFromHash } from "./components/tabs.js";
import { mountUploads } from "./components/uploads.js";
import { mountParameters } from "./components/parameters.js";
import { mountCalculateBar } from "./components/calculate-bar.js";
import { mountAnalysis } from "./components/analysis.js";

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`找不到 #${id}`);
  return el;
}

/** @returns {Storage | undefined} */
function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    // 隱私模式或被停用時，仍可正常使用，只是不保存設定
    return undefined;
  }
}

const store = createWorkflowStore(safeLocalStorage(), tabFromHash());

mountTabs(byId("tab-nav"), store);
mountUploads(byId("sources"), store);
const configuration = byId("configuration");
mountParameters(configuration, store);
mountCalculateBar(configuration, store);
mountAnalysis(byId("analysis"), store);
