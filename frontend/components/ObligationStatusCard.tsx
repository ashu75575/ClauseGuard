"use client";

import type { DashboardStats } from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

const statusLabels: Array<{ key: keyof DashboardStats["obligation_status"]; label: string }> = [
  { key: "unconfirmed", label: "Unconfirmed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "dismissed", label: "Dismissed" },
];

export function ObligationStatusCard({ stats }: { stats: DashboardStats }) {
  const total = Math.max(stats.obligation_count, 1);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>Tracking</CardDescription>
        <CardTitle>Obligation status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats.obligation_count === 0 ? (
          <Empty className="border border-dashed py-6">
            <EmptyHeader>
              <EmptyTitle>No obligations</EmptyTitle>
              <EmptyDescription>Tracked duties will show status here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          statusLabels.map(({ key, label }) => {
            const count = stats.obligation_status[key] || 0;
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </div>
                <Progress value={(count / total) * 100} />
              </div>
            );
          })
        )}

        {stats.parties.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Parties
            </p>
            <div className="flex flex-wrap gap-2">
              {stats.parties.slice(0, 6).map((item) => (
                <Badge key={item.party} variant="secondary">
                  {item.party} · {item.count}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
