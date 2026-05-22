"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/i18n";

/**
 * TabbedLayout
 * ---------------------------------------------------------------------------
 * 三分頁版面容器：上傳 / 設定 / 分析。
 *
 * Desktop (>= 768px)：橫列 tab nav (sticky)，WAI-ARIA tablist + roving tabindex
 *                      + 方向鍵 + Home/End 切換。
 * Mobile  (<  768px)：「當前 tab + ▾」漢堡選單，點開展開 accordion 列表，
 *                      點選後自動收合。
 *
 * State：以 URL hash 同步當前 tab（replaceState 避免污染歷史）。
 * 切換動畫：tab-panel display 切換 + fade-in keyframe（globals.css）。
 *
 * Section ID 與 tab id 對齊（sources / configuration / analysis），
 * 既有 E2E 與 deep link（如 /#analysis）皆相容。
 */

export type TabId = "sources" | "configuration" | "analysis";

const TAB_IDS: readonly TabId[] = ["sources", "configuration", "analysis"] as const;
const TAB_LABELS: Record<TabId, string> = {
  sources: ui.nav.upload,
  configuration: ui.nav.parameters,
  analysis: ui.nav.results,
};

function isValidTabId(value: string): value is TabId {
  return (TAB_IDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// TabContext — 暴露 setActiveTab 供 CalculateBar / UploadsSection 等子元件
// 主動切 tab（例如：計算完跳到分析、上傳完跳到設定）。
// ---------------------------------------------------------------------------

interface TabContextValue {
  activeTab: TabId;
  setActiveTab: (id: TabId) => void;
}

const TabContext = createContext<TabContextValue | null>(null);

export function useTabContext(): TabContextValue {
  const ctx = useContext(TabContext);
  if (!ctx) {
    throw new Error("useTabContext must be used inside <TabbedLayout>");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// TabbedLayout
// ---------------------------------------------------------------------------

interface TabbedLayoutProps {
  sources: React.ReactNode;
  configuration: React.ReactNode;
  analysis: React.ReactNode;
}

export function TabbedLayout({ sources, configuration, analysis }: TabbedLayoutProps) {
  // SSR 初值用 "sources"：第一次 paint 與 server render 一致避免 hydration mismatch。
  // useEffect 內讀 hash 同步，若 hash 是 #analysis 等則切換（搭配 fade-in 動畫遮蓋過渡）。
  const [activeTab, setActiveTabState] = useState<TabId>("sources");
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hash sync：mount 時讀一次，並監聽 hashchange（瀏覽器返回 / 外部腳本改 hash）。
  useEffect(() => {
    const sync = () => {
      const raw = window.location.hash.replace(/^#/, "");
      if (isValidTabId(raw)) {
        setActiveTabState(raw);
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const setActiveTab = useCallback((id: TabId) => {
    setActiveTabState(id);
    setMobileMenuOpen(false);
    if (typeof window !== "undefined") {
      // replaceState 不污染歷史（連按多個 tab 不會堆積返回紀錄）。
      window.history.replaceState(null, "", `#${id}`);
    }
  }, []);

  const panels: Record<TabId, React.ReactNode> = { sources, configuration, analysis };

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      <TabNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {TAB_IDS.map((id) => {
        const isActive = activeTab === id;
        return (
          <section
            key={id}
            id={id}
            role="tabpanel"
            aria-labelledby={`tab-${id}`}
            tabIndex={-1}
            className={cn("tab-panel px-6 py-10 md:px-12 md:py-14", isActive ? "tab-panel-active" : "tab-panel-hidden")}
          >
            {panels[id]}
          </section>
        );
      })}
    </TabContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// TabNav — sticky 列，desktop 橫列 + mobile accordion
// ---------------------------------------------------------------------------

interface TabNavProps {
  activeTab: TabId;
  setActiveTab: (id: TabId) => void;
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
}

function TabNav({ activeTab, setActiveTab, isMobileMenuOpen, setMobileMenuOpen }: TabNavProps) {
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    sources: null,
    configuration: null,
    analysis: null,
  });

  // WAI-ARIA tablist pattern：方向鍵在 tab 之間移動 + Home/End 跳首尾。
  // Automatic activation：方向鍵直接切換並移動焦點（tab 內容輕量，瞬間切換無代價）。
  const handleKeyDown = (e: React.KeyboardEvent, id: TabId) => {
    const currentIdx = TAB_IDS.indexOf(id);
    let nextIdx: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIdx = (currentIdx - 1 + TAB_IDS.length) % TAB_IDS.length;
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIdx = (currentIdx + 1) % TAB_IDS.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = TAB_IDS.length - 1;
    }
    if (nextIdx !== null) {
      e.preventDefault();
      const nextId = TAB_IDS[nextIdx];
      setActiveTab(nextId);
      tabRefs.current[nextId]?.focus();
    }
  };

  return (
    <nav className="tab-nav sticky top-0 z-20 border-y border-foreground/15 bg-background/95 backdrop-blur">
      {/* ----- Desktop：橫列 tab buttons ----- */}
      <div
        role="tablist"
        aria-label="主要區段"
        aria-orientation="horizontal"
        className="hidden md:flex items-stretch gap-2 px-6 md:px-12"
      >
        {TAB_IDS.map((id, idx) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={isActive}
              aria-controls={id}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(id)}
              onKeyDown={(e) => handleKeyDown(e, id)}
              className={cn(
                "group/tab relative py-5 pr-10 pl-1 text-left transition-colors duration-500 ease-luxury",
                "focus:outline-none focus-visible:outline-1 focus-visible:outline-accent focus-visible:outline-offset-2",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="mr-3 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/60">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className="font-serif text-xl leading-none">{TAB_LABELS[id]}</span>
              {isActive ? <span aria-hidden="true" className="absolute bottom-0 left-0 h-px w-full bg-accent" /> : null}
            </button>
          );
        })}
      </div>

      {/* ----- Mobile：「當前 tab + ▾」+ accordion 列表 ----- */}
      <div className="md:hidden px-6">
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={isMobileMenuOpen}
          aria-controls="tab-mobile-menu"
          onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
          className={cn(
            "flex w-full items-center justify-between py-4 transition-colors duration-500 ease-luxury",
            "focus:outline-none focus-visible:outline-1 focus-visible:outline-accent focus-visible:outline-offset-2"
          )}
        >
          <span className="flex items-baseline">
            <span className="mr-3 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/60">
              {String(TAB_IDS.indexOf(activeTab) + 1).padStart(2, "0")}
            </span>
            <span className="font-serif text-lg text-foreground">{TAB_LABELS[activeTab]}</span>
          </span>
          <span aria-hidden="true" className="font-mono text-xs text-muted-foreground">
            {isMobileMenuOpen ? "▴" : "▾"}
          </span>
        </button>

        <div
          id="tab-mobile-menu"
          className={cn("accordion-panel overflow-hidden", isMobileMenuOpen && "accordion-panel-open")}
        >
          <div role="tablist" aria-label="切換分頁（行動版）" className="border-t border-foreground/10">
            {TAB_IDS.map((id, idx) => {
              if (id === activeTab) return null;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={false}
                  aria-controls={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex w-full items-baseline py-3 text-left text-muted-foreground transition-colors duration-500 ease-luxury",
                    "hover:text-foreground focus:outline-none focus-visible:text-foreground"
                  )}
                >
                  <span className="mr-3 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/60">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="font-serif text-base">{TAB_LABELS[id]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
