"use client";

import type { Severity } from "@/lib/apiClient";
import { SeverityBadge } from "./SeverityBadge";

export function ExecutiveSummary({
  summary,
  overallRisk,
  flagCount,
  disclaimer,
  analyzedAt,
  model,
}: {
  summary: string;
  overallRisk: Severity;
  flagCount: number;
  disclaimer?: string;
  analyzedAt?: string | null;
  model?: string | null;
}) {
  return (
    <section className="border-2 border-white/[0.12] bg-[#151517] p-5 shadow-[6px_6px_0_#27272a] sm:p-7">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">
          Report // 01
        </p>
        <SeverityBadge severity={overallRisk} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
          {flagCount} flags
        </span>
      </div>
      <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">
        Executive readout
      </h2>
      <p className="mt-4 text-base leading-7 text-zinc-300">{summary || "No summary available."}</p>
      <p className="mt-5 border-l-4 border-amber-300/60 bg-amber-300/[0.06] px-4 py-3 text-xs leading-5 text-amber-100">
        {disclaimer ||
          "AI-assisted legal review for information only. Not legal advice. Verify all findings against the source document."}
      </p>
      <p className="mt-3 font-mono text-[9px] uppercase tracking-wider text-zinc-600">
        Analyzed {analyzedAt ? new Date(analyzedAt).toLocaleString() : "n/a"}
        {model ? ` // ${model}` : ""}
      </p>
    </section>
  );
}
