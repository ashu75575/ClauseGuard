"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Clause } from "@/lib/apiClient";
import { ClauseCard } from "./ClauseCard";

export function EvidenceDrawer({
  open,
  clause,
  onClose,
  onViewInReport,
}: {
  open: boolean;
  clause: Clause | null;
  onClose: () => void;
  onViewInReport: (chunkId: string) => void;
}) {
  return (
    <AnimatePresence>
      {open && clause && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end">
          <motion.button
            type="button"
            aria-label="Close evidence drawer"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Source evidence"
            className="relative z-10 flex h-[78svh] w-full flex-col border-2 border-white/[0.12] bg-[#121214] shadow-[-12px_0_40px_rgba(0,0,0,.55)] sm:h-full sm:w-[min(92vw,820px)]"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-white/[0.1] px-4">
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-violet-400">
                  Evidence
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                  Page {clause.page}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center border border-white/[0.12] text-zinc-400 hover:text-white"
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ClauseCard clause={clause} highlighted />
              <button
                type="button"
                onClick={() => onViewInReport(clause.chunk_id)}
                className="mt-4 w-full border-2 border-violet-300/30 bg-violet-600 px-4 py-3 font-mono text-[10px] font-black uppercase tracking-wider text-white shadow-[4px_4px_0_#312e81]"
              >
                View in report
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
