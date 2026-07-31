import type { Severity } from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<Severity, string> = {
  high: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

export function SeverityBadge({
  severity,
  count,
}: {
  severity: Severity;
  count?: number;
}) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 uppercase tracking-wide", styles[severity])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {severity}
      {typeof count === "number" && <span className="opacity-70">{count}</span>}
    </Badge>
  );
}
