import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data: document } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (!document?.storage_path) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("project-documents")
    .createSignedUrl(document.storage_path, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Could not open document" }, { status: 403 });
  }

  return NextResponse.redirect(data.signedUrl);
}
