"use client";

import type { Clause } from "@/lib/apiClient";
import { ClauseCard } from "./ClauseCard";
import { SeverityBadge } from "./SeverityBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
    <Sheet open={open && !!clause} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl lg:max-w-3xl"
      >
        {clause && (
          <>
            <SheetHeader className="border-b pr-12">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle>Source evidence</SheetTitle>
                <SeverityBadge severity={clause.severity} />
                {clause.category && (
                  <Badge variant="secondary" className="uppercase">
                    {clause.category.replaceAll("_", " ")}
                  </Badge>
                )}
              </div>
              <SheetDescription>
                Page {clause.page}
                {clause.heading ? ` · ${clause.heading}` : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <ClauseCard clause={clause} highlighted />
            </div>
            <SheetFooter className="border-t sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button type="button" onClick={() => onViewInReport(clause.chunk_id)}>
                View in report
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
