"use client";

import Link from "next/link";

export type LandingSection = "how-it-works" | "capabilities" | "documents";

const navigation: Array<{ id: LandingSection; label: string; index: string }> = [
  { id: "how-it-works", label: "How it works", index: "01" },
  { id: "capabilities", label: "Capabilities", index: "02" },
  { id: "documents", label: "Documents", index: "03" },
];

export function Header({
  onSectionSelect,
}: {
  onSectionSelect?: (section: LandingSection) => void;
}) {
  return (
    <header className="relative z-40 border-b border-white/[0.08] bg-[#0d0d0f]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="group flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="ClauseGuard home"
        >
          <span className="grid h-8 w-8 place-items-center border border-violet-300/30 bg-gradient-to-br from-violet-500 to-indigo-600 shadow-[0_0_24px_rgba(124,58,237,.22)]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
              <path d="M7 3.5h7l3 3V20H7z" stroke="white" strokeWidth="1.8" />
              <path d="M14 3.5V7h3M9.5 11h5M9.5 14h5" stroke="white" strokeWidth="1.8" />
            </svg>
          </span>
          <span className="font-mono text-sm font-bold uppercase tracking-[-0.04em] text-white">ClauseGuard</span>
          <span className="hidden border border-white/10 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-widest text-zinc-500 lg:inline">
            v1.0
          </span>
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Primary navigation">
          {navigation.map((item) =>
            onSectionSelect ? (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionSelect(item.id)}
                className="border border-white/[0.12] bg-white/[0.04] px-2.5 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-300 hover:border-violet-400/40 hover:bg-violet-400/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:px-3"
              >
                <span className="text-violet-400">{item.index}</span>
                <span className="ml-2 hidden lg:inline">{item.label}</span>
              </button>
            ) : (
              <Link
                key={item.id}
                href={`/#${item.id}`}
                className="border border-white/[0.12] bg-white/[0.04] px-2.5 py-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-300 hover:border-violet-400/40 hover:bg-violet-400/10 hover:text-white sm:px-3"
              >
                <span className="text-violet-400">{item.index}</span>
                <span className="ml-2 hidden lg:inline">{item.label}</span>
              </Link>
            ),
          )}
        </nav>
        <span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-zinc-500 xl:flex">
          <span className="h-1.5 w-1.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.7)]" />
          <span className="hidden sm:inline">System online</span>
        </span>
      </div>
    </header>
  );
}
