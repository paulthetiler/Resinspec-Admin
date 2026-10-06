"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  projectId: string;
  qaRecordId: string;
  gateOrder: number;
  gateLabel: string;
  disabled?: boolean;
};

function safeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function QaEvidenceUpload({
  projectId,
  qaRecordId,
  gateOrder,
  gateLabel,
  disabled = false,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;

    setBusy(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const files = form
      .getAll("photos")
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (files.length === 0) {
      setMessage("Choose at least one photo.");
      setBusy(false);
      return;
    }

    const invalid = files.find((file) => !file.type.startsWith("image/"));
    if (invalid) {
      setMessage("QA evidence must be an image.");
      setBusy(false);
      return;
    }

    const oversized = files.find((file) => file.size > 15 * 1024 * 1024);
    if (oversized) {
      setMessage(`${oversized.name} is over the 15 MB photo limit.`);
      setBusy(false);
      return;
    }

    let uploaded = 0;

    for (const file of files) {
      const storagePath = `${projectId}/qa/${qaRecordId}/${crypto.randomUUID()}-${safeFileName(
        file.name
      )}`;

      const upload = await supabase.storage
        .from("project-documents")
        .upload(storagePath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

      if (upload.error) {
        setMessage(
          uploaded > 0
            ? `${uploaded} photo(s) uploaded, then upload stopped: ${upload.error.message}`
            : upload.error.message
        );
        setBusy(false);
        router.refresh();
        return;
      }

      const insert = await supabase.from("documents").insert({
        project_id: projectId,
        qa_record_id: qaRecordId,
        document_type: "photo",
        title: `Gate ${String(gateOrder).padStart(2, "0")} · ${gateLabel}`,
        version: 1,
        status: "complete",
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type || null,
        file_size_bytes: file.size,
        acknowledgement_required: false,
      });

      if (insert.error) {
        await supabase.storage.from("project-documents").remove([storagePath]);
        setMessage(insert.error.message);
        setBusy(false);
        router.refresh();
        return;
      }

      uploaded += 1;
    }

    event.currentTarget.reset();
    setMessage(`${uploaded} photo${uploaded === 1 ? "" : "s"} added to this gate.`);
    setBusy(false);
    router.refresh();
  }

  return (
    <form className="qa-photo-upload" onSubmit={handleSubmit}>
      <label>
        <span>Add gate photos</span>
        <input
          name="photos"
          type="file"
          accept="image/*"
          multiple
          required
          disabled={busy || disabled}
        />
      </label>

      <button
        className="secondary-button"
        type="submit"
        disabled={busy || disabled}
      >
        {busy ? "Uploading…" : "Upload evidence"}
      </button>

      {message ? <small className="qa-photo-message">{message}</small> : null}
    </form>
  );
}
