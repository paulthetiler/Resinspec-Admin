import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { PrintButton } from "@/components/print-button";

type QuotePrintProps = {
  params: Promise<{ id: string }>;
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value ?? 0));
}

export default async function QuotePrintPage({ params }: QuotePrintProps) {
  const { id } = await params;
  const { supabase } = await requireAnyPermission(["quote:view"]);

  const [{ data: project }, { data: quote }] = await Promise.all([
    supabase
      .from("projects")
      .select("reference,title")
      .eq("id", id)
      .single(),
    supabase
      .from("quotes")
      .select("*")
      .eq("project_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!project || !quote) notFound();

  const vatAmount =
    Number(quote.net_price) * (Number(quote.vat_rate) / 100);
  const total = Number(quote.net_price) + vatAmount;

  return (
    <main className="quote-print">
      <div className="quote-print-actions">
        <PrintButton />
      </div>

      <header className="quote-print-head">
        <div>
          <p className="eyebrow">ResinSpec Flooring</p>
          <h1>{quote.title}</h1>
          <p>
            {project.reference} · Quote revision {quote.version}
          </p>
        </div>
        <div className="quote-brand-block">
          <strong>ResinSpec</strong>
          <span>FLOORING</span>
        </div>
      </header>

      <section className="quote-client">
        <div>
          <span>Prepared for</span>
          <strong>{quote.client_name_snapshot || "Client"}</strong>
          <p>{quote.contact_email_snapshot || ""}</p>
        </div>
        <div>
          <span>Status</span>
          <strong>{quote.status.replace("_", " ")}</strong>
          <p>
            {quote.valid_until ? "Valid until " + quote.valid_until : ""}
          </p>
        </div>
      </section>

      <section className="quote-section">
        <h2>Scope</h2>
        <p>{quote.scope || "Scope to be confirmed."}</p>
      </section>

      {quote.exclusions ? (
        <section className="quote-section">
          <h2>Exclusions</h2>
          <p>{quote.exclusions}</p>
        </section>
      ) : null}

      {quote.assumptions ? (
        <section className="quote-section">
          <h2>Assumptions</h2>
          <p>{quote.assumptions}</p>
        </section>
      ) : null}

      <section className="quote-price">
        <div>
          <span>Net</span>
          <strong>{money(quote.net_price)}</strong>
        </div>
        <div>
          <span>VAT ({quote.vat_rate}%)</span>
          <strong>{money(vatAmount)}</strong>
        </div>
        <div className="quote-price-total">
          <span>Total</span>
          <strong>{money(total)}</strong>
        </div>
      </section>

      <div className="two-column quote-terms-grid">
        <section className="quote-section">
          <h2>Payment terms</h2>
          <p>{quote.payment_terms || "To be agreed."}</p>
        </section>
        <section className="quote-section">
          <h2>Programme</h2>
          <p>{quote.programme_notes || "To be agreed."}</p>
        </section>
      </div>

      {quote.client_notes ? (
        <section className="quote-section">
          <h2>Notes</h2>
          <p>{quote.client_notes}</p>
        </section>
      ) : null}

      <footer className="quote-footer">
        <strong>ResinSpec Flooring</strong>
        <span>Survey · Specify · Prepare · Install · Document · Hand-back</span>
      </footer>
    </main>
  );
}
