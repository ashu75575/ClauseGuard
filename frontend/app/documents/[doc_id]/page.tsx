"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatBubble, type ChatMessage } from "@/components/ChatBubble";
import { ClauseCard } from "@/components/ClauseCard";
import { EvidenceDrawer } from "@/components/EvidenceDrawer";
import { ExecutiveSummary } from "@/components/ExecutiveSummary";
import { NegotiationPlaybook } from "@/components/NegotiationPlaybook";
import { ObligationsTimeline } from "@/components/ObligationsTimeline";
import { PriorityFindings } from "@/components/PriorityFindings";
import { QuestionComposer } from "@/components/QuestionComposer";
import { SeverityBadge } from "@/components/SeverityBadge";
import {
  ApiError,
  askQuestion,
  exportReportUrl,
  getApiErrorMessage,
  getChatHistory,
  getReport,
  updateObligation,
  type Clause,
  type ObligationStatus,
  type Report,
  type Severity,
} from "@/lib/apiClient";
import { findRecentDocument, summarizeSeverity, type RecentDocument } from "@/lib/recentDocuments";

const severityOrder: Severity[] = ["high", "medium", "low"];
const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
type ReportTab = "priorities" | "obligations" | "playbook" | "findings";

function pageValue(page: number | string): number {
  const parsed = Number(page);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function hasNoAnswer(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return (
    !normalized ||
    ["no answer", "not found", "could not find", "cannot find", "no relevant", "no sufficiently relevant"].some((phrase) =>
      normalized.includes(phrase),
    )
  );
}

export default function DocumentReportPage() {
  const params = useParams<{ doc_id: string }>();
  const docId = decodeURIComponent(params.doc_id);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState<"severity" | "page">("severity");
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>("priorities");
  const [highlightedChunk, setHighlightedChunk] = useState<string | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [metadata, setMetadata] = useState<RecentDocument | undefined>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [updatingObligationId, setUpdatingObligationId] = useState<number | null>(null);
  const messageCounter = useRef(0);
  const streamEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const task = window.setTimeout(() => setMetadata(findRecentDocument(docId)), 0);
    return () => window.clearTimeout(task);
  }, [docId]);

  useEffect(() => {
    let active = true;
    const task = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      setNotFound(false);

      Promise.all([getReport(docId), getChatHistory(docId).catch(() => [])])
        .then(([data, history]) => {
          if (!active) return;
          setReport({
            ...data,
            flags: Array.isArray(data.flags) ? data.flags : [],
            review_priorities: data.review_priorities || [],
            obligations: data.obligations || [],
            negotiation_playbook: data.negotiation_playbook || [],
            suggested_questions: data.suggested_questions || [],
          });
          const hydrated: ChatMessage[] = (history || [])
            .filter((item) => item.role === "user" || item.role === "assistant")
            .map((item) => ({
              id: `hist-${item.id}`,
              role: item.role as "user" | "assistant",
              content: item.content,
              citations: item.citations || [],
              noAnswer: item.role === "assistant" ? hasNoAnswer(item.content) : false,
              responseStatus:
                item.role === "assistant" && hasNoAnswer(item.content) ? "not_found" : undefined,
            }));
          messageCounter.current = hydrated.length;
          setMessages(hydrated);
        })
        .catch((caught) => {
          if (!active) return;
          if (caught instanceof ApiError && caught.status === 404) setNotFound(true);
          else setError(getApiErrorMessage(caught));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(task);
    };
  }, [docId, reloadKey]);

  const flags = useMemo(() => report?.flags || [], [report]);
  const summary = useMemo(() => summarizeSeverity(flags), [flags]);
  const categories = useMemo(
    () =>
      Array.from(
        new Set(flags.map((clause) => clause.category?.trim()).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b)),
    [flags],
  );
  const availableChunks = useMemo(() => new Set(flags.map((clause) => clause.chunk_id)), [flags]);
  const clauseById = useMemo(() => {
    const map = new Map<string, Clause>();
    flags.forEach((clause) => map.set(clause.chunk_id, clause));
    return map;
  }, [flags]);

  const grouped = useMemo(() => {
    const filtered = flags
      .filter((clause) => severityFilter === "all" || clause.severity === severityFilter)
      .filter((clause) => categoryFilter === "all" || clause.category?.trim() === categoryFilter)
      .sort((a, b) =>
        sort === "page"
          ? pageValue(a.page) - pageValue(b.page)
          : severityRank[a.severity] - severityRank[b.severity] || pageValue(a.page) - pageValue(b.page),
      );
    return severityOrder
      .map((severity) => ({
        severity,
        clauses: filtered.filter((clause) => clause.severity === severity),
      }))
      .filter((group) => group.clauses.length > 0);
  }, [flags, severityFilter, categoryFilter, sort]);

  const openEvidence = useCallback(
    (chunkId: string) => {
      if (!availableChunks.has(chunkId)) return;
      setSelectedChunk(chunkId);
      setEvidenceOpen(true);
      setHighlightedChunk(chunkId);
      window.setTimeout(() => setHighlightedChunk(null), 2200);
    },
    [availableChunks],
  );

  const viewInReport = useCallback(
    (chunkId: string) => {
      setEvidenceOpen(false);
      setActiveReportTab("findings");
      setSeverityFilter("all");
      setCategoryFilter("all");
      window.setTimeout(() => {
        const element = document.getElementById(`clause-${chunkId}`);
        if (!element) return;
        setHighlightedChunk(chunkId);
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => setHighlightedChunk(null), 2200);
      }, 100);
    },
    [],
  );

  async function send(value: string) {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    messageCounter.current += 1;
    setMessages((current) => [
      ...current,
      { id: `user-${messageCounter.current}`, role: "user", content: trimmed },
    ]);
    setQuestion("");
    setSending(true);
    setChatError(null);
    setFailedQuestion(null);
    try {
      const response = await askQuestion(docId, trimmed);
      const noAnswer = response.status === "not_found";
      messageCounter.current += 1;
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${messageCounter.current}`,
          role: "assistant",
          content: response.answer.trim(),
          citations: response.citations || [],
          noAnswer,
          responseStatus: response.status,
          answerType: response.answer_type,
          followUps: response.follow_ups || [],
        },
      ]);
      window.setTimeout(() => streamEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (caught) {
      setChatError(getApiErrorMessage(caught));
      setFailedQuestion(trimmed);
    } finally {
      setSending(false);
    }
  }

  async function handleObligationStatus(id: number, status: ObligationStatus) {
    setUpdatingObligationId(id);
    try {
      const updated = await updateObligation(id, status);
      setReport((current) =>
        current
          ? {
              ...current,
              obligations: (current.obligations || []).map((item) =>
                item.id === id ? { ...item, status: updated.status } : item,
              ),
            }
          : current,
      );
    } catch (caught) {
      setChatError(getApiErrorMessage(caught));
    } finally {
      setUpdatingObligationId(null);
    }
  }

  if (loading) {
    return (
      <div className="pixel-grid min-h-screen bg-[#0d0d0f]">
        <main className="mx-auto max-w-4xl px-5 py-10" aria-busy="true">
          <div className="h-10 animate-pulse bg-white/[0.05]" />
          <div className="mt-6 h-40 animate-pulse bg-white/[0.04]" />
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-28 animate-pulse bg-white/[0.04]" />
            ))}
          </div>
          <p className="sr-only">Loading document report</p>
        </main>
      </div>
    );
  }

  if (notFound || error || !report) {
    return (
      <div className="pixel-grid min-h-screen bg-[#0d0d0f]">
        <main className="mx-auto flex max-w-xl flex-col items-center px-5 py-28 text-center">
          <h1 className="text-xl font-black text-zinc-100">
            {notFound ? "Report not found" : "Couldn’t load this report"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {notFound
              ? "This document may no longer exist, or the link may be incorrect."
              : error || "The report returned no data."}
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/"
              className="border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5"
            >
              Back home
            </Link>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                setNotFound(false);
                setReloadKey((value) => value + 1);
              }}
              className="border border-violet-300/30 bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  const overallRisk = report.overall_risk || (summary.high ? "high" : summary.medium ? "medium" : "low");
  const selectedClause = selectedChunk ? clauseById.get(selectedChunk) || null : null;

  return (
    <div className="pixel-grid min-h-screen bg-[#0d0d0f]">
      <header className="sticky top-0 z-30 border-b-2 border-white/[0.1] bg-[#0d0d0f]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="grid h-9 w-9 shrink-0 place-items-center border border-white/[0.12] text-zinc-400 hover:text-white"
              aria-label="Back to library"
            >
              ←
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-zinc-100 sm:text-base">
                {metadata?.filename || `Document ${docId.slice(0, 8)}`}
              </h1>
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-zinc-600">
                Centered legal workspace // {flags.length} flags
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={exportReportUrl(docId, "pdf")}
              className="hidden border border-white/[0.12] px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-300 hover:border-violet-400/40 sm:inline-flex"
            >
              Export PDF
            </a>
            <a
              href={exportReportUrl(docId, "docx")}
              className="hidden border border-white/[0.12] px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-300 hover:border-violet-400/40 md:inline-flex"
            >
              Export DOCX
            </a>
            <Link
              href="/"
              className="border-2 border-violet-300/30 bg-violet-600 px-3 py-2 font-mono text-[9px] font-black uppercase tracking-wider text-white shadow-[3px_3px_0_#312e81]"
            >
              New analysis
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-36 pt-8 sm:px-8">
        <div className="mb-6 flex items-start gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center border border-violet-300/30 bg-violet-600 font-mono text-[10px] font-black text-white shadow-[3px_3px_0_#312e81]">
            CG
          </div>
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-violet-400">
              ClauseGuard agent
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Structured contract review with citations, obligations, and negotiation guidance.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <ExecutiveSummary
            summary={report.executive_summary || ""}
            overallRisk={overallRisk}
            flagCount={flags.length}
            disclaimer={report.disclaimer}
            analyzedAt={report.analyzed_at}
            model={report.model}
          />

          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Risk summary">
            <div className="border border-white/[0.1] bg-[#151517] p-3">
              <p className="font-mono text-xl font-black text-white">{flags.length}</p>
              <p className="font-mono text-[8px] uppercase tracking-wider text-zinc-600">Total</p>
            </div>
            {severityOrder.map((severity) => (
              <button
                key={severity}
                type="button"
                onClick={() => setSeverityFilter(severityFilter === severity ? "all" : severity)}
                className={`border border-white/[0.1] p-3 text-left ${
                  severityFilter === severity ? "bg-violet-400/10" : "bg-[#151517] hover:bg-[#19191c]"
                }`}
              >
                <p className="font-mono text-xl font-black text-white">{summary[severity]}</p>
                <p className="font-mono text-[8px] uppercase tracking-wider text-zinc-600">{severity}</p>
              </button>
            ))}
          </section>

          <section aria-label="Report details">
            <div
              className="grid grid-cols-2 border-2 border-white/[0.12] bg-[#101012] sm:grid-cols-4"
              role="tablist"
              aria-label="Report sections"
            >
              {[
                {
                  id: "priorities" as const,
                  label: "Review first",
                  count: report.review_priorities?.length || 0,
                },
                {
                  id: "obligations" as const,
                  label: "Obligations",
                  count: report.obligations?.length || 0,
                },
                {
                  id: "playbook" as const,
                  label: "Playbook",
                  count: report.negotiation_playbook?.length || 0,
                },
                { id: "findings" as const, label: "Clauses", count: flags.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeReportTab === tab.id}
                  onClick={() => setActiveReportTab(tab.id)}
                  className={`flex min-h-16 items-center justify-between gap-2 border-white/[0.1] px-4 text-left transition sm:min-h-20 sm:flex-col sm:items-start sm:justify-center ${
                    activeReportTab === tab.id
                      ? "bg-violet-600 text-white shadow-[inset_0_-3px_0_#c4b5fd]"
                      : "bg-[#151517] text-zinc-400 hover:bg-[#1a1a1d] hover:text-white"
                  } border-b first:border-r sm:border-b-0 sm:border-r`}
                >
                  <span className="font-mono text-[9px] font-black uppercase tracking-[0.12em]">
                    {tab.label}
                  </span>
                  <span
                    className={`font-mono text-lg font-black ${
                      activeReportTab === tab.id ? "text-violet-100" : "text-zinc-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-3" role="tabpanel">
              {activeReportTab === "priorities" && (
                <PriorityFindings priorities={report.review_priorities || []} onCite={openEvidence} />
              )}
              {activeReportTab === "obligations" && (
                <ObligationsTimeline
                  obligations={report.obligations || []}
                  onStatusChange={handleObligationStatus}
                  onCite={openEvidence}
                  updatingId={updatingObligationId}
                />
              )}
              {activeReportTab === "playbook" && (
                <NegotiationPlaybook items={report.negotiation_playbook || []} onCite={openEvidence} />
              )}
              {activeReportTab === "findings" && (
                <section
                  className="border-2 border-white/[0.12] bg-[#151517] p-5 sm:p-7"
                  aria-labelledby="findings-heading"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">
                        Report // 05
                      </p>
                      <h2
                        id="findings-heading"
                        className="mt-3 text-xl font-black tracking-[-0.03em] text-white"
                      >
                        Flagged clauses
                      </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={categoryFilter}
                        onChange={(event) => setCategoryFilter(event.target.value)}
                        className="border border-white/[0.12] bg-[#1d1d20] px-3 py-2 font-mono text-[9px] uppercase text-zinc-300 outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                      >
                        <option value="all">All categories</option>
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                      <select
                        value={sort}
                        onChange={(event) => setSort(event.target.value as "severity" | "page")}
                        className="border border-white/[0.12] bg-[#1d1d20] px-3 py-2 font-mono text-[9px] uppercase text-zinc-300 outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                      >
                        <option value="severity">Severity first</option>
                        <option value="page">Page order</option>
                      </select>
                    </div>
                  </div>

                  {flags.length === 0 ? (
                    <div className="mt-5 border border-emerald-300/20 bg-emerald-300/[0.05] p-8 text-center">
                      <p className="font-mono text-xs font-black uppercase text-emerald-200">
                        No risks flagged
                      </p>
                    </div>
                  ) : grouped.length === 0 ? (
                    <div className="mt-5 border border-white/[0.1] p-8 text-center">
                      <p className="text-sm text-zinc-400">No clauses match these filters.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setSeverityFilter("all");
                          setCategoryFilter("all");
                        }}
                        className="mt-3 font-mono text-[9px] font-bold uppercase text-violet-300"
                      >
                        Clear filters
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-6">
                      {grouped.map((group) => (
                        <section key={group.severity}>
                          <div className="mb-2 flex items-center gap-2">
                            <SeverityBadge severity={group.severity} count={group.clauses.length} />
                            <div className="h-px flex-1 bg-white/[0.08]" />
                          </div>
                          <div className="space-y-2">
                            {group.clauses.map((clause) => (
                              <ClauseCard
                                key={clause.chunk_id}
                                clause={clause}
                                highlighted={highlightedChunk === clause.chunk_id}
                              />
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          </section>

          {(report.suggested_questions || []).length > 0 && (
            <section className="border-2 border-white/[0.12] bg-[#151517] p-5 sm:p-7">
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">
                Report // 06
              </p>
              <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-white">Suggested questions</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {(report.suggested_questions || []).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => void send(item)}
                    className="border border-white/[0.12] bg-[#19191c] px-4 py-3 text-left text-xs leading-5 text-zinc-300 hover:border-violet-400/40"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-5 pt-4" aria-label="Document conversation">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                Conversation
              </p>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>

            {messages.length === 0 && (
              <p className="text-center text-base leading-7 text-zinc-400">
                Ask a follow-up. Answers stay grounded in this document and cite source clauses.
              </p>
            )}

            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                availableChunks={availableChunks}
                onCitation={openEvidence}
                onFollowUp={(followUp) => void send(followUp)}
              />
            ))}

            {sending && (
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center border border-violet-300/30 bg-violet-600 font-mono text-xs font-black text-white">
                  CG
                </div>
                <div className="border border-white/[0.1] bg-[#151517] px-5 py-4">
                  <p className="font-mono text-xs uppercase tracking-wider text-violet-400">Analyzing…</p>
                </div>
              </div>
            )}

            {chatError && (
              <div className="border-l-4 border-rose-400 bg-rose-400/[0.07] p-5 text-sm leading-6 text-rose-200" role="alert">
                <p>{chatError}</p>
                {failedQuestion && (
                  <button
                    type="button"
                    onClick={() => void send(failedQuestion)}
                    className="mt-2 font-semibold underline underline-offset-2"
                  >
                    Retry question
                  </button>
                )}
              </div>
            )}
            <div ref={streamEndRef} />
          </section>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-white/[0.1] bg-[#0d0d0f]/95 px-5 py-4 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl">
          <QuestionComposer
            value={question}
            onChange={setQuestion}
            onSubmit={(value) => void send(value)}
            disabled={sending}
          />
          <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-zinc-600">
            Persistent chat // not legal advice
          </p>
        </div>
      </div>

      <EvidenceDrawer
        open={evidenceOpen}
        clause={selectedClause}
        onClose={() => setEvidenceOpen(false)}
        onViewInReport={viewInReport}
      />
    </div>
  );
}
