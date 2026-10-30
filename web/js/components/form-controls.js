// @ts-check
/**
 * 參數表單共用控制項。每個控制項回傳 { el, update }：
 * el 掛到頁面，update(value) 在狀態改變時同步畫面（不重建 DOM，避免輸入時失去焦點）。
 */

import { h, uid } from "../utils/dom.js";

/**
 * @template {string} V
 * @typedef {{ value: V, label: string, deck?: string }} RadioOption
 */

/**
 * 單選卡片列。結構 <label><input type=radio>…</label> 供 E2E 以 input[name][value] 定位。
 * @template {string} V
 * @param {string} name
 * @param {RadioOption<V>[]} options
 * @param {(value: V) => void} onChange
 */
export function radioGroup(name, options, onChange) {
  const inputs = options.map((opt) =>
    h("input", { type: "radio", name, value: opt.value, class: "radio-input", onChange: () => onChange(opt.value) })
  );
  const el = h(
    "div",
    { class: "radio-group", role: "radiogroup" },
    options.map((opt, i) =>
      h(
        "label",
        { class: "radio-card" },
        inputs[i],
        h(
          "span",
          { class: "radio-text" },
          h("span", { class: "radio-label" }, opt.label),
          opt.deck ? h("span", { class: "radio-deck" }, opt.deck) : null
        )
      )
    )
  );
  return {
    el,
    /** @param {string} value 目前狀態值（可能包含此群組沒有的選項，例如舊版暫存的 single） */
    update(value) {
      for (const input of inputs) input.checked = input.value === value;
    },
  };
}

/**
 * 數字欄位：輸入超出範圍時夾回邊界；清空時暫不更新，失焦後還原為目前值。
 * @param {{ label: string, suffix?: string, min: number, max: number, onChange: (value: number) => void }} spec
 */
export function numberField({ label, suffix, min, max, onChange }) {
  const id = uid("num");
  let current = min;
  const labelEl = h("label", { for: id, class: "field-label" }, label);
  const suffixEl = h("span", { class: "suffix" }, suffix ?? "");
  const input = h("input", {
    id,
    type: "number",
    class: "input mono",
    min: String(min),
    max: String(max),
    step: "1",
    onInput: () => {
      if (input.value.trim() === "") return;
      const n = Number(input.value);
      if (!Number.isFinite(n)) return;
      const clamped = Math.min(max, Math.max(min, Math.round(n)));
      if (clamped !== n) input.value = String(clamped);
      onChange(clamped);
    },
    onBlur: () => {
      if (input.value.trim() === "") input.value = String(current);
    },
  });
  const el = h("div", { class: "field" }, labelEl, h("div", { class: "input-with-suffix" }, input, suffixEl));
  return {
    el,
    /**
     * @param {number} value
     * @param {{ label?: string, suffix?: string }} [text] 標籤文字會隨粒度改變（月份 / 期數）
     */
    update(value, text) {
      current = value;
      if (Number(input.value) !== value || input.value === "") input.value = String(value);
      if (text?.label) labelEl.textContent = text.label;
      if (text?.suffix !== undefined) suffixEl.textContent = text.suffix;
    },
  };
}

/**
 * 開關列：label 與 switch 按鈕放在同一層，供 E2E 以標籤文字找到開關。
 * @param {{ label: string, deck: string, onChange: (checked: boolean) => void }} spec
 */
export function switchRow({ label, deck, onChange }) {
  const id = uid("switch");
  let isChecked = false;
  const button = h("button", {
    id,
    type: "button",
    role: "switch",
    class: "switch",
    onClick: () => onChange(!isChecked),
  });
  const el = h(
    "div",
    { class: "switch-row" },
    h(
      "label",
      { for: id, class: "switch-text" },
      h("span", { class: "switch-label" }, label),
      h("span", { class: "radio-deck" }, deck)
    ),
    button
  );
  return {
    el,
    /** @param {boolean} checked */
    update(checked) {
      isChecked = checked;
      button.setAttribute("aria-checked", String(checked));
    },
  };
}

/**
 * @param {{ label: string, options: Array<{ value: string, label: string }>, onChange: (value: string) => void }} spec
 */
export function selectField({ label, options, onChange }) {
  const id = uid("select");
  const select = h(
    "select",
    { id, class: "select", onChange: () => onChange(select.value) },
    options.map((o) => h("option", { value: o.value }, o.label))
  );
  return {
    el: h("div", { class: "field" }, h("label", { for: id, class: "field-label" }, label), select),
    select,
    /** @param {string} value */
    update(value) {
      select.value = value;
    },
  };
}

/**
 * 收合區塊的切換按鈕。
 * @param {string} title
 * @param {HTMLElement} content
 */
export function disclosure(title, content) {
  let isOpen = false;
  const button = h(
    "button",
    {
      type: "button",
      class: "disclosure",
      "aria-expanded": "false",
      onClick: () => {
        isOpen = !isOpen;
        button.setAttribute("aria-expanded", String(isOpen));
        content.hidden = !isOpen;
      },
    },
    h("span", { class: "disclosure-icon", "aria-hidden": "true" }),
    `進階 · ${title}`
  );
  content.hidden = true;
  return h("div", { class: "disclosure-block" }, button, content);
}

/**
 * 設定卡片：標題、說明與內容。
 * @param {string} title
 * @param {string} deck
 * @param {...(Node | null)} children
 */
export function settingsCard(title, deck, ...children) {
  return h(
    "div",
    { class: "card settings-card" },
    h("h3", { class: "card-title" }, title),
    h("p", { class: "card-desc" }, deck),
    h("div", { class: "settings-body" }, children)
  );
}
