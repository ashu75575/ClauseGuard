"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header, type LandingSection } from "@/components/Header";
import { SeverityBadge } from "@/components/SeverityBadge";
import { UploadDropzone, validateDocument } from "@/components/UploadDropzone";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import {
  compareDocuments,
  getApiErrorMessage,
  listDocuments,
  uploadDocument,
  type ComparisonResult,
  type DocumentSummary,
} from "@/lib/apiClient";
import {
  getRecentDocuments,
  saveRecentDocument,
  summarizeSeverity,
  type RecentDocument,
} from "@/lib/recentDocuments";

const ShapeGrid = dynamic(() => import("@/components/ShapeGrid"), { ssr: false });
const WORKFLOW = [
  {
    step: "01",
    title: "Drop the contract",
    description: "Upload a PDF or DOCX. ClauseGuard extracts and structures the document securely.",
  },
  {
    step: "02",
    title: "Scan every clause",
    description: "The analysis flags risky language, groups severity, and explains the impact in plain English.",
  },
  {
    step: "03",
    title: "Interrogate the fine print",
    description: "Ask document-specific questions and jump directly from cited answers to the source clause.",
  },
];
const CAPABILITIES = [
  "Liability caps",
  "Auto-renewal",
  "Termination rights",
  "Data sharing",
  "Payment terms",
  "Obligations timeline",
  "Negotiation playbooks",
  "Cross-doc compare",
];

