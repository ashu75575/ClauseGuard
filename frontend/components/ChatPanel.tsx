"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { askQuestion, clearChatHistory, getApiErrorMessage } from "@/lib/apiClient";
import { ChatBubble, type ChatMessage } from "./ChatBubble";

const examples = [
  "What are my termination risks?",
  "Summarize payment obligations",
  "Which clauses need negotiation?",
];

export function ChatPanel({
  docId,
  availableChunks,
  onCitation,
  onClose,
}: {
  docId: string;
  availableChunks: Set<string>;
  onCitation: (chunkId: string) => void;
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageCounter = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function handleClearChat() {
    if (sending || clearing || messages.length === 0) return;
    setClearing(true);
    try {
      await clearChatHistory(docId);
      setMessages([]);
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setClearing(false);
    }
  }

  async function send(value: string) {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    messageCounter.current += 1;
    const userMessage: ChatMessage = {
      id: `user-${messageCounter.current}`,
      role: "user",
      content: trimmed,
    };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setSending(true);
    setError(null);
    setFailedQuestion(null);
    try {
      const response = await askQuestion(docId, trimmed);
      const noAnswer = response.status === "not_found";
      messageCounter.current += 1;
      const assistantMessage: ChatMessage = {
        id: `assistant-${messageCounter.current}`,
        role: "assistant",
        content: response.answer.trim(),
        citations: response.citations || [],
        noAnswer,
        responseStatus: response.status,
        answerType: response.answer_type,
        followUps: response.follow_ups || [],
      };
      setMessages((current) => [...current, assistantMessage]);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
      setFailedQuestion(trimmed);
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(question);
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#101012]" aria-label="Document assistant">
      <div className="flex h-16 shrink-0 items-center justify-between border-b-2 border-white/[0.1] px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center border border-violet-300/30 bg-violet-600 font-mono text-[10px] font-black text-white shadow-[3px_3px_0_#312e81]">
            CG
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-sm font-black uppercase tracking-[0.12em] text-zinc-100">Document agent</h2>
              <span className="h-1.5 w-1.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]" />
            </div>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-zinc-500">Grounded in this contract</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              disabled={clearing || sending}
              className="flex items-center gap-1.5 border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-rose-300 hover:border-rose-400 hover:bg-rose-500/20 disabled:opacity-40"
              title="Clear all chat history"
            >
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 6h12M8 6V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2m2 0v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6h12z" />
              </svg>
              <span>{clearing ? "Clearing..." : "Clear Chat"}</span>
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="border border-white/[0.12] p-2 text-zinc-500 hover:border-violet-400/40 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 lg:hidden"
              aria-label="Close document assistant"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
                <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <div className="grid h-14 w-14 place-items-center border-2 border-violet-300/25 bg-violet-600 text-white shadow-[6px_6px_0_#312e81]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path d="M5 6.5h14v10H9l-4 3v-13Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mt-6 text-2xl font-black tracking-[-0.04em] text-zinc-100">What should we inspect?</p>
            <p className="mt-3 max-w-lg text-base leading-7 text-zinc-400">
              Ask for a risk summary, negotiation advice, or an explanation of any obligation. Answers link back to source clauses.
            </p>
            <div className="mt-8 grid w-full gap-2 sm:grid-cols-3">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void send(example)}
                  className="min-h-28 border border-white/[0.12] bg-[#18181b] px-5 py-4 text-left text-sm leading-6 text-zinc-300 transition hover:-translate-y-0.5 hover:border-violet-400/40 hover:bg-violet-400/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  <span className="mb-3 block font-mono text-[11px] font-bold uppercase tracking-wider text-violet-400">Prompt ↗</span>
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                availableChunks={availableChunks}
                onCitation={onCitation}
                onFollowUp={(followUp) => void send(followUp)}
              />
            ))}
          </div>
        )}
        {sending && (
          <div className="mt-8 flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center border border-violet-300/30 bg-violet-600 font-mono text-xs font-black text-white">CG</div>
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-violet-400">Analyzing document</p>
              <div className="mt-3 flex gap-1.5" aria-label="ClauseGuard is answering">
                {[0, 1, 2].map((dot) => (
                  <span key={dot} className="h-2 w-2 animate-pulse bg-zinc-500" style={{ animationDelay: `${dot * 140}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="mt-6 border-l-4 border-rose-400 bg-rose-400/[0.07] p-5 text-sm leading-6 text-rose-200" role="alert">
            <p>{error}</p>
            {failedQuestion && (
              <button
                type="button"
                onClick={() => void send(failedQuestion)}
                className="mt-2 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                Retry question
              </button>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="shrink-0 border-t-2 border-white/[0.1] bg-[#101012] px-4 py-4 sm:px-6">
        <form onSubmit={submit} className="mx-auto flex max-w-3xl items-center gap-3 border-2 border-white/[0.14] bg-[#1a1a1d] p-2.5 shadow-[5px_5px_0_#27272a] focus-within:ring-2 focus-within:ring-violet-400/60">
          <label htmlFor="document-question" className="sr-only">Ask a question about this document</label>
          <input
            ref={inputRef}
            id="document-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={sending}
            placeholder="Ask about this contract…"
            className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-base text-zinc-100 outline-none placeholder:opacity-40"
          />
          <button
            type="submit"
            disabled={sending || !question.trim()}
            className="grid h-12 w-12 shrink-0 place-items-center border border-violet-300/20 bg-violet-600 text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            aria-label="Send question"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="m4 10 11-5-3.8 10-1.7-3.5L4 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
        <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-zinc-600">
          Document-grounded assistant // verify important legal decisions
        </p>
      </div>
    </section>
  );
}

