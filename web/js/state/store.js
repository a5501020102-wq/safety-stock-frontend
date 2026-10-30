// @ts-check
/**
 * 極簡狀態容器：讀取、部分更新、訂閱。元件之間不直接互相呼叫，只透過 store 溝通。
 */

/**
 * @template {object} S
 * @typedef {object} Store
 * @property {() => S} get
 * @property {(patch: Partial<S> | ((state: S) => Partial<S>)) => void} set
 * @property {(listener: (state: S, prev: S) => void) => () => void} subscribe
 */

/**
 * @template {object} S
 * @param {S} initial
 * @returns {Store<S>}
 */
export function createStore(initial) {
  let state = initial;
  /** @type {Set<(state: S, prev: S) => void>} */
  const listeners = new Set();

  return {
    get: () => state,
    set(patch) {
      const prev = state;
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      for (const listener of listeners) listener(state, prev);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * 只在選取的值改變時（以 === 比較）才呼叫 listener。
 * @template {object} S
 * @template T
 * @param {Store<S>} store
 * @param {(state: S) => T} selector
 * @param {(value: T, state: S) => void} listener
 * @param {{ immediate?: boolean }} [options] immediate 為 true 時先以目前狀態呼叫一次
 */
export function watch(store, selector, listener, { immediate = true } = {}) {
  let current = selector(store.get());
  if (immediate) listener(current, store.get());
  return store.subscribe((state) => {
    const next = selector(state);
    if (next === current) return;
    current = next;
    listener(next, state);
  });
}
