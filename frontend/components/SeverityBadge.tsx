import type { Severity } from "@/lib/apiClient";

const styles: Record<Severity, string> = {
  high: "border-rose-400/20 bg-rose-400/10 text-rose-300",
  medium: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  low: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
};

export function SeverityBadge({
  severity,
  count,
}: {
  severity: Severity;
  count?: number;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] ${styles[severity]}`}
    >
      <span className="h-1.5 w-1.5 bg-current" aria-hidden="true" />
      {severity}
      {typeof count === "number" && <span className="opacity-70">{count}</span>}
    </span>
  );
}
