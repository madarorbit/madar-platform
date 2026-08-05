"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icons";
import type { WorkspaceNavigationGroup } from "@/src/lib/v2/navigation";

export default function WorkspaceCommandPalette({
  groups,
  open,
  onOpenChange,
}: {
  groups: WorkspaceNavigationGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const items = useMemo(
    () => groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label }))),
    [groups],
  );
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar");
    if (!normalized) return items;
    return items.filter((item) =>
      [item.label, item.description, item.group, ...(item.keywords || [])]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ar")
        .includes(normalized),
    );
  }, [items, query]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const writing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) setQuery("");
        onOpenChange(!open);
      } else if (event.key === "/" && !writing) {
        event.preventDefault();
        onOpenChange(true);
      } else if (event.key === "Escape" && open) {
        setQuery("");
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;
  const close = () => {
    setQuery("");
    onOpenChange(false);
  };
  const go = (href: string) => {
    close();
    router.push(href);
  };
  return (
    <div className="md-command-layer" role="presentation" onMouseDown={close}>
      <section className="md-command-dialog" role="dialog" aria-modal="true" aria-label="البحث الشامل" onMouseDown={(event) => event.stopPropagation()}>
        <div className="md-command-input-wrap">
          <Icon name="search" className="h-5 w-5" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن صفحة أو وظيفة…" aria-label="البحث في مساحة العمل" />
          <kbd>Esc</kbd>
        </div>
        <div className="md-command-results">
          {results.length ? results.map((item) => (
            <button key={item.href} type="button" className="md-command-result" onClick={() => go(item.href)}>
              <span className="md-command-result-icon"><Icon name={item.icon} className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1 text-right">
                <strong>{item.label}</strong>
                <small>{item.description || item.group}</small>
              </span>
              <span className="md-command-group">{item.group}</span>
            </button>
          )) : <div className="md-command-empty">لا توجد نتيجة مطابقة. جرّب اسم الوحدة أو المهمة التي تريد تنفيذها.</div>}
        </div>
        <footer className="md-command-footer"><span>Enter للفتح</span><span>⌘K أو Ctrl+K للبحث</span></footer>
      </section>
    </div>
  );
}
