"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  projectId: string;
  surveyId: string;
};

function safeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function SurveyEvidenceUpload({ projectId, surveyId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      setMessage("Survey evidence must be an image.");
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
      const storagePath = `${projectId}/survey/${surveyId}/${crypto.randomUUID()}-${safeFileName(
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
        survey_id: surveyId,
        document_type: "photo",
        title: "Technical survey evidence",
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
    setMessage(`${uploaded} survey photo${uploaded === 1 ? "" : "s"} added.`);
    setBusy(false);
    router.refresh();
  }

  return (
    <form className="survey-photo-upload" onSubmit={handleSubmit}>
      <label className="field">
        <span>Survey photos</span>
        <input
          name="photos"
          type="file"
          accept="image/*"
          multiple
          required
          disabled={busy}
        />
      </label>

      {message ? <p className="upload-message">{message}</p> : null}

      <button className="secondary-button full-button" type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Add survey evidence"}
      </button>
    </form>
  );
}
