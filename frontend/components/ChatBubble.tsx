import type { Citation } from "@/lib/apiClient";

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
  const isUser = message.role === "user";
  const needsClarification = message.responseStatus === "needs_clarification";
  const unavailable = message.noAnswer || message.responseStatus === "not_found";

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[90%] border-2 border-violet-300/25 bg-violet-600 px-5 py-4 text-base leading-7 text-white shadow-[4px_4px_0_#312e81] sm:max-w-[82%]">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full items-start gap-3 sm:gap-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center border border-violet-300/30 bg-violet-600 font-mono text-xs font-black text-white shadow-[3px_3px_0_#312e81]">
        CG
      </div>
      <div className="min-w-0 flex-1 border-2 border-white/[0.1] bg-[#151517] p-5 sm:p-6">
        <p className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-violet-400">
          {needsClarification
            ? "ClauseGuard // clarification"
            : message.answerType === "document_summary"
              ? "ClauseGuard // document summary"
              : message.answerType === "risk_analysis"
                ? "ClauseGuard // risk analysis"
                : "ClauseGuard agent"}
        </p>
        <div
          className={`text-base leading-8 sm:text-[17px] ${
            unavailable
              ? "border-l-4 border-amber-300 bg-amber-300/[0.07] px-4 py-3 text-amber-100"
              : needsClarification
                ? "border-l-4 border-violet-400 bg-violet-400/[0.07] px-4 py-3 text-violet-100"
              : "text-zinc-300"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        {message.citations && message.citations.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2.5">
            {message.citations.map((citation, index) => {
              const available = availableChunks.has(citation.chunk_id);
              return (
                <button
                  key={`${citation.chunk_id}-${index}`}
                  type="button"
                  disabled={!available}
                  onClick={() => onCitation(citation.chunk_id)}
                  className="min-h-10 border border-white/[0.14] bg-[#19191c] px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-300 transition hover:border-violet-400/50 hover:bg-violet-400/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  title={
                    available
                      ? `View cited clause on page ${citation.page}`
                      : "Cited clause is unavailable in this report"
                  }
                >
                  {available
                    ? `[${index + 1}] Page ${citation.page} ↗`
                    : `Page ${citation.page} · unavailable`}
                </button>
              );
            })}
          </div>
        )}
        {message.followUps && message.followUps.length > 0 && onFollowUp && (
          <div className="mt-5 flex flex-wrap gap-2.5">
            {message.followUps.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onFollowUp(question)}
                className="min-h-11 border border-violet-400/25 bg-violet-400/[0.07] px-4 py-2.5 text-left text-sm leading-5 text-violet-100 hover:bg-violet-400/15"
              >
                {question}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
