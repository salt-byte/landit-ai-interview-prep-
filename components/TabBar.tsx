import React, { useEffect, useRef } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabBarProps<T extends string> {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

export function TabBar<T extends string>({ tabs, active, onChange, className = '' }: TabBarProps<T>) {
  return (
    <div className={`border-b border-[#E3E3E3] bg-white ${className}`}>
      <div className="flex items-center gap-8 px-8">
        {tabs.map(tab => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative py-3 text-sm font-bold transition-colors outline-none ${
                isActive
                  ? 'text-[#1F1F1F]'
                  : 'text-[#80868B] hover:text-[#1F1F1F]'
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute left-0 right-0 -bottom-px h-[2.5px] bg-[#1F1F1F] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Scroll-spy controller for stacked tab sections in a scrollable container.
 * Returns refs to attach to the scroll container and each section, plus a
 * scrollToTab handler to wire into TabBar's onChange.
 */
export function useScrollSpyTabs<T extends string>(
  tabIds: readonly T[],
  setActive: (id: T) => void,
) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<T, HTMLDivElement | null>>>({});
  const isProgrammaticScroll = useRef(false);
  const programmaticTimer = useRef<number | null>(null);

  const idsKey = tabIds.join('|');

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScroll.current) return;
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const target = visible[0]?.target as HTMLElement | undefined;
        const id = target?.dataset.tabId as T | undefined;
        if (id) setActive(id);
      },
      { root, rootMargin: '0px 0px -65% 0px', threshold: 0 }
    );
    tabIds.forEach(id => {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [idsKey, setActive]);

  const setSectionRef = (id: T) => (el: HTMLDivElement | null) => {
    sectionRefs.current[id] = el;
  };

  const scrollToTab = (id: T) => {
    setActive(id);
    const target = sectionRefs.current[id];
    const root = scrollContainerRef.current;
    if (!target || !root) return;
    if (programmaticTimer.current) window.clearTimeout(programmaticTimer.current);
    isProgrammaticScroll.current = true;
    const top = root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top;
    root.scrollTo({ top, behavior: 'smooth' });
    programmaticTimer.current = window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 800);
  };

  return { scrollContainerRef, setSectionRef, scrollToTab };
}
