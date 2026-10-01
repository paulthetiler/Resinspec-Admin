import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { addInvoice, updateInvoice } from "./actions";

type InvoicesPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export default async function InvoicesPage({
  params,
  searchParams,
}: InvoicesPageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase } = await requireAnyPermission(["commercial:view"]);

  const [{ data: project }, { data: invoices }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, reference, title")
      .eq("id", id)
      .single(),
    supabase
      .from("invoices")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!project) notFound();

  const totals = (invoices || []).reduce(
    (acc, invoice) => {
      if (!["draft", "cancelled"].includes(invoice.status)) {
        acc.invoiced += Number(invoice.net_amount ?? 0);
        acc.paid += Number(invoice.paid_amount ?? 0);
        acc.retention += Number(invoice.retention_amount ?? 0);
      }
      return acc;
    },
    { invoiced: 0, paid: 0, retention: 0 }
  );

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · restricted commercial</p>
          <h1>Applications & invoices</h1>
          <p>{project.title} · issued and paid values automatically feed the job totals.</p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" href={`/jobs/${id}/commercial`}>
            Commercial
          </Link>
          <Link className="secondary-button" href={`/jobs/${id}`}>
            Job
          </Link>
        </div>
      </section>

      {error ? <p className="form-error page-error">{error}</p> : null}

      <section className="detail-grid">
        <article className="detail-card">
          <span>Invoiced</span>
          <strong>{money(totals.invoiced)}</strong>
        </article>
        <article className="detail-card">
          <span>Paid</span>
          <strong>{money(totals.paid)}</strong>
        </article>
        <article className="detail-card">
          <span>Outstanding</span>
          <strong>{money(totals.invoiced - totals.paid)}</strong>
        </article>
        <article className="detail-card">
          <span>Retention</span>
          <strong>{money(totals.retention)}</strong>
        </article>
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Ledger</p>
              <h2>Applications / invoices</h2>
            </div>
          </div>

          {invoices && invoices.length > 0 ? (
            <div className="stack-list">
              {invoices.map((invoice) => (
                <article className="invoice-card" key={invoice.id}>
                  <div className="variation-head">
                    <span>
                      <strong>{invoice.reference}</strong>
                      <small>
                        {invoice.invoice_type.replace("_", " ")}
                        {invoice.due_on ? ` · due ${invoice.due_on}` : ""}
                      </small>
                    </span>
                    <span className="status-badge">{invoice.status.replace("_", " ")}</span>
                  </div>

                  <div className="variation-values">
                    <span><small>Net</small><strong>{money(invoice.net_amount)}</strong></span>
                    <span><small>VAT</small><strong>{money(invoice.vat_amount)}</strong></span>
                    <span><small>Retention</small><strong>{money(invoice.retention_amount)}</strong></span>
                    <span><small>Paid</small><strong>{money(invoice.paid_amount)}</strong></span>
                  </div>

                  {!["paid", "cancelled"].includes(invoice.status) ? (
                    <form action={updateInvoice} className="invoice-update-form">
                      <input type="hidden" name="project_id" value={id} />
                      <input type="hidden" name="invoice_id" value={invoice.id} />

                      <select name="status" defaultValue={invoice.status}>
                        <option value="submitted">Submitted</option>
                        <option value="approved">Approved</option>
                        <option value="part_paid">Part paid</option>
                        <option value="paid">Paid</option>
                        <option value="disputed">Disputed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>

                      <input
                        className="mini-input"
                        name="paid_amount"
                        type="number"
                        step="0.01"
                        defaultValue={invoice.paid_amount ?? 0}
                        placeholder="Paid £"
                      />

                      <input
                        className="mini-input"
                        name="paid_on"
                        type="date"
                        defaultValue={invoice.paid_on ?? ""}
                      />

                      <button className="text-button" type="submit">
                        Update
                      </button>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No applications or invoices.</strong>
              <p>Add the first one when the job reaches a commercial milestone.</p>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">New</p>
              <h2>Add application / invoice</h2>
            </div>
          </div>

          <form action={addInvoice} className="compact-form">
            <input type="hidden" name="project_id" value={id} />

            <div className="form-grid">
              <label className="field">
                <span>Reference *</span>
                <input name="reference" required />
              </label>

              <label className="field">
                <span>Type</span>
                <select name="invoice_type" defaultValue="application">
                  <option value="application">Application</option>
                  <option value="invoice">Invoice</option>
                  <option value="final">Final</option>
                  <option value="credit_note">Credit note</option>
                </select>
              </label>

              <label className="field">
                <span>Status</span>
                <select name="status" defaultValue="draft">
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                </select>
              </label>

              <label className="field">
                <span>Period end</span>
                <input name="period_end" type="date" />
              </label>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Net £</span>
                <input name="net_amount" type="number" step="0.01" defaultValue="0" />
              </label>
              <label className="field">
                <span>VAT £</span>
                <input name="vat_amount" type="number" step="0.01" defaultValue="0" />
              </label>
              <label className="field">
                <span>Retention £</span>
                <input name="retention_amount" type="number" step="0.01" defaultValue="0" />
              </label>
              <label className="field">
                <span>Paid £</span>
                <input name="paid_amount" type="number" step="0.01" defaultValue="0" />
              </label>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Issued on</span>
                <input name="issued_on" type="date" />
              </label>
              <label className="field">
                <span>Due on</span>
                <input name="due_on" type="date" />
              </label>
              <label className="field">
                <span>Paid on</span>
                <input name="paid_on" type="date" />
              </label>
              <label className="field">
                <span>Client reference</span>
                <input name="client_reference" />
              </label>
            </div>

            <label className="field">
              <span>Notes</span>
              <textarea name="notes" rows={3} />
            </label>

            <button className="primary-button full-button" type="submit">
              Add record
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
