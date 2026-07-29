"use client";

import { FormEvent, useRef } from "react";

export function QuestionComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = "Ask a follow-up about this contract…",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit(value);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 border-2 border-white/[0.14] bg-[#1a1a1d] p-2.5 shadow-[5px_5px_0_#27272a] focus-within:ring-2 focus-within:ring-violet-400/60"
    >
      <label htmlFor="workspace-question" className="sr-only">
        Ask a question about this document
      </label>
      <input
        ref={inputRef}
        id="workspace-question"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-base text-zinc-100 outline-none placeholder:opacity-40"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="grid h-12 w-12 shrink-0 place-items-center border border-violet-300/20 bg-violet-600 text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        aria-label="Send question"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
          <path d="m4 10 11-5-3.8 10-1.7-3.5L4 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  );
}
