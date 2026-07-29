"use client";

import { useState } from "react";
import type { Clause } from "@/lib/apiClient";
import { SeverityBadge } from "./SeverityBadge";

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export function ClauseCard({
  clause,
  highlighted,
}: {
  clause: Clause;
  highlighted?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const heading = clause.heading?.trim();
  const title = heading && heading.toLowerCase() !== "unknown" ? heading : "Flagged clause";
  const accent = {
    high: "border-l-rose-400",
    medium: "border-l-amber-300",
    low: "border-l-emerald-300",
  }[clause.severity];

  return (
    <article
      id={`clause-${clause.chunk_id}`}
      data-chunk-id={clause.chunk_id}
      className={`scroll-mt-20 border border-l-4 bg-[#161618] transition-all duration-300 ${accent} ${
        highlighted
          ? "translate-x-[-3px] border-violet-400 shadow-[6px_6px_0_#312e81]"
          : "border-y-white/[0.1] border-r-white/[0.1] hover:bg-[#1a1a1d]"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400"
        aria-expanded={expanded}
        aria-controls={`clause-body-${clause.chunk_id}`}
      >
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center border border-white/[0.1] bg-white/[0.04] text-zinc-500">
          <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" aria-hidden="true">
            <path d="m8 5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={clause.severity} />
            {clause.category && (
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                {formatLabel(clause.category)}
              </span>
            )}
            <span className="ml-auto font-mono text-[9px] uppercase text-zinc-600">P.{clause.page}</span>
          </span>
          <span className="mt-3 block text-sm font-semibold text-zinc-100">{title}</span>
          <span className="mt-2 block text-sm leading-6 text-zinc-400">
            {clause.explanation || "No additional explanation was provided."}
          </span>
        </span>
      </button>
      {expanded && (
        <div id={`clause-body-${clause.chunk_id}`} className="border-t border-white/[0.08] bg-black/15 px-5 py-4 sm:ml-10">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600">Original clause // source</p>
          <blockquote className="mt-2 border-l-2 border-white/10 pl-4 text-sm leading-7 text-zinc-300">
            {clause.text}
          </blockquote>
          {typeof clause.confidence === "number" && (
            <p className="mt-3 text-xs text-zinc-600">
              Confidence {Math.round(clause.confidence <= 1 ? clause.confidence * 100 : clause.confidence)}%
            </p>
          )}
        </div>
      )}
    </article>
  );
}
