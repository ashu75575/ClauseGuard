"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileTextIcon,
  MessageSquareIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { CategoryBreakdownChart } from "@/components/CategoryBreakdownChart";
import { ChatBubble, type ChatMessage } from "@/components/ChatBubble";
import { ClauseCard } from "@/components/ClauseCard";
import { DashboardKpis } from "@/components/DashboardKpis";
import { EvidenceDrawer } from "@/components/EvidenceDrawer";
import { ExecutiveSummary } from "@/components/ExecutiveSummary";
import { ModeToggle } from "@/components/ModeToggle";
import { NegotiationPlaybook } from "@/components/NegotiationPlaybook";
import { ObligationStatusCard } from "@/components/ObligationStatusCard";
import { ObligationsTimeline } from "@/components/ObligationsTimeline";
import { PriorityFindings } from "@/components/PriorityFindings";
import { QuestionComposer } from "@/components/QuestionComposer";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ApiError,
  askQuestion,
  clearChatHistory,
  exportReportUrl,
  getApiErrorMessage,
  getChatHistory,
  getReport,
  updateObligation,
  type Clause,
  type DashboardStats,
  type ObligationStatus,
  type Report,
  type Severity,
} from "@/lib/apiClient";
import { summarizeSeverity } from "@/lib/recentDocuments";

const severityOrder: Severity[] = ["high", "medium", "low"];
const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
type ReportTab = "overview" | "priorities" | "obligations" | "playbook" | "findings";

