"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "lucide-react";
import { ShineBorder } from "@/components/ui/shine-border";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        className={cn(
          "relative overflow-hidden rounded-xl border border-dashed p-8 text-center transition-all sm:p-11",
          dragging ? "border-primary bg-primary/5" : "border-border bg-muted/40 hover:bg-muted/70",
          disabled && "pointer-events-none opacity-55",
        )}
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
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-xl border bg-background text-muted-foreground">
          <UploadIcon className="size-5" />
        </div>
        <p className="text-sm font-medium">Drop your contract here</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          PDF or DOCX · processed securely for review
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-5"
          onClick={() => inputRef.current?.click()}
        >
          Browse files
        </Button>
      </div>
      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
