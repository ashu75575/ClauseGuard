"use client";

import type { Severity } from "@/lib/apiClient";
import { SeverityBadge } from "./SeverityBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ExecutiveSummary({
  summary,
  overallRisk,
  flagCount,
  disclaimer,
  analyzedAt,
  model,
}: {
  summary: string;
  overallRisk: Severity;
  flagCount: number;
  disclaimer?: string;
  analyzedAt?: string | null;
  model?: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardDescription className="uppercase tracking-wider">Report · 01</CardDescription>
          <SeverityBadge severity={overallRisk} />
          <span className="text-xs text-muted-foreground">{flagCount} flags</span>
        </div>
        <CardTitle className="text-2xl">Executive readout</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base leading-7 text-foreground/90">
          {summary || "No summary available."}
        </p>
        <Alert>
          <AlertDescription>
            {disclaimer ||
              "AI-assisted legal review for information only. Not legal advice. Verify all findings against the source document."}
          </AlertDescription>
        </Alert>
        <p className="text-xs text-muted-foreground">
          Analyzed {analyzedAt ? new Date(analyzedAt).toLocaleString() : "n/a"}
          {model ? ` · ${model}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}
