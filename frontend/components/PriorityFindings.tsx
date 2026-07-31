"use client";

import type { ReviewPriority } from "@/lib/apiClient";
import { SeverityBadge } from "./SeverityBadge";
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

export function PriorityFindings({
  priorities,
  onCite,
}: {
  priorities: ReviewPriority[];
  onCite: (chunkId: string) => void;
}) {
  if (!priorities.length) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>No priority findings</EmptyTitle>
          <EmptyDescription>Review priorities will appear here when available.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription className="uppercase tracking-wider">Report · 02</CardDescription>
        <CardTitle>Review first</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {priorities.map((item, index) => (
          <Card key={`${item.title}-${index}`} size="sm" className="bg-muted/40">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{String(index + 1).padStart(2, "0")}</Badge>
                <SeverityBadge severity={item.severity} />
                {item.category && (
                  <Badge variant="secondary" className="uppercase">
                    {item.category.replaceAll("_", " ")}
                  </Badge>
                )}
              </div>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.rationale}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Action ·{" "}
                </span>
                {item.action}
              </p>
              {item.source_chunk_ids?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.source_chunk_ids.map((chunkId) => (
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
              )}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
