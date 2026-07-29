import type { Clause, Severity } from "./apiClient";

export interface RecentDocument {
  docId: string;
  filename: string;
  uploadedAt: string;
  severitySummary: Record<Severity, number>;
}

const STORAGE_KEY = "clauseguard.recentDocuments";

export function summarizeSeverity(flags: Clause[]): Record<Severity, number> {
  return flags.reduce(
    (summary, clause) => {
      summary[clause.severity] += 1;
      return summary;
    },
    { high: 0, medium: 0, low: 0 },
  );
}

export function getRecentDocuments(): RecentDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is RecentDocument =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as RecentDocument).docId === "string" &&
            typeof (item as RecentDocument).filename === "string",
        ),
    );
  } catch {
    return [];
  }
}

export function saveRecentDocument(document: RecentDocument): void {
  const existing = getRecentDocuments().filter((item) => item.docId !== document.docId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([document, ...existing].slice(0, 12)));
}

export function findRecentDocument(docId: string): RecentDocument | undefined {
  return getRecentDocuments().find((item) => item.docId === docId);
}
