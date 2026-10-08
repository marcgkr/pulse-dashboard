"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded border border-line bg-white px-2 py-1 text-xs font-semibold text-ink-2 hover:border-scrub hover:text-scrub"
      aria-label={label ?? "Copy"}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : label ?? "Copy"}
    </button>
  );
}
