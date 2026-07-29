"use client";

import type { Obligation, ObligationStatus } from "@/lib/apiClient";

const statuses: ObligationStatus[] = ["unconfirmed", "confirmed", "completed", "dismissed"];

export function ObligationsTimeline({
  obligations,
  onStatusChange,
  onCite,
  updatingId,
}: {
  obligations: Obligation[];
  onStatusChange: (id: number, status: ObligationStatus) => void;
  onCite: (chunkId: string) => void;
  updatingId?: number | null;
}) {
  if (!obligations.length) return null;

  return (
    <section className="border-2 border-white/[0.12] bg-[#151517] p-5 sm:p-7">
      <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">
        Report // 03
      </p>
      <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-white">Obligations timeline</h2>
      <p className="mt-2 text-xs leading-5 text-zinc-500">
        Relative periods are not calendar facts until you confirm them.
      </p>
      <div className="mt-5 space-y-3">
        {obligations.map((item, index) => (
          <article key={item.id ?? `${item.action}-${index}`} className="border-l-4 border-violet-500 bg-[#19191c] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                {item.party || "unknown party"}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">
                {item.recurrence || "unknown"}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-zinc-100">{item.action}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Trigger: {item.trigger || "n/a"} · Deadline: {item.deadline || item.period || "unconfirmed"}
            </p>
            {item.consequence && (
              <p className="mt-1 text-xs leading-5 text-zinc-500">Consequence: {item.consequence}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {typeof item.id === "number" && (
                <label className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                  Status
                  <select
                    value={item.status}
                    disabled={updatingId === item.id}
                    onChange={(event) =>
                      onStatusChange(item.id!, event.target.value as ObligationStatus)
                    }
                    className="border border-white/[0.12] bg-[#121214] px-2 py-1 text-zinc-300 outline-none focus:border-violet-400"
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(item.source_chunk_ids || []).map((chunkId) => (
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
          </article>
        ))}
      </div>
    </section>
  );
}
