"use client";

import { FormEvent, KeyboardEvent, useRef } from "react";
import { SendIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function QuestionComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = "Ask a follow-up about this contract…",
  onClearChat,
  hasMessages,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onClearChat?: () => void;
  hasMessages?: boolean;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit(value);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="workspace-question" className="sr-only">
        Ask a question about this document
      </label>

      <div className="rounded-xl border border-input bg-background p-2 shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <Textarea
          ref={inputRef}
          id="workspace-question"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={3}
          className="min-h-[72px] resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center justify-between gap-2 px-1 pb-1">
          <p className="text-[11px] text-muted-foreground">
            Enter to send · Shift+Enter for new line
          </p>
          <div className="flex items-center gap-2">
            {onClearChat && hasMessages && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearChat}
                disabled={disabled}
                title="Clear current chat history"
              >
                <Trash2Icon />
                Clear
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={disabled || !value.trim()}
              aria-label="Send question"
            >
              Ask AI
              <SendIcon />
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
