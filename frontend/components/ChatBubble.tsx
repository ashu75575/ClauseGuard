"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, ArrowUpRightIcon } from "lucide-react";
import type { Citation } from "@/lib/apiClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  noAnswer?: boolean;
  responseStatus?: "answered" | "not_found" | "needs_clarification";
  answerType?: string;
  followUps?: string[];
}

export function ChatBubble({
  message,
  availableChunks,
  onCitation,
  onFollowUp,
}: {
  message: ChatMessage;
  availableChunks: Set<string>;
  onCitation: (chunkId: string) => void;
  onFollowUp?: (question: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const needsClarification = message.responseStatus === "needs_clarification";
  const unavailable = message.noAnswer || message.responseStatus === "not_found";

  function handleCopy() {
    void navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  const label = needsClarification
    ? "Clarification needed"
    : message.answerType === "document_summary"
      ? "Document summary"
      : message.answerType === "risk_analysis"
        ? "Risk analysis"
        : "Grounded answer";

  return (
    <div className="flex w-full items-start gap-3">
      <Avatar size="sm" className="mt-1">
        <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
          CG
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-3 rounded-2xl rounded-tl-md border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">{label}</Badge>
          <Button type="button" variant="ghost" size="xs" onClick={handleCopy}>
            {copied ? <CheckIcon className="text-emerald-500" /> : <CopyIcon />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        {unavailable || needsClarification ? (
          <Alert>
            <AlertDescription>
              <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
            </AlertDescription>
          </Alert>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">
            {message.content}
          </p>
        )}

        {message.citations && message.citations.length > 0 && (
          <div className="space-y-2">
            <Separator />
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Sources
            </p>
            <div className="flex flex-wrap gap-2">
              {message.citations.map((citation, index) => {
                const available = availableChunks.has(citation.chunk_id);
                return (
                  <Button
                    key={`${citation.chunk_id}-${index}`}
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={!available}
                    onClick={() => onCitation(citation.chunk_id)}
                    title={
                      available
                        ? `View cited clause on page ${citation.page}`
                        : "Cited clause is unavailable in this report"
                    }
                  >
                    <ArrowUpRightIcon />
                    {available
                      ? `[${index + 1}] Page ${citation.page}`
                      : `Page ${citation.page} · unavailable`}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {message.followUps && message.followUps.length > 0 && onFollowUp && (
          <div className="space-y-2">
            <Separator />
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Suggested follow-ups
            </p>
            <div className="flex flex-col gap-2">
              {message.followUps.map((question) => (
                <Button
                  key={question}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={cn("h-auto justify-start whitespace-normal px-3 py-2 text-left")}
                  onClick={() => onFollowUp(question)}
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
