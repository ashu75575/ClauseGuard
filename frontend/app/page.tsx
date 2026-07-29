"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header, type LandingSection } from "@/components/Header";
import { SeverityBadge } from "@/components/SeverityBadge";
import { UploadDropzone, validateDocument } from "@/components/UploadDropzone";
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

const LiquidEther = dynamic(() => import("@/components/LiquidEther"), { ssr: false });
const LIQUID_COLORS = ["#7c3aed", "#4f46e5", "#a78bfa"];
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

  useEffect(() => {
    if (!activeSection) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveSection(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeSection]);

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
    <div className="pixel-grid relative h-svh overflow-hidden bg-[#0d0d0f]">
      <Header onSectionSelect={setActiveSection} />
      <div
        className="pointer-events-none absolute inset-x-0 top-16 h-[760px] opacity-[0.4] [mask-image:linear-gradient(to_bottom,black_5%,black_68%,transparent_100%)] motion-reduce:hidden"
        aria-hidden="true"
      >
        <LiquidEther
          colors={LIQUID_COLORS}
          mouseForce={24}
          cursorSize={105}
          resolution={0.35}
          iterationsPoisson={24}
          autoDemo
          autoSpeed={0.35}
          autoIntensity={1.7}
          autoResumeDelay={2600}
        />
      </div>

      <main className="relative z-10 mx-auto h-[calc(100svh-4rem)] max-w-7xl overflow-hidden px-5 sm:px-8">
        <section className="grid h-full items-center gap-6 py-4 sm:py-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:py-8">
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 border border-violet-400/25 bg-violet-400/[0.07] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">
              <span className="h-2 w-2 bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,.8)]" />
              Contract intelligence protocol
            </div>
            <h1 className="mt-5 max-w-3xl text-balance text-4xl font-black uppercase leading-[0.95] tracking-[-0.065em] text-white sm:mt-7 sm:text-5xl lg:text-6xl xl:text-7xl">
              Read the fine print.
              <span className="mt-2 block bg-gradient-to-r from-violet-300 via-fuchsia-200 to-indigo-300 bg-clip-text text-transparent">
                Before it costs you.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-sm leading-6 text-zinc-400 sm:mt-7 sm:text-base sm:leading-7 xl:text-lg">
              ClauseGuard turns dense contracts into a clear, cited risk report—so you can spot hidden obligations, negotiate confidently, and sign with context.
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
              <button
                type="button"
                onClick={() => document.getElementById("hero-contract-upload")?.click()}
                className="inline-flex items-center gap-3 border border-violet-300/30 bg-violet-600 px-5 py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-[4px_4px_0_#312e81] transition hover:-translate-y-0.5 hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                Analyze a contract <span aria-hidden="true">→</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection("how-it-works")}
                className="border-b border-zinc-600 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 hover:border-zinc-300 hover:text-white"
              >
                See how it works
              </button>
            </div>

            <div className="mt-5 lg:hidden" aria-live="polite">
              {isUploading && (
                <div className="border border-violet-400/20 bg-violet-400/[0.07] p-3">
                  <div className="flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-wider">
                    <span className="truncate text-zinc-300">
                      {progress < 100 ? "Uploading" : "Analyzing"} {"//"} {lastFile?.name}
                    </span>
                    <span className="shrink-0 text-violet-300">{progress}%</span>
                  </div>
                  <div className="mt-2 h-1 bg-white/[0.07]">
                    <div className="h-full bg-violet-500 transition-[width]" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
              {(fileError || uploadError) && (
                <p className="border border-rose-400/20 bg-rose-400/[0.07] p-3 text-xs text-rose-200" role="alert">
                  {fileError || uploadError}
                </p>
              )}
            </div>

            <div className="mt-10 hidden max-w-xl grid-cols-3 border-y border-white/[0.08] bg-black/10 lg:grid">
              {[
                ["12", "Risk categories"],
                ["03", "Severity levels"],
                ["LIVE", "Clause citations"],
              ].map(([value, label], index) => (
                <div
                  key={label}
                  className={`py-4 ${index > 0 ? "border-l border-white/[0.08] pl-5" : ""}`}
                >
                  <p className="font-mono text-lg font-bold text-zinc-100">{value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-600">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            id="upload"
            className="hidden lg:block"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
          >
            <div className="border border-white/[0.1] bg-[#111113]/95 p-2 shadow-[10px_10px_0_rgba(49,46,129,.22),0_30px_80px_rgba(0,0,0,.45)] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 bg-rose-400/70" />
                  <span className="h-2 w-2 bg-amber-300/70" />
                  <span className="h-2 w-2 bg-emerald-300/70" />
                </div>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-600">
                  secure_scan.exe
                </span>
                <span className="font-mono text-[9px] text-emerald-400">READY</span>
              </div>
              <div className="p-2">
                {isUploading ? (
                  <div className="flex min-h-72 flex-col items-center justify-center border border-white/[0.07] bg-[#151517] px-6 text-center" aria-live="polite">
                    <div className="relative grid h-14 w-14 place-items-center border border-violet-400/20 bg-violet-500/10 text-violet-300">
                      <span className="absolute inset-0 animate-ping border border-violet-400/20" />
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                        <path d="M7 3.5h7l3 3V20H7zM14 3.5V7h3" stroke="currentColor" strokeWidth="1.7" />
                      </svg>
                    </div>
                    <p className="mt-5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-100">
                      {progress < 100 ? "Uploading document" : "Analyzing clauses"}
                    </p>
                    <p className="mt-2 max-w-sm truncate text-xs text-zinc-500">{lastFile?.name}</p>
                    <div className="mt-5 h-2 w-full max-w-sm overflow-hidden bg-white/[0.06]">
                      <div
                        className={`h-full bg-gradient-to-r from-violet-600 to-indigo-400 transition-[width] duration-300 ${progress === 100 ? "animate-pulse" : ""}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-2 font-mono text-[10px] tabular-nums text-zinc-600">
                      {progress < 100 ? `${progress}% uploaded` : "Upload complete // review in progress"}
                    </p>
                  </div>
                ) : (
                  <UploadDropzone onFile={(file) => void startUpload(file)} error={fileError} />
                )}
              </div>
            </div>

            {uploadError && (
              <div className="mt-4 flex items-center justify-between gap-4 border border-rose-400/15 bg-rose-400/[0.06] px-4 py-3" role="alert">
                <p className="text-sm text-rose-200">{uploadError}</p>
                {lastFile && (
                  <button
                    type="button"
                    onClick={() => void startUpload(lastFile)}
                    className="shrink-0 border border-rose-300/20 px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-rose-100 transition hover:bg-rose-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 font-mono text-[9px] uppercase tracking-wider text-zinc-600">
              <span>Direct API transfer</span>
              <span className="text-violet-500">◆</span>
              <span>PDF + DOCX</span>
              <span className="text-violet-500">◆</span>
              <span>Cited analysis</span>
            </div>
          </motion.div>
        </section>

      </main>

      <AnimatePresence>
        {activeSection && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center p-4 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="landing-modal-title"
          >
            <motion.button
              type="button"
              aria-label="Close section"
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
              onClick={() => setActiveSection(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.section
              className="relative z-10 max-h-[86svh] w-full max-w-5xl overflow-y-auto border border-violet-300/20 bg-[#111113] shadow-[12px_12px_0_rgba(49,46,129,.28),0_30px_100px_rgba(0,0,0,.65)]"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.985 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.08] bg-[#111113]/95 px-5 py-4 backdrop-blur-xl sm:px-7">
                <div>
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-violet-400">
                    Section // {activeSection === "how-it-works" ? "01" : activeSection === "capabilities" ? "02" : "03"}
                  </p>
                  <h2 id="landing-modal-title" className="mt-1 font-mono text-sm font-bold uppercase tracking-[0.12em] text-white">
                    {activeSection === "how-it-works"
                      ? "How it works"
                      : activeSection === "capabilities"
                        ? "Capabilities"
                        : "Recent documents"}
                  </h2>
                </div>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setActiveSection(null)}
                  className="grid h-9 w-9 place-items-center border border-white/[0.12] bg-white/[0.04] font-mono text-sm text-zinc-400 hover:border-violet-400/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </header>

              <div className="p-5 sm:p-8">
                {activeSection === "how-it-works" && (
                  <>
                    <h3 className="text-3xl font-black uppercase tracking-[-0.04em] text-white sm:text-4xl">From upload to leverage.</h3>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
                      A focused review flow built for people who need answers, not another wall of legal text.
                    </p>
                    <div className="mt-8 grid gap-px bg-white/[0.08] md:grid-cols-3">
                      {WORKFLOW.map((item) => (
                        <article key={item.step} className="bg-[#171719] p-6">
                          <span className="font-mono text-3xl font-black text-violet-400">{item.step}</span>
                          <h4 className="mt-7 font-mono text-xs font-bold uppercase tracking-[0.12em] text-zinc-100">{item.title}</h4>
                          <p className="mt-3 text-sm leading-6 text-zinc-500">{item.description}</p>
                        </article>
                      ))}
                    </div>
                  </>
                )}

                {activeSection === "capabilities" && (
                  <>
                    <h3 className="max-w-2xl text-3xl font-black uppercase tracking-[-0.04em] text-white sm:text-4xl">
                      Find the clauses that change the deal.
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
                      Every flag includes severity, category, page reference, original language, and a practical explanation.
                    </p>
                    <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {CAPABILITIES.map((capability, index) => (
                        <div key={capability} className="border border-white/[0.08] bg-[#171719] px-4 py-5">
                          <span className="font-mono text-[9px] text-violet-500">0{index + 1}</span>
                          <p className="mt-2 text-xs font-medium text-zinc-300">{capability}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {activeSection === "documents" && (
                  <>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h3 className="text-3xl font-black uppercase tracking-[-0.04em] text-white">Document library.</h3>
                        <p className="mt-3 text-xs leading-5 text-zinc-600">
                          Persistent backend archive with optional local fallback metadata.
                        </p>
                      </div>
                      <button
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
                        className="border-2 border-violet-300/30 bg-violet-600 px-4 py-2.5 font-mono text-[10px] font-black uppercase tracking-wider text-white shadow-[4px_4px_0_#312e81] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {comparing ? "Comparing…" : `Compare selected (${selectedCompare.length})`}
                      </button>
                    </div>

                    {libraryError && (
                      <p className="mt-4 border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-100">
                        Library API unavailable: {libraryError}. Showing local fallback.
                      </p>
                    )}

                    {(libraryDocs.length === 0 && recentDocuments.length === 0) ? (
                      <div className="mt-8 border border-dashed border-white/[0.1] bg-[#171719] px-6 py-12 text-center">
                        <p className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">No documents yet</p>
                        <p className="mt-2 text-xs text-zinc-600">Upload a contract to populate the library.</p>
                      </div>
                    ) : (
                      <div className="mt-8 grid gap-3">
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
                            <div
                              key={document.docId}
                              className="flex flex-col gap-4 border border-white/[0.07] bg-[#171719] p-4 sm:flex-row sm:items-center"
                            >
                              <label className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => {
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
                                className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                              >
                                <span className="block truncate text-sm font-medium text-zinc-200">{document.filename}</span>
                                <span className="mt-1 block text-xs text-zinc-600">
                                  Uploaded {new Date(document.uploadedAt).toLocaleString()}
                                  {document.risk ? ` · risk ${document.risk}` : ""}
                                </span>
                              </Link>
                              <span className="flex flex-wrap gap-2">
                                <SeverityBadge severity="high" count={document.severitySummary.high} />
                                <SeverityBadge severity="medium" count={document.severitySummary.medium} />
                                <SeverityBadge severity="low" count={document.severitySummary.low} />
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {compareError && (
                      <p className="mt-4 border border-rose-400/20 bg-rose-400/[0.07] px-3 py-2 text-xs text-rose-200">
                        {compareError}
                      </p>
                    )}

                    {comparison && (
                      <div className="mt-8 border-2 border-white/[0.12] bg-[#141416] p-5">
                        <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-violet-400">
                          Comparison result
                        </p>
                        <p className="mt-3 text-sm leading-6 text-zinc-300">{comparison.summary}</p>
                        <div className="mt-4 space-y-3">
                          {comparison.pairs.map((pair, index) => (
                            <article key={`${pair.left.chunk_id}-${pair.right.chunk_id}-${index}`} className="border border-white/[0.08] bg-[#1a1a1d] p-4">
                              <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                                {pair.category.replaceAll("_", " ")} · similarity {(pair.similarity * 100).toFixed(0)}%
                              </p>
                              <p className="mt-2 text-sm text-zinc-200">{pair.difference_summary}</p>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div className="border border-white/[0.08] p-3 text-xs leading-5 text-zinc-400">
                                  <p className="font-mono text-[8px] uppercase text-violet-400">Left</p>
                                  <p className="mt-2">{pair.left.text}</p>
                                </div>
                                <div className="border border-white/[0.08] p-3 text-xs leading-5 text-zinc-400">
                                  <p className="font-mono text-[8px] uppercase text-violet-400">Right</p>
                                  <p className="mt-2">{pair.right.text}</p>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
