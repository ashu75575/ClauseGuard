"use client";

import type { ReviewPriority } from "@/lib/apiClient";
import { SeverityBadge } from "./SeverityBadge";

export function PriorityFindings({
  priorities,
  onCite,
}: {
  priorities: ReviewPriority[];
  onCite: (chunkId: string) => void;
}) {
  if (!priorities.length) return null;

  return (
    <section className="border-2 border-white/[0.12] bg-[#151517] p-5 sm:p-7">
      <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">
        Report // 02
      </p>
      <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-white">Review first</h2>
      <div className="mt-5 space-y-3">
        {priorities.map((item, index) => (
          <article key={`${item.title}-${index}`} className="border border-white/[0.1] bg-[#19191c] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-violet-400">
                {String(index + 1).padStart(2, "0")}
              </span>
              <SeverityBadge severity={item.severity} />
              {item.category && (
                <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                  {item.category.replaceAll("_", " ")}
                </span>
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-zinc-100">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{item.rationale}</p>
            <p className="mt-2 text-sm leading-6 text-violet-200">
              <span className="font-mono text-[9px] uppercase tracking-wider text-violet-400">Action // </span>
              {item.action}
            </p>
            {item.source_chunk_ids?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.source_chunk_ids.map((chunkId) => (
                  <button
                    key={chunkId}
                    type="button"
                    onClick={() => onCite(chunkId)}
                    className="border border-white/[0.12] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:border-violet-400/50 hover:text-white"
                  >
                    Source ↗
                  </button>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
