"use client";

import type { ComponentType } from "react";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  ClipboardListIcon,
  FlagIcon,
  ScaleIcon,
} from "lucide-react";
import type { DashboardStats, Severity } from "@/lib/apiClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn("text-left", onClick && "rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
    >
      <Card size="sm" className={cn(active && "ring-2 ring-ring")}>
        <CardHeader className="flex-row items-start justify-between gap-2">
          <div>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="mt-1 text-2xl tabular-nums">{value}</CardTitle>
          </div>
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <Icon className="size-4" />
          </div>
        </CardHeader>
        {hint && (
          <CardContent>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </CardContent>
        )}
      </Card>
    </Comp>
  );
}

export function DashboardKpis({
  stats,
  overallRisk,
  severityFilter,
  onSeverityFilter,
}: {
  stats: DashboardStats;
  overallRisk: Severity;
  severityFilter: Severity | "all";
  onSeverityFilter: (severity: Severity | "all") => void;
}) {
  const openObligations =
    (stats.obligation_status.unconfirmed || 0) + (stats.obligation_status.confirmed || 0);

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Dashboard metrics">
      <KpiCard
        label="Overall risk"
        value={overallRisk}
        hint={`${stats.severity_summary.high} high · ${stats.severity_summary.medium} medium · ${stats.severity_summary.low} low`}
        icon={ScaleIcon}
      />
      <KpiCard
        label="Flagged clauses"
        value={stats.flag_count}
        hint={`${stats.category_breakdown.length} categories`}
        icon={FlagIcon}
        active={severityFilter === "all"}
        onClick={() => onSeverityFilter("all")}
      />
      <KpiCard
        label="High severity"
        value={stats.severity_summary.high}
        hint="Click to filter clauses"
        icon={AlertTriangleIcon}
        active={severityFilter === "high"}
        onClick={() => onSeverityFilter(severityFilter === "high" ? "all" : "high")}
      />
      <KpiCard
        label="Open obligations"
        value={openObligations}
        hint={`${stats.obligation_count} total tracked`}
        icon={ClipboardListIcon}
      />
      <KpiCard
        label="Coverage"
        value={stats.chunk_count}
        hint={`${stats.section_count} sections · ${stats.avg_confidence != null ? `${stats.avg_confidence}% avg confidence` : "n/a confidence"}`}
        icon={BookOpenIcon}
      />
    </section>
  );
}
