"use client";

import Link from "next/link";
import { ModeToggle } from "@/components/ModeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    <header className="relative z-40 border-b bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-5 sm:px-8">
        <Link
          href="/"
          className="group flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="ClauseGuard home"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
              <path d="M7 3.5h7l3 3V20H7z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M14 3.5V7h3M9.5 11h5M9.5 14h5" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight">ClauseGuard</span>
          <Badge variant="outline" className="hidden lg:inline-flex">
            v1.0
          </Badge>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Primary navigation">
          {navigation.map((item) =>
            onSectionSelect ? (
              <Button
                key={item.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSectionSelect(item.id)}
              >
                <span className="text-muted-foreground">{item.index}</span>
                <span className="hidden lg:inline">{item.label}</span>
              </Button>
            ) : (
              <Button key={item.id} variant="outline" size="sm" nativeButton={false} render={<Link href={`/#${item.id}`} />}>
                <span className="text-muted-foreground">{item.index}</span>
                <span className="hidden lg:inline">{item.label}</span>
              </Button>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 text-xs text-muted-foreground xl:flex">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            System online
          </span>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
