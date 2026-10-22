"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_BUCKET = "phase2-uploads";

export type FileKind =
  | "pitch-deck"
  | "bills"
  | "passbook"
  | "pan"
  | "phase1-ppt";

const KIND_CONFIG: Record<
  FileKind,
  { accept: string; extensions: string[]; maxMB: number; mime: string[] }
> = {
  "pitch-deck": {
    accept: ".pdf,.pptx",
    extensions: ["pdf", "pptx"],
    maxMB: 25,
    mime: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  },
  bills: {
    accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png",
    extensions: ["pdf", "doc", "docx", "jpg", "jpeg", "png"],
    maxMB: 20,
    mime: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ],
  },
  passbook: {
    accept: ".pdf,.jpg,.jpeg,.png",
    extensions: ["pdf", "jpg", "jpeg", "png"],
    maxMB: 10,
    mime: ["application/pdf", "image/jpeg", "image/png"],
  },
  pan: {
    accept: ".pdf,.jpg,.jpeg,.png",
    extensions: ["pdf", "jpg", "jpeg", "png"],
    maxMB: 10,
    mime: ["application/pdf", "image/jpeg", "image/png"],
  },
  // PDF-only — this is the pre-selection screening upload for all ~550
  // Phase 1 registrants, so the size cap is kept tight to bound the
  // aggregate storage footprint (worst case 550 x 5MB = 2.75GB).
  "phase1-ppt": {
    accept: ".pdf",
    extensions: ["pdf"],
    maxMB: 5,
    mime: ["application/pdf"],
  },
};

function extOf(filename: string) {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

function fileLabel(path: string | null) {
  if (!path) return null;
  const name = path.split("/").pop() ?? path;
  // strip our internal "{kind}." prefix so participants see a clean name
  return name.replace(/^[a-z0-9-]+\./, (m) => m); // keep as-is, storage name is already reasonable
}

export function FileUploadField({
  teamId,
  kind,
  label,
  helpText,
  required = false,
  currentPath,
  onSaved,
  bucket = DEFAULT_BUCKET,
}: {
  teamId: string;
  kind: FileKind;
  label: string;
  helpText?: string;
  required?: boolean;
  currentPath: string | null;
  onSaved: (path: string) => void;
  bucket?: string;
}) {
  const [path, setPath] = useState(currentPath);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const config = KIND_CONFIG[kind];

  async function handleFile(file: File) {
    setError(null);

    const ext = extOf(file.name);
    if (!config.extensions.includes(ext)) {
      setError(`Only ${config.extensions.map((e) => `.${e}`).join(" / ")} files are accepted.`);
      setStatus("error");
      return;
    }
    if (file.size > config.maxMB * 1024 * 1024) {
      setError(`File is too large — max ${config.maxMB}MB. Yours is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
      setStatus("error");
      return;
    }

    setStatus("uploading");
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectPath = `${teamId}/${kind}-${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(objectPath, file, { upsert: true, contentType: file.type || undefined });

      if (uploadErr) {
        throw uploadErr;
      }

      setPath(objectPath);
      onSaved(objectPath);
      setStatus("idle");
    } catch (err) {
      console.error(`Phase 2 upload failed (${kind}):`, err);
      setError(
        err instanceof Error && /size|too large/i.test(err.message)
          ? `File is too large for the server — max ${config.maxMB}MB.`
          : "Upload failed. Check your connection and try again — if it keeps failing, contact the i2i team."
      );
      setStatus("error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function view() {
    if (!path) return;
    setViewing(true);
    try {
      const supabase = createClient();
      const { data, error: signErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 300); // 5 minutes
      if (signErr || !data?.signedUrl) throw signErr ?? new Error("No signed URL returned");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(`Could not open file (${kind}):`, err);
      setError("Could not open this file right now. Try again in a moment.");
    } finally {
      setViewing(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            {label} {required && <span className="text-marigold">*</span>}
          </p>
          {helpText && <p className="mt-0.5 text-xs text-muted">{helpText}</p>}
          <p className="mt-0.5 text-[11px] text-muted">
            Accepted: {config.accept} · Max {config.maxMB}MB
          </p>
        </div>
        {path && status !== "uploading" && (
          <span className="whitespace-nowrap rounded-full border border-marigold/40 bg-marigold/10 px-2.5 py-1 text-[11px] font-medium text-marigold">
            ✓ Uploaded
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={config.accept}
          className="hidden"
          id={`upload-${kind}-${teamId}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <label
          htmlFor={`upload-${kind}-${teamId}`}
          className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold transition ${
            status === "uploading"
              ? "cursor-not-allowed bg-line text-muted"
              : "bg-marigold text-ink hover:opacity-90"
          }`}
          aria-disabled={status === "uploading"}
          onClick={(e) => status === "uploading" && e.preventDefault()}
        >
          {status === "uploading" ? "Uploading..." : path ? "Replace file" : "Choose file"}
        </label>

        {path && (
          <button
            type="button"
            onClick={view}
            disabled={viewing}
            className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink-light hover:border-marigold hover:text-marigold disabled:opacity-60"
          >
            {viewing ? "Opening..." : "View"}
          </button>
        )}

        {path && (
          <span className="text-xs text-muted">{fileLabel(path)}</span>
        )}
      </div>

      {error && <p className="mt-2 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}