function pageValue(page: number | string): number {
  const parsed = Number(page);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function hasNoAnswer(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return (
    !normalized ||
    ["no answer", "not found", "could not find", "cannot find", "no relevant", "no sufficiently relevant"].some(
      (phrase) => normalized.includes(phrase),
    )
  );
}

function buildDashboardFallback(report: Report): DashboardStats {
  const flags = report.flags || [];
  const severity = summarizeSeverity(flags);
  const categoryMap = new Map<string, { count: number; high: number; medium: number; low: number }>();
  const confidences: number[] = [];

  for (const flag of flags) {
    const category = (flag.category || "uncategorized").trim() || "uncategorized";
    const bucket = categoryMap.get(category) || { count: 0, high: 0, medium: 0, low: 0 };
    bucket.count += 1;
    bucket[flag.severity] += 1;
    categoryMap.set(category, bucket);
    if (typeof flag.confidence === "number") confidences.push(flag.confidence);
  }

  const obligationStatus: Record<ObligationStatus, number> = {
    unconfirmed: 0,
    confirmed: 0,
    completed: 0,
    dismissed: 0,
  };
  const partyMap = new Map<string, number>();
  for (const item of report.obligations || []) {
    obligationStatus[item.status] += 1;
    const party = (item.party || "unknown party").trim() || "unknown party";
    partyMap.set(party, (partyMap.get(party) || 0) + 1);
  }

  const avg =
    confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : null;

  return {
    flag_count: flags.length,
    priority_count: report.review_priorities?.length || 0,
    obligation_count: report.obligations?.length || 0,
    playbook_count: report.negotiation_playbook?.length || 0,
    section_count: report.section_count || 0,
    chunk_count: report.chunk_count || 0,
    avg_confidence: avg == null ? null : Math.round((avg <= 1 ? avg * 100 : avg) * 10) / 10,
    severity_summary: severity,
    obligation_status: obligationStatus,
    category_breakdown: Array.from(categoryMap.entries())
      .map(([category, counts]) => ({ category, ...counts }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
    parties: Array.from(partyMap.entries())
      .map(([party, count]) => ({ party, count }))
      .sort((a, b) => b.count - a.count || a.party.localeCompare(b.party)),
  };
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
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>("overview");
  const [highlightedChunk, setHighlightedChunk] = useState<string | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [updatingObligationId, setUpdatingObligationId] = useState<number | null>(null);
  const messageCounter = useRef(0);
  const streamEndRef = useRef<HTMLDivElement>(null);

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
  const dashboard = useMemo(
    () => (report ? report.dashboard || buildDashboardFallback(report) : null),
    [report],
  );
  const summary = useMemo(
    () => dashboard?.severity_summary || summarizeSeverity(flags),
    [dashboard, flags],
  );
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

  const viewInReport = useCallback((chunkId: string) => {
    setEvidenceOpen(false);
    setChatOpen(false);
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
  }, []);

  function handleSeverityFilter(next: Severity | "all") {
    setSeverityFilter(next);
    if (next !== "all") setActiveReportTab("findings");
  }

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
    setChatOpen(true);
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

  async function handleClearChat() {
    if (sending || clearing || messages.length === 0) return;
    setClearing(true);
    try {
      await clearChatHistory(docId);
      setMessages([]);
      setChatError(null);
    } catch (caught) {
      setChatError(getApiErrorMessage(caught));
    } finally {
      setClearing(false);
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
              dashboard: undefined,
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
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-7xl space-y-4 px-5 py-10" aria-busy="true">
          <Skeleton className="h-14 w-full" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-64 lg:col-span-2" />
            <Skeleton className="h-64" />
          </div>
          <p className="sr-only">Loading document dashboard</p>
        </main>
      </div>
    );
  }

  if (notFound || error || !report || !dashboard) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <Empty className="max-w-md border">
          <EmptyHeader>
            <EmptyTitle>{notFound ? "Report not found" : "Couldn’t load this report"}</EmptyTitle>
            <EmptyDescription>
              {notFound
                ? "This document may no longer exist, or the link may be incorrect."
                : error || "The report returned no data."}
            </EmptyDescription>
          </EmptyHeader>
          <div className="flex gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
              Back home
            </Button>
            <Button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                setNotFound(false);
                setReloadKey((value) => value + 1);
              }}
            >
              Retry
            </Button>
          </div>
        </Empty>
      </div>
    );
  }

  const overallRisk = report.overall_risk || (summary.high ? "high" : summary.medium ? "medium" : "low");
  const selectedClause = selectedChunk ? clauseById.get(selectedChunk) || null : null;
  const filename = report.filename || `Document ${docId.slice(0, 8)}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              nativeButton={false}
              render={<Link href="/" />}
              aria-label="Back to library"
            >
              <ArrowLeftIcon />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold sm:text-base">{filename}</h1>
                <SeverityBadge severity={overallRisk} />
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {dashboard.flag_count} flags · {dashboard.obligation_count} obligations ·{" "}
                {dashboard.section_count} sections
                {report.analyzed_at ? ` · ${new Date(report.analyzed_at).toLocaleString()}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              nativeButton={false}
              render={<a href={exportReportUrl(docId, "pdf")} />}
            >
              <DownloadIcon />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hidden md:inline-flex"
              nativeButton={false}
              render={<a href={exportReportUrl(docId, "docx")} />}
            >
              <FileTextIcon />
              DOCX
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setChatOpen(true)}>
              <MessageSquareIcon />
              <span className="hidden sm:inline">Ask</span>
              {messages.length > 0 && <Badge variant="secondary">{messages.length}</Badge>}
            </Button>
            <Button size="sm" nativeButton={false} render={<Link href="/" />}>
              <PlusIcon />
              <span className="hidden sm:inline">New</span>
            </Button>
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-6 pb-10 sm:px-8">
        {/* <DashboardKpis
          stats={dashboard}
          overallRisk={overallRisk}
          severityFilter={severityFilter}
          onSeverityFilter={handleSeverityFilter}
        /> */}

        <Tabs
          value={activeReportTab}
          onValueChange={(value) => setActiveReportTab(value as ReportTab)}
        >
          <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="priorities">
              Priorities
              <Badge variant="secondary" className="ml-1">
                {dashboard.priority_count}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="obligations">
              Obligations
              <Badge variant="secondary" className="ml-1">
                {dashboard.obligation_count}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="playbook">
              Playbook
              <Badge variant="secondary" className="ml-1">
                {dashboard.playbook_count}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="findings">
              Clauses
              <Badge variant="secondary" className="ml-1">
                {dashboard.flag_count}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <ExecutiveSummary
                  summary={report.executive_summary || ""}
                  overallRisk={overallRisk}
                  flagCount={flags.length}
                  disclaimer={report.disclaimer}
                  analyzedAt={report.analyzed_at}
                  model={report.model}
                />
              </div>
              <div className="lg:col-span-2">
                <ObligationStatusCard stats={dashboard} />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <CategoryBreakdownChart items={dashboard.category_breakdown} />
              </div>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardDescription>Quick actions</CardDescription>
                  <CardTitle>Suggested questions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(report.suggested_questions || []).length === 0 ? (
                    <Empty className="border border-dashed py-6">
                      <EmptyHeader>
                        <EmptyTitle>No suggestions</EmptyTitle>
                        <EmptyDescription>Open Ask to interrogate this contract.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    (report.suggested_questions || []).map((item) => (
                      <Button
                        key={item}
                        type="button"
                        variant="outline"
                        className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left text-xs leading-5"
                        onClick={() => void send(item)}
                      >
                        {item}
                      </Button>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="min-w-0">
                <PriorityFindings
                  priorities={(report.review_priorities || []).slice(0, 3)}
                  onCite={openEvidence}
                />
              </div>
              <div className="min-w-0">
                <ObligationsTimeline
                  obligations={(report.obligations || []).slice(0, 3)}
                  onStatusChange={handleObligationStatus}
                  onCite={openEvidence}
                  updatingId={updatingObligationId}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="priorities" className="mt-4">
            <PriorityFindings priorities={report.review_priorities || []} onCite={openEvidence} />
          </TabsContent>

          <TabsContent value="obligations" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <ObligationStatusCard stats={dashboard} />
              </div>
              <div className="lg:col-span-2">
                <ObligationsTimeline
                  obligations={report.obligations || []}
                  onStatusChange={handleObligationStatus}
                  onCite={openEvidence}
                  updatingId={updatingObligationId}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="playbook" className="mt-4">
            <NegotiationPlaybook items={report.negotiation_playbook || []} onCite={openEvidence} />
          </TabsContent>

          <TabsContent value="findings" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <CardDescription>Clause inventory</CardDescription>
                    <CardTitle>Flagged clauses</CardTitle>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={categoryFilter}
                      onValueChange={(value) => {
                        if (value) setCategoryFilter(value);
                      }}
                    >
                      <SelectTrigger size="sm">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category.replaceAll("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={sort}
                      onValueChange={(value) => {
                        if (value === "severity" || value === "page") setSort(value);
                      }}
                    >
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="severity">Severity first</SelectItem>
                        <SelectItem value="page">Page order</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {flags.length === 0 ? (
                  <Empty className="border border-dashed">
                    <EmptyHeader>
                      <EmptyTitle>No risks flagged</EmptyTitle>
                      <EmptyDescription>This document had no flagged clauses.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : grouped.length === 0 ? (
                  <Empty className="border border-dashed">
                    <EmptyHeader>
                      <EmptyTitle>No matching clauses</EmptyTitle>
                      <EmptyDescription>No clauses match these filters.</EmptyDescription>
                    </EmptyHeader>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSeverityFilter("all");
                        setCategoryFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  </Empty>
                ) : (
                  <div className="space-y-6">
                    {grouped.map((group) => (
                      <section key={group.severity}>
                        <div className="mb-2 flex items-center gap-2">
                          <SeverityBadge severity={group.severity} count={group.clauses.length} />
                          <Separator className="flex-1" />
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl"
        >
          <SheetHeader className="border-b pr-12">
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle>Ask this contract</SheetTitle>
              <Badge variant="outline">{messages.length} messages</Badge>
            </div>
            <SheetDescription>
              Answers stay grounded in this document and cite source clauses.
            </SheetDescription>
          </SheetHeader>

          <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5 sm:px-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500" />
              Persistent chat · not legal advice
            </div>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleClearChat}
                disabled={clearing || sending}
              >
                <Trash2Icon />
                {clearing ? "Clearing…" : "Clear history"}
              </Button>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
            {messages.length === 0 && (
              <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-8 text-center">
                <Avatar size="lg">
                  <AvatarFallback className="bg-primary text-primary-foreground">CG</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <p className="text-base font-medium">What do you want to know?</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Ask about termination, payment terms, liability, renewals, or negotiation leverage.
                  </p>
                </div>
                {(report.suggested_questions || []).length > 0 && (
                  <div className="grid w-full gap-2 text-left">
                    {(report.suggested_questions || []).slice(0, 4).map((item) => (
                      <Button
                        key={item}
                        type="button"
                        variant="outline"
                        className="h-auto justify-start whitespace-normal px-4 py-3 text-left text-sm leading-5"
                        onClick={() => void send(item)}
                      >
                        {item}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
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
                <Avatar size="sm" className="mt-1">
                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                    CG
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-2xl rounded-tl-md border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                  Analyzing the document…
                </div>
              </div>
            )}

            {chatError && (
              <Alert variant="destructive">
                <AlertTitle>Chat error</AlertTitle>
                <AlertDescription>
                  <p>{chatError}</p>
                  {failedQuestion && (
                    <Button
                      type="button"
                      variant="link"
                      className="mt-1 h-auto p-0"
                      onClick={() => void send(failedQuestion)}
                    >
                      Retry question
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <div ref={streamEndRef} />
          </div>

          <div className="border-t bg-background/95 p-4 backdrop-blur sm:p-5">
            <QuestionComposer
              value={question}
              onChange={setQuestion}
              onSubmit={(value) => void send(value)}
              disabled={sending || clearing}
              placeholder="Ask about risks, obligations, deadlines…"
            />
          </div>
        </SheetContent>
      </Sheet>

      <EvidenceDrawer
        open={evidenceOpen}
        clause={selectedClause}
        onClose={() => setEvidenceOpen(false)}
        onViewInReport={viewInReport}
      />
    </div>
  );
}
