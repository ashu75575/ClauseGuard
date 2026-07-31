"use client";

import type { NegotiationItem } from "@/lib/apiClient";
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
import { Separator } from "@/components/ui/separator";

export function NegotiationPlaybook({
  items,
  onCite,
}: {
  items: NegotiationItem[];
  onCite: (chunkId: string) => void;
}) {
  if (!items.length) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>No playbook items</EmptyTitle>
          <EmptyDescription>Negotiation guidance will appear here when available.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription className="uppercase tracking-wider">Report · 04</CardDescription>
        <CardTitle>Negotiation playbook</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <Card key={item.category} size="sm" className="bg-muted/40">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={item.severity} />
                <Badge variant="secondary" className="uppercase">
                  {item.category.replaceAll("_", " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Primary ask
                </p>
                <p className="mt-1 text-sm">{item.primary_ask}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Fallback
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{item.fallback}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Rationale
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{item.rationale}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Suggested language
                </p>
                <p className="mt-1 border-l-2 pl-3 text-sm">{item.suggested_language}</p>
              </div>
              {(item.source_chunk_ids || []).length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
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
