"use client";

import { Download } from "lucide-react";

/** Saves the report as a PDF through the browser's print dialog (globals.css hides the app around it). */
export function PdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-sm font-semibold text-ink ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-ink-3"
    >
      <Download size={15} aria-hidden /> Download PDF
    </button>
  );
}
