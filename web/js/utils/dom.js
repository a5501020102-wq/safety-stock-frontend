// @ts-check
/**
 * DOM 建構工具。
 *
 * 安全規則：所有來自資料的文字都以 text node 寫入，本專案不使用 innerHTML，
 * 避免 Excel 內的料號或品名夾帶 HTML 造成 XSS。
 */

/** @typedef {Node | string | number | null | undefined | false} Child */
/** @typedef {Record<string, unknown>} Attrs */

/**
 * 建立元素。
 * - `class`、`id`、`type` 等一般屬性用 setAttribute
 * - `on<Event>` 綁定事件
 * - `value`、`checked`、`disabled` 等以 property 設定（表單狀態）
 * - 值為 null / undefined / false 的屬性略過
 *
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Attrs | null} [attrs]
 * @param {...(Child | Child[])} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), /** @type {EventListener} */ (value));
    } else if (PROPERTY_KEYS.has(key)) {
      /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (el))[key] = value;
    } else {
      el.setAttribute(key, value === true ? "" : String(value));
    }
  }
  append(el, children);
  return el;
}

const PROPERTY_KEYS = new Set(["value", "checked", "disabled", "selected", "hidden", "colSpan"]);

/**
 * @param {Element} parent
 * @param {(Child | Child[])[]} children
 */
function append(parent, children) {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/**
 * 以新內容取代元素的所有子節點。
 * @param {Element} el
 * @param {...(Child | Child[])} children
 */
export function replaceChildren(el, ...children) {
  el.replaceChildren();
  append(el, children);
}

/**
 * 切換 class（與 classList.toggle 相同，但回傳元素方便串接）。
 * @template {Element} E
 * @param {E} el
 * @param {Record<string, boolean>} classes
 * @returns {E}
 */
export function setClasses(el, classes) {
  for (const [name, isOn] of Object.entries(classes)) el.classList.toggle(name, isOn);
  return el;
}

let idCounter = 0;
/** 產生頁面內唯一的 id，供 label[for] 對應 input。 @param {string} prefix */
export function uid(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}
