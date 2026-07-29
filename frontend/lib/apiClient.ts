export type Severity = "high" | "medium" | "low";
export type ObligationStatus = "unconfirmed" | "confirmed" | "completed" | "dismissed";

export interface Clause {
  chunk_id: string;
  text: string;
  page: number | string;
  heading?: string | null;
  category?: string | null;
  severity: Severity;
  confidence?: number | null;
  explanation?: string | null;
}

export interface ReviewPriority {
  title: string;
  rationale: string;
  action: string;
  severity: Severity;
  category?: string | null;
  source_chunk_ids: string[];
}

export interface NegotiationItem {
  category: string;
  severity: Severity;
  primary_ask: string;
  fallback: string;
  rationale: string;
  suggested_language: string;
  source_chunk_ids: string[];
}

export interface Obligation {
  id?: number;
  doc_id?: string;
  party?: string | null;
  action: string;
  trigger?: string | null;
  deadline?: string | null;
  period?: string | null;
  recurrence?: string | null;
  consequence?: string | null;
  confidence?: number | null;
  status: ObligationStatus;
  source_chunk_ids: string[];
}

export interface Report {
  doc_id: string;
  flags: Clause[];
  executive_summary?: string;
  overall_risk?: Severity;
  review_priorities?: ReviewPriority[];
  obligations?: Obligation[];
  negotiation_playbook?: NegotiationItem[];
  suggested_questions?: string[];
  analyzed_at?: string | null;
  model?: string | null;
  disclaimer?: string;
}

export interface Citation {
  chunk_id: string;
  page: number | string;
}

export interface AskResponse {
  status: "answered" | "not_found" | "needs_clarification";
  answer_type:
    | "document_summary"
    | "risk_analysis"
    | "grounded_answer"
    | "clarification"
    | "capability";
  answer: string;
  citations: Citation[];
  message_id?: number | null;
  follow_ups?: string[];
}

export interface ChatMessage {
  id: number;
  doc_id: string;
  role: "user" | "assistant" | "system" | string;
  content: string;
  citations: Citation[];
  created_at?: string | null;
}

export interface DocumentSummary {
  doc_id: string;
  filename: string;
  content_type?: string | null;
  status: string;
  error?: string | null;
  section_count: number;
  chunk_count: number;
  flag_count: number;
  overall_risk?: string | null;
  severity_summary: Record<Severity, number>;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ComparedClause {
  doc_id: string;
  chunk_id: string;
  page: number | string;
  category?: string | null;
  severity?: Severity | null;
  text: string;
  heading?: string | null;
}

export interface ComparisonPair {
  category: string;
  similarity: number;
  left: ComparedClause;
  right: ComparedClause;
  difference_summary: string;
}

export interface ComparisonResult {
  doc_ids: string[];
  pairs: ComparisonPair[];
  summary: string;
  disclaimer?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001").replace(
  /\/$/,
  "",
);

function errorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (payload && typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: unknown }).msg);
          }
          return "";
        })
        .filter(Boolean);
      if (messages.length) return messages.join(", ");
    }
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    throw new ApiError(
      errorMessage(payload, `Request failed with status ${response.status}.`),
      response.status,
      payload,
    );
  }
  return payload as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${path}`, init);
    return await parseResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : "Unable to reach the ClauseGuard API.",
    );
  }
}

export function uploadDocument(
  file: File,
  onProgress: (percent: number) => void,
): Promise<Report> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/upload`);
    xhr.responseType = "text";
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    });
    xhr.addEventListener("error", () =>
      reject(new ApiError("Unable to reach the ClauseGuard API.")),
    );
    xhr.addEventListener("abort", () => reject(new ApiError("Upload was cancelled.")));
    xhr.addEventListener("load", () => {
      let payload: unknown = xhr.responseText;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        // Preserve non-JSON error bodies for a useful fallback message.
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new ApiError(
            errorMessage(payload, `Upload failed with status ${xhr.status}.`),
            xhr.status,
            payload,
          ),
        );
        return;
      }
      onProgress(100);
      resolve(payload as Report);
    });
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export function getReport(docId: string): Promise<Report> {
  return request<Report>(`/report/${encodeURIComponent(docId)}`);
}

export function listDocuments(): Promise<DocumentSummary[]> {
  return request<DocumentSummary[]>("/documents");
}

export function getChatHistory(docId: string): Promise<ChatMessage[]> {
  return request<ChatMessage[]>(`/chat/${encodeURIComponent(docId)}`);
}

export function askQuestion(docId: string, question: string): Promise<AskResponse> {
  return request<AskResponse>("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_id: docId, question }),
  });
}

export function updateObligation(
  obligationId: number,
  status: ObligationStatus,
): Promise<Obligation> {
  return request<Obligation>(`/obligations/${obligationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function compareDocuments(
  docIds: string[],
  categories?: string[],
): Promise<ComparisonResult> {
  return request<ComparisonResult>("/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_ids: docIds, categories }),
  });
}

export function exportReportUrl(docId: string, format: "pdf" | "docx" = "pdf"): string {
  return `${API_URL}/export/${encodeURIComponent(docId)}?format=${format}`;
}

export function getApiErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.";
}
