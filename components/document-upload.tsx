"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  projectId: string;
};

function safeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function DocumentUpload({ projectId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setMessage("Choose a file first.");
      setBusy(false);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setMessage("File is over the 50 MB limit.");
      setBusy(false);
      return;
    }

    const title = String(form.get("title") || file.name).trim();
    const documentType = String(form.get("document_type") || "other");
    const acknowledgementRequired =
      form.get("acknowledgement_required") === "on";

    const { data: previous } = await supabase
      .from("documents")
      .select("version")
      .eq("project_id", projectId)
      .eq("document_type", documentType)
      .eq("title", title || file.name)
      .order("version", { ascending: false })
      .limit(1);

    const version = (previous?.[0]?.version ?? 0) + 1;
    const path = `${projectId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

    const upload = await supabase.storage
      .from("project-documents")
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (upload.error) {
      setMessage(upload.error.message);
      setBusy(false);
      return;
    }

    const insert = await supabase.from("documents").insert({
      project_id: projectId,
      document_type: documentType,
      title: title || file.name,
      version,
      status: "draft",
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      acknowledgement_required: acknowledgementRequired,
    });

    if (insert.error) {
      await supabase.storage.from("project-documents").remove([path]);
      setMessage(insert.error.message);
      setBusy(false);
      return;
    }

    event.currentTarget.reset();
    setMessage("Uploaded.");
    setBusy(false);
    router.refresh();
  }

  return (
    <form className="compact-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Document title</span>
        <input name="title" placeholder="e.g. Approved RAMS" />
      </label>

      <label className="field">
        <span>Type</span>
        <select name="document_type" defaultValue="other">
          <option value="rams">RAMS</option>
          <option value="cpp">Construction phase plan</option>
          <option value="coshh">COSHH</option>
          <option value="tds">TDS</option>
          <option value="sds">SDS</option>
          <option value="qa">QA</option>
          <option value="drawing">Drawing</option>
          <option value="photo">Photo / evidence</option>
          <option value="handover">Handover</option>
          <option value="other">Other</option>
        </select>
      </label>

      <label className="field">
        <span>File</span>
        <input name="file" type="file" required />
      </label>

      <label className="check-row">
        <input name="acknowledgement_required" type="checkbox" />
        <span>Crew acknowledgement required</span>
      </label>

      {message ? <p className="upload-message">{message}</p> : null}

      <button className="primary-button full-button" type="submit" disabled={busy}>
        {busy ? "Uploading…" : "Upload document"}
      </button>
    </form>
  );
}
