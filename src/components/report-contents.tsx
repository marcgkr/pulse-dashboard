"use client";

import { useEffect, useState } from "react";

type Item = { id: string; label: string };

/**
 * "On this page" for long reports: reads the report's titled sections after it renders and links to
 * them from a bar that stays at the top while you scroll. Hidden when there are fewer than three.
 */
export function ReportContents({ rootId }: { rootId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    const sections = [...root.querySelectorAll<HTMLElement>("[data-report-section]")].filter((el) => el.id);
    setItems(sections.map((el) => ({ id: el.id, label: el.dataset.reportSection ?? "" })));
    const seen = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setCurrent(top.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    sections.forEach((s) => seen.observe(s));
    return () => seen.disconnect();
  }, [rootId]);

  if (items.length < 3) return null;
  return (
    <nav aria-label="On this page" className="sticky top-[52px] z-20 -mx-4 mb-8 border-b border-line bg-paper/90 px-4 py-2.5 backdrop-blur print:hidden lg:top-0">
      <ul className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {items.map((it) => (
          <li key={it.id} className="shrink-0">
            <a
              href={`#${it.id}`}
              aria-current={current === it.id ? "true" : undefined}
              className={
                current === it.id
                  ? "inline-flex rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white"
                  : "inline-flex rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-ink-2 ring-1 ring-line hover:text-ink hover:ring-ink-3"
              }
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
