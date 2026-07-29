"use client";

import type { NegotiationItem } from "@/lib/apiClient";
import { SeverityBadge } from "./SeverityBadge";

export function NegotiationPlaybook({
  items,
  onCite,
}: {
  items: NegotiationItem[];
  onCite: (chunkId: string) => void;
}) {
  if (!items.length) return null;

  return (
    <section className="border-2 border-white/[0.12] bg-[#151517] p-5 sm:p-7">
      <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">
        Report // 04
      </p>
      <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-white">Negotiation playbook</h2>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <article key={item.category} className="border border-white/[0.1] bg-[#19191c] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={item.severity} />
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                {item.category.replaceAll("_", " ")}
              </span>
            </div>
            <dl className="mt-4 space-y-3 text-sm leading-6">
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-wider text-violet-400">Primary ask</dt>
                <dd className="mt-1 text-zinc-200">{item.primary_ask}</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">Fallback</dt>
                <dd className="mt-1 text-zinc-400">{item.fallback}</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">Rationale</dt>
                <dd className="mt-1 text-zinc-400">{item.rationale}</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">Suggested language</dt>
                <dd className="mt-1 border-l-2 border-white/10 pl-3 text-zinc-300">{item.suggested_language}</dd>
              </div>
            </dl>
            {(item.source_chunk_ids || []).length > 0 && (
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
