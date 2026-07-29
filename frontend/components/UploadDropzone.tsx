"use client";

import { useRef, useState } from "react";
import { ShineBorder } from "@/components/ui/shine-border";

interface UploadDropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  error?: string | null;
}

const allowedTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function validateDocument(file: File): string | null {
  const extension = file.name.toLowerCase().split(".").pop();
  if (!allowedTypes.includes(file.type) && !["pdf", "docx"].includes(extension || "")) {
    return "Choose a PDF or DOCX file. Other formats are not supported here.";
  }
  if (file.size === 0) return "This file is empty. Choose a document with content.";
  return null;
}

export function UploadDropzone({ onFile, disabled, error }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div>
      <div
        className={`relative overflow-hidden rounded-xl border border-dashed p-8 text-center transition-all sm:p-11 ${
          dragging
            ? "border-violet-400 bg-violet-500/[0.08]"
            : "border-white/[0.13] bg-[#151517] hover:border-white/25 hover:bg-[#18181b]"
        } ${disabled ? "pointer-events-none opacity-55" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) onFile(file);
        }}
      >
        <ShineBorder
          borderWidth={1}
          duration={10}
          shineColor={["#7c3aed", "#a78bfa", "#4f46e5"]}
        />
        <input
          id="contract-upload"
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.currentTarget.value = "";
          }}
          aria-label="Choose a PDF or DOCX contract"
        />
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-[#202024] text-zinc-300">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm font-medium text-zinc-100">Drop your contract here</p>
        <p className="mt-2 text-xs leading-5 text-zinc-500">PDF or DOCX · processed securely for review</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          Upload document
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