export default function Home() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
  const [libraryDocs, setLibraryDocs] = useState<DocumentSummary[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [activeSection, setActiveSection] = useState<LandingSection | null>(null);
  const [selectedCompare, setSelectedCompare] = useState<string[]>([]);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    const task = window.setTimeout(() => setRecentDocuments(getRecentDocuments()), 0);
    listDocuments()
      .then((docs) => {
        setLibraryDocs(docs);
        setLibraryError(null);
      })
      .catch((error) => {
        setLibraryError(getApiErrorMessage(error));
        setLibraryDocs([]);
      });
    return () => window.clearTimeout(task);
  }, []);

  async function startUpload(file: File) {
    const validationError = validateDocument(file);
    if (validationError) {
      setFileError(validationError);
      return;
    }
    setFileError(null);
    setUploadError(null);
    setLastFile(file);
    setProgress(0);
    try {
      const report = await uploadDocument(file, setProgress);
      const document: RecentDocument = {
        docId: report.doc_id,
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        severitySummary: summarizeSeverity(report.flags || []),
      };
      saveRecentDocument(document);
      router.push(`/documents/${encodeURIComponent(report.doc_id)}`);
    } catch (error) {
      setUploadError(getApiErrorMessage(error));
      setProgress(null);
    }
  }

  const isUploading = progress !== null;

  return (
    <div className=" relative h-svh overflow-hidden bg-background">
      <Header onSectionSelect={setActiveSection} />
      <div
        className="absolute inset-0 z-0 opacity-70"
        aria-hidden="true"
      >
        {mounted && (
          <ShapeGrid
            key={isDark ? "dark" : "light"}
            speed={0.45}
            squareSize={45}
            direction="diagonal"
            shape="square"
            hoverTrailAmount={14}
            borderColor={isDark ? "rgba(148, 163, 184, 0.28)" : "rgba(148, 163, 184, 0.45)"}
            hoverFillColor={isDark ? "rgba(167, 139, 250, 0.35)" : "#222222"}
            vignetteColor={isDark ? "#0d0d0f" : "#ffffff"}
          />
        )}
      </div>

      <main className="pointer-events-none relative z-10 mx-auto h-[calc(100svh-4rem)] max-w-7xl overflow-hidden px-5 sm:px-8">
        <section className="grid h-full items-center gap-6 py-4 sm:py-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:py-8">
          <motion.div
            className="pointer-events-auto"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <Badge variant="secondary" className="gap-2 uppercase tracking-wider">
              <span className="size-2 rounded-full bg-primary" />
              Contract intelligence protocol
            </Badge>
            <h1 className="mt-5 max-w-3xl text-balance text-4xl font-black uppercase leading-[0.95] tracking-[-0.065em] sm:mt-7 sm:text-5xl lg:text-6xl xl:text-7xl">
              Read the fine print.
              <span className="mt-2 block text-muted-foreground">Before it costs you.</span>
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-sm leading-6 text-muted-foreground sm:mt-7 sm:text-base sm:leading-7 xl:text-lg">
              ClauseGuard turns dense contracts into a clear, cited risk report—so you can spot hidden
              obligations, negotiate confidently, and sign with context.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <input
                id="hero-contract-upload"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void startUpload(file);
                  event.currentTarget.value = "";
                }}
                aria-label="Choose a PDF or DOCX contract"
              />
              <Button
                type="button"
                size="lg"
                onClick={() => document.getElementById("hero-contract-upload")?.click()}
              >
                Analyze a contract
              </Button>
              <Button type="button" variant="link" onClick={() => setActiveSection("how-it-works")}>
                See how it works
              </Button>
            </div>

            <div className="mt-5 space-y-3 lg:hidden" aria-live="polite">
              {isUploading && (
                <Card size="sm">
                  <CardContent className="space-y-2 pt-(--card-spacing)">
                    <div className="flex items-center justify-between gap-4 text-xs">
                      <span className="truncate text-muted-foreground">
                        {progress < 100 ? "Uploading" : "Analyzing"} · {lastFile?.name}
                      </span>
                      <span className="shrink-0 tabular-nums">{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </CardContent>
                </Card>
              )}
              {(fileError || uploadError) && (
                <Alert variant="destructive">
                  <AlertDescription>{fileError || uploadError}</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="mt-10 hidden max-w-xl grid-cols-3 border-y lg:grid">
              {[
                ["12", "Risk categories"],
                ["03", "Severity levels"],
                ["LIVE", "Clause citations"],
              ].map(([value, label], index) => (
                <div key={label} className={`py-4 ${index > 0 ? "border-l pl-5" : ""}`}>
                  <p className="text-lg font-semibold">{value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            id="upload"
            className="pointer-events-auto hidden lg:block"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
          >
            <Card className="overflow-hidden shadow-lg">
              <CardHeader className="flex-row items-center justify-between border-b py-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-rose-400/70" />
                  <span className="size-2 rounded-full bg-amber-400/70" />
                  <span className="size-2 rounded-full bg-emerald-400/70" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  secure_scan.exe
                </span>
                <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400">
                  READY
                </Badge>
              </CardHeader>
              <CardContent className="p-2">
                {isUploading ? (
                  <div
                    className="flex min-h-72 flex-col items-center justify-center rounded-lg border bg-muted/40 px-6 text-center"
                    aria-live="polite"
                  >
                    <div className="grid size-14 place-items-center rounded-xl border bg-background text-muted-foreground">
                      <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
                        <path d="M7 3.5h7l3 3V20H7zM14 3.5V7h3" stroke="currentColor" strokeWidth="1.7" />
                      </svg>
                    </div>
                    <p className="mt-5 text-xs font-semibold uppercase tracking-wider">
                      {progress < 100 ? "Uploading document" : "Analyzing clauses"}
                    </p>
                    <p className="mt-2 max-w-sm truncate text-xs text-muted-foreground">
                      {lastFile?.name}
                    </p>
                    <Progress value={progress ?? 0} className="mt-5 w-full max-w-sm" />
                    <p className="mt-2 text-[10px] tabular-nums text-muted-foreground">
                      {progress < 100
                        ? `${progress}% uploaded`
                        : "Upload complete · review in progress"}
                    </p>
                  </div>
                ) : (
                  <UploadDropzone onFile={(file) => void startUpload(file)} error={fileError} />
                )}
              </CardContent>
            </Card>

            {uploadError && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>{uploadError}</span>
                  {lastFile && (
                    <Button type="button" size="sm" variant="outline" onClick={() => void startUpload(lastFile)}>
                      Retry
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Direct API transfer</span>
              <span>·</span>
              <span>PDF + DOCX</span>
              <span>·</span>
              <span>Cited analysis</span>
            </div>
          </motion.div>
        </section>
      </main>

      <Dialog open={!!activeSection} onOpenChange={(open) => !open && setActiveSection(null)}>
        <DialogContent className="max-h-[86svh] max-w-5xl overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogDescription className="uppercase tracking-wider">
              Section ·{" "}
              {activeSection === "how-it-works"
                ? "01"
                : activeSection === "capabilities"
                  ? "02"
                  : "03"}
            </DialogDescription>
            <DialogTitle>
              {activeSection === "how-it-works"
                ? "How it works"
                : activeSection === "capabilities"
                  ? "Capabilities"
                  : "Recent documents"}
            </DialogTitle>
          </DialogHeader>

          {activeSection === "how-it-works" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-3xl font-semibold tracking-tight">From upload to leverage.</h3>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  A focused review flow built for people who need answers, not another wall of legal text.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {WORKFLOW.map((item) => (
                  <Card key={item.step}>
                    <CardHeader>
                      <Badge variant="outline">{item.step}</Badge>
                      <CardTitle>{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeSection === "capabilities" && (
            <div className="space-y-6">
              <div>
                <h3 className="max-w-2xl text-3xl font-semibold tracking-tight">
                  Find the clauses that change the deal.
                </h3>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Every flag includes severity, category, page reference, original language, and a
                  practical explanation.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CAPABILITIES.map((capability, index) => (
                  <Card key={capability} size="sm">
                    <CardContent className="pt-(--card-spacing)">
                      <span className="text-[10px] text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <p className="mt-2 text-xs font-medium">{capability}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeSection === "documents" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-3xl font-semibold tracking-tight">Document library.</h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Persistent backend archive with optional local fallback metadata.
                  </p>
                </div>
                <Button
                  type="button"
                  disabled={selectedCompare.length < 2 || comparing}
                  onClick={() => {
                    setComparing(true);
                    setCompareError(null);
                    compareDocuments(selectedCompare)
                      .then((result) => setComparison(result))
                      .catch((error) => setCompareError(getApiErrorMessage(error)))
                      .finally(() => setComparing(false));
                  }}
                >
                  {comparing ? "Comparing…" : `Compare selected (${selectedCompare.length})`}
                </Button>
              </div>

              {libraryError && (
                <Alert>
                  <AlertDescription>
                    Library API unavailable: {libraryError}. Showing local fallback.
                  </AlertDescription>
                </Alert>
              )}

              {libraryDocs.length === 0 && recentDocuments.length === 0 ? (
                <Empty className="border border-dashed">
                  <EmptyHeader>
                    <EmptyTitle>No documents yet</EmptyTitle>
                    <EmptyDescription>Upload a contract to populate the library.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="grid gap-3">
                  {(libraryDocs.length > 0
                    ? libraryDocs.map((document) => ({
                        docId: document.doc_id,
                        filename: document.filename,
                        uploadedAt: document.created_at || new Date().toISOString(),
                        severitySummary: document.severity_summary,
                        risk: document.overall_risk,
                      }))
                    : recentDocuments.map((document) => ({
                        docId: document.docId,
                        filename: document.filename,
                        uploadedAt: document.uploadedAt,
                        severitySummary: document.severitySummary,
                        risk: undefined as string | undefined,
                      }))
                  ).map((document) => {
                    const selected = selectedCompare.includes(document.docId);
                    return (
                      <Card key={document.docId} size="sm">
                        <CardContent className="flex flex-col gap-4 pt-(--card-spacing) sm:flex-row sm:items-center">
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={selected}
                              onCheckedChange={() => {
                                setSelectedCompare((current) =>
                                  selected
                                    ? current.filter((id) => id !== document.docId)
                                    : current.length >= 2
                                      ? [current[1], document.docId]
                                      : [...current, document.docId],
                                );
                              }}
                            />
                            Compare
                          </label>
                          <Link
                            href={`/documents/${encodeURIComponent(document.docId)}`}
                            className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="block truncate text-sm font-medium">{document.filename}</span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Uploaded {new Date(document.uploadedAt).toLocaleString()}
                              {document.risk ? ` · risk ${document.risk}` : ""}
                            </span>
                          </Link>
                          <span className="flex flex-wrap gap-2">
                            <SeverityBadge severity="high" count={document.severitySummary.high} />
                            <SeverityBadge severity="medium" count={document.severitySummary.medium} />
                            <SeverityBadge severity="low" count={document.severitySummary.low} />
                          </span>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {compareError && (
                <Alert variant="destructive">
                  <AlertDescription>{compareError}</AlertDescription>
                </Alert>
              )}

              {comparison && (
                <Card>
                  <CardHeader>
                    <CardDescription className="uppercase tracking-wider">
                      Comparison result
                    </CardDescription>
                    <CardTitle className="text-base font-normal leading-6">
                      {comparison.summary}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {comparison.pairs.map((pair, index) => (
                      <Card key={`${pair.left.chunk_id}-${pair.right.chunk_id}-${index}`} size="sm">
                        <CardHeader>
                          <CardDescription>
                            {pair.category.replaceAll("_", " ")} · similarity{" "}
                            {(pair.similarity * 100).toFixed(0)}%
                          </CardDescription>
                          <CardTitle className="text-sm">{pair.difference_summary}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg border p-3 text-xs leading-5 text-muted-foreground">
                              <p className="text-[10px] uppercase tracking-wider text-foreground">Left</p>
                              <p className="mt-2">{pair.left.text}</p>
                            </div>
                            <div className="rounded-lg border p-3 text-xs leading-5 text-muted-foreground">
                              <p className="text-[10px] uppercase tracking-wider text-foreground">Right</p>
                              <p className="mt-2">{pair.right.text}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
