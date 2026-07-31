"use client";

import type { Obligation, ObligationStatus } from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statuses: ObligationStatus[] = ["unconfirmed", "confirmed", "completed", "dismissed"];

export function ObligationsTimeline({
  obligations,
  onStatusChange,
  onCite,
  updatingId,
}: {
  obligations: Obligation[];
  onStatusChange: (id: number, status: ObligationStatus) => void;
  onCite: (chunkId: string) => void;
  updatingId?: number | null;
}) {
  if (!obligations.length) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>No obligations found</EmptyTitle>
          <EmptyDescription>Tracked obligations will appear here when available.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription className="uppercase tracking-wider">Report · 03</CardDescription>
        <CardTitle>Obligations timeline</CardTitle>
        <CardDescription>
          Relative periods are not calendar facts until you confirm them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {obligations.map((item, index) => (
          <Card
            key={item.id ?? `${item.action}-${index}`}
            size="sm"
            className="border-l-4 border-l-primary bg-muted/40"
          >
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{item.party || "unknown party"}</Badge>
                <Badge variant="outline">{item.recurrence || "unknown"}</Badge>
              </div>
              <CardTitle className="text-sm">{item.action}</CardTitle>
              <CardDescription>
                Trigger: {item.trigger || "n/a"} · Deadline: {item.deadline || item.period || "unconfirmed"}
              </CardDescription>
              {item.consequence && (
                <CardDescription>Consequence: {item.consequence}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                {typeof item.id === "number" && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`obligation-status-${item.id}`} className="text-xs uppercase">
                      Status
                    </Label>
                    <Select
                      value={item.status}
                      disabled={updatingId === item.id}
                      onValueChange={(value) => {
                        if (value) onStatusChange(item.id!, value as ObligationStatus);
                      }}
                    >
                      <SelectTrigger id={`obligation-status-${item.id}`} size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(item.source_chunk_ids || []).map((chunkId) => (
                  <Button
                    key={chunkId}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => onCite(chunkId)}
                  >
                    Source
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
