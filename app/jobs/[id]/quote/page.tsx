import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import {
  createQuote,
  createQuoteRevision,
  saveQuote,
  setQuoteStatus,
} from "./actions";

type QuotePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export default async function QuotePage({
  params,
  searchParams,
}: QuotePageProps) {
  const { id } = await params;
  const messages = await searchParams;
  const { supabase } = await requireAnyPermission(["quote:view"]);

  const [{ data: project }, { data: quotes }] = await Promise.all([
    supabase
      .from("projects")
      .select("id,reference,title,status")
      .eq("id", id)
      .single(),
    supabase
      .from("quotes")
      .select("*")
      .eq("project_id", id)
      .order("version", { ascending: false }),
  ]);

  if (!project) notFound();

  const quote = quotes?.[0] ?? null;
  const editable = quote?.status === "draft";
  const vatAmount = quote
    ? Number(quote.net_price) * (Number(quote.vat_rate) / 100)
    : 0;
  const total = quote ? Number(quote.net_price) + vatAmount : 0;

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · client quote</p>
          <h1>{project.title}</h1>
          <p>
            Customer-facing scope, price and terms are kept separate from the
            internal estimator cost stack.
          </p>
        </div>
        <div className="heading-actions">
          {quote ? (
            <Link
              className="secondary-button"
              href={"/jobs/" + id + "/quote/print"}
              target="_blank"
            >
              Print view
            </Link>
          ) : null}
          <Link className="secondary-button" href={"/jobs/" + id}>
            Job
          </Link>
        </div>
      </section>

      {messages.error ? (
        <p className="form-error page-error">{messages.error}</p>
      ) : null}
      {messages.saved ? (
        <p className="form-success page-error">Quote saved.</p>
      ) : null}

      {!quote ? (
        <section className="panel">
          <div className="empty-state">
            <strong>No quote revision yet.</strong>
            <p>
              Commercial users can seed the price from the latest estimate.
              Office users can create and maintain the client-facing record
              without seeing internal margin.
            </p>
            <form action={createQuote}>
              <input type="hidden" name="project_id" value={id} />
              <button className="primary-button" type="submit">
                Create quote
              </button>
            </form>
          </div>
        </section>
      ) : (
        <>
          <section className="estimate-toolbar">
            <span className="status-badge">
              {quote.status.replace("_", " ")}
            </span>
            <span>Revision {quote.version}</span>
            <span>{quote.client_name_snapshot || "Client not set"}</span>

            <div className="heading-actions">
              {editable ? (
                <form action={setQuoteStatus}>
                  <input type="hidden" name="project_id" value={id} />
                  <input type="hidden" name="quote_id" value={quote.id} />
                  <input type="hidden" name="status" value="issued" />
                  <button className="text-button" type="submit">
                    Mark issued
                  </button>
                </form>
              ) : null}

              {quote.status === "issued" ? (
                <>
                  <form action={setQuoteStatus} className="inline-actions">
                    <input type="hidden" name="project_id" value={id} />
                    <input type="hidden" name="quote_id" value={quote.id} />
                    <input type="hidden" name="status" value="accepted" />
                    <input
                      className="mini-input"
                      name="accepted_by_name"
                      placeholder="Accepted by"
                    />
                    <button className="text-button" type="submit">
                      Accept
                    </button>
                  </form>
                  <form action={setQuoteStatus}>
                    <input type="hidden" name="project_id" value={id} />
                    <input type="hidden" name="quote_id" value={quote.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button className="text-button danger-text" type="submit">
                      Reject
                    </button>
                  </form>
                </>
              ) : null}

              {!editable ? (
                <form action={createQuoteRevision}>
                  <input type="hidden" name="project_id" value={id} />
                  <input type="hidden" name="quote_id" value={quote.id} />
                  <button className="text-button" type="submit">
                    New revision
                  </button>
                </form>
              ) : null}
            </div>
          </section>

          <section className="detail-grid">
            <article className="detail-card">
              <span>Net</span>
              <strong>{money(quote.net_price)}</strong>
            </article>
            <article className="detail-card">
              <span>VAT</span>
              <strong>
                {quote.vat_rate}% · {money(vatAmount)}
              </strong>
            </article>
            <article className="detail-card">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </article>
            <article className="detail-card">
              <span>Valid until</span>
              <strong>{quote.valid_until || "TBC"}</strong>
            </article>
          </section>

          {editable ? (
            <form action={saveQuote} className="form-card">
              <input type="hidden" name="project_id" value={id} />
              <input type="hidden" name="quote_id" value={quote.id} />

              <div className="form-grid">
                <label className="field field-wide">
                  <span>Quote title</span>
                  <input name="title" defaultValue={quote.title} required />
                </label>

                <label className="field">
                  <span>Client name</span>
                  <input
                    name="client_name_snapshot"
                    defaultValue={quote.client_name_snapshot ?? ""}
                  />
                </label>

                <label className="field">
                  <span>Contact email</span>
                  <input
                    name="contact_email_snapshot"
                    type="email"
                    defaultValue={quote.contact_email_snapshot ?? ""}
                  />
                </label>

                <label className="field">
                  <span>Net price £</span>
                  <input
                    name="net_price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={quote.net_price}
                  />
                </label>

                <label className="field">
                  <span>VAT rate %</span>
                  <input
                    name="vat_rate"
                    type="number"
                    min="0"
                    max="99"
                    step="0.1"
                    defaultValue={quote.vat_rate}
                  />
                </label>

                <label className="field">
                  <span>Valid until</span>
                  <input
                    name="valid_until"
                    type="date"
                    defaultValue={quote.valid_until ?? ""}
                  />
                </label>

                <label className="field field-wide">
                  <span>Scope</span>
                  <textarea
                    name="scope"
                    rows={6}
                    defaultValue={quote.scope ?? ""}
                  />
                </label>

                <label className="field field-wide">
                  <span>Exclusions</span>
                  <textarea
                    name="exclusions"
                    rows={4}
                    defaultValue={quote.exclusions ?? ""}
                  />
                </label>

                <label className="field field-wide">
                  <span>Assumptions</span>
                  <textarea
                    name="assumptions"
                    rows={4}
                    defaultValue={quote.assumptions ?? ""}
                  />
                </label>

                <label className="field field-wide">
                  <span>Payment terms</span>
                  <textarea
                    name="payment_terms"
                    rows={3}
                    defaultValue={quote.payment_terms ?? ""}
                  />
                </label>

                <label className="field field-wide">
                  <span>Programme</span>
                  <textarea
                    name="programme_notes"
                    rows={3}
                    defaultValue={quote.programme_notes ?? ""}
                  />
                </label>

                <label className="field field-wide">
                  <span>Client notes</span>
                  <textarea
                    name="client_notes"
                    rows={3}
                    defaultValue={quote.client_notes ?? ""}
                  />
                </label>
              </div>

              <div className="form-actions">
                <button className="primary-button" type="submit">
                  Save quote
                </button>
              </div>
            </form>
          ) : (
            <div className="two-column">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Client scope</p>
                    <h2>{quote.title}</h2>
                  </div>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Scope</dt>
                    <dd>{quote.scope || "—"}</dd>
                  </div>
                  <div>
                    <dt>Exclusions</dt>
                    <dd>{quote.exclusions || "—"}</dd>
                  </div>
                  <div>
                    <dt>Assumptions</dt>
                    <dd>{quote.assumptions || "—"}</dd>
                  </div>
                </dl>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Commercial terms</p>
                    <h2>Client terms</h2>
                  </div>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Payment terms</dt>
                    <dd>{quote.payment_terms || "—"}</dd>
                  </div>
                  <div>
                    <dt>Programme</dt>
                    <dd>{quote.programme_notes || "—"}</dd>
                  </div>
                  <div>
                    <dt>Accepted by</dt>
                    <dd>{quote.accepted_by_name || "—"}</dd>
                  </div>
                </dl>
              </section>
            </div>
          )}

          {quotes && quotes.length > 1 ? (
            <details className="completed-actions estimate-history">
              <summary>Previous revisions ({quotes.length - 1})</summary>
              <div className="stack-list">
                {quotes.slice(1).map((revision) => (
                  <div className="stack-row" key={revision.id}>
                    <span>
                      <strong>Revision {revision.version}</strong>
                      <small>
                        {revision.status.replace("_", " ")} ·{" "}
                        {money(revision.net_price)}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
