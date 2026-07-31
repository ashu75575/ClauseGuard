"use client";

import type { Clause } from "@/lib/apiClient";
import { SeverityBadge } from "./SeverityBadge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  const heading = clause.heading?.trim();
  const title = heading && heading.toLowerCase() !== "unknown" ? heading : "Flagged clause";
  const accent = {
    high: "border-l-rose-500",
    medium: "border-l-amber-500",
    low: "border-l-emerald-500",
  }[clause.severity];

  return (
    <div
      id={`clause-${clause.chunk_id}`}
      data-chunk-id={clause.chunk_id}
      className={cn(
        "scroll-mt-20 rounded-xl border border-l-4 bg-card text-card-foreground transition-all",
        accent,
        highlighted && "ring-2 ring-ring",
      )}
    >
      <Accordion>
        <AccordionItem value={clause.chunk_id} className="border-none px-4">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="min-w-0 flex-1 space-y-2 pr-3 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={clause.severity} />
                {clause.category && (
                  <Badge variant="secondary" className="uppercase">
                    {formatLabel(clause.category)}
                  </Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">P.{clause.page}</span>
              </div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {clause.explanation || "No additional explanation was provided."}
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 border-t pt-3 pb-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Original clause · source
              </p>
              <blockquote className="border-l-2 pl-4 text-sm leading-7 text-foreground/80">
                {clause.text}
              </blockquote>
              {typeof clause.confidence === "number" && (
                <p className="text-xs text-muted-foreground">
                  Confidence{" "}
                  {Math.round(clause.confidence <= 1 ? clause.confidence * 100 : clause.confidence)}%
                </p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
