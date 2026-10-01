import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import {
  createClientForProject,
  createSiteForProject,
  updateProject,
} from "./actions";

type EditProjectProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; added?: string }>;
};

export default async function EditProjectPage({
  params,
  searchParams,
}: EditProjectProps) {
  const { id } = await params;
  const { error, added } = await searchParams;
  const { supabase } = await requireAnyPermission(["jobs:edit"]);

  const [
    { data: project },
    { data: clients },
    { data: sites },
    { data: systems },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase
      .from("clients")
      .select("id, legal_name, trading_name")
      .order("legal_name"),
    supabase
      .from("sites")
      .select("id, name, town_city, postcode, client_id")
      .order("name"),
    supabase
      .from("technical_systems")
      .select("id, code, name, revision, manufacturer, status")
      .eq("status", "approved")
      .order("code")
      .order("revision", { ascending: false }),
  ]);

  if (!project) notFound();

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · project control</p>
          <h1>Edit project</h1>
          <p>
            The job record is the source of truth for scope, client, site, programme and system specification.
          </p>
        </div>
        <Link className="secondary-button" href={`/jobs/${id}`}>
          Back to job
        </Link>
      </section>

      {error ? <p className="form-error page-error">{error}</p> : null}
      {added ? (
        <p className="form-success page-error">
          {added === "client" ? "Client created and attached." : "Site created and attached."}
        </p>
      ) : null}

      <form action={updateProject} className="form-card">
        <input type="hidden" name="project_id" value={id} />

        <div className="form-grid">
          <label className="field field-wide">
            <span>Project title *</span>
            <input name="title" required defaultValue={project.title} />
          </label>

          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={project.status}>
              <option value="lead">Lead</option>
              <option value="qualifying">Qualifying</option>
              <option value="survey">Survey</option>
              <option value="estimating">Estimating</option>
              <option value="quoted">Quoted</option>
              <option value="won">Won</option>
              <option value="prestart">Pre-start</option>
              <option value="live">Live</option>
              <option value="handover">Handover</option>
              <option value="invoiced">Invoiced</option>
              <option value="paid">Paid</option>
              <option value="closed">Closed</option>
              <option value="lost">Lost</option>
            </select>
          </label>

          <label className="field">
            <span>Area m²</span>
            <input
              name="area_m2"
              type="number"
              min="0"
              step="0.01"
              defaultValue={project.area_m2 ?? ""}
            />
          </label>

          <label className="field">
            <span>Programme start</span>
            <input
              name="programme_start"
              type="date"
              defaultValue={project.programme_start ?? ""}
            />
          </label>

          <label className="field">
            <span>Programme finish</span>
            <input
              name="programme_end"
              type="date"
              defaultValue={project.programme_end ?? ""}
            />
          </label>

          <label className="field">
            <span>Client</span>
            <select name="client_id" defaultValue={project.client_id ?? ""}>
              <option value="">Not assigned</option>
              {(clients || []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.trading_name || client.legal_name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Site</span>
            <select name="site_id" defaultValue={project.site_id ?? ""}>
              <option value="">Not assigned</option>
              {(sites || []).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                  {site.town_city ? ` · ${site.town_city}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="field field-wide">
            <span>Approved technical system revision</span>
            <select name="system_id" defaultValue={project.system_id ?? ""}>
              <option value="">Not specified yet</option>
              {(systems || []).map((system) => (
                <option key={system.id} value={system.id}>
                  {system.code} · Rev {system.revision} · {system.name}
                  {system.manufacturer ? ` · ${system.manufacturer}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="field field-wide">
            <span>Scope summary</span>
            <textarea
              name="scope_summary"
              rows={5}
              defaultValue={project.scope_summary ?? ""}
            />
          </label>

          <label className="field">
            <span>Next action</span>
            <input
              name="next_action"
              defaultValue={project.next_action ?? ""}
            />
          </label>

          <label className="field">
            <span>Next action due</span>
            <input
              name="next_action_due"
              type="date"
              defaultValue={project.next_action_due ?? ""}
            />
          </label>
        </div>

        <div className="form-actions">
          <Link className="secondary-button" href={`/jobs/${id}`}>
            Cancel
          </Link>
          <button className="primary-button" type="submit">
            Save project
          </button>
        </div>
      </form>

      <div className="two-column setup-panels">
        <form action={createClientForProject} className="panel compact-form">
          <input type="hidden" name="project_id" value={id} />
          <div className="panel-head">
            <div>
              <p className="eyebrow">Quick add</p>
              <h2>New client</h2>
            </div>
          </div>

          <label className="field">
            <span>Legal / customer name *</span>
            <input name="legal_name" required />
          </label>
          <label className="field">
            <span>Trading name</span>
            <input name="trading_name" />
          </label>
          <label className="field">
            <span>Billing email</span>
            <input name="billing_email" type="email" />
          </label>
          <label className="field">
            <span>Phone</span>
            <input name="phone" />
          </label>
          <label className="field">
            <span>Payment terms days</span>
            <input name="payment_terms_days" type="number" min="0" step="1" />
          </label>

          <button className="secondary-button full-button" type="submit">
            Create & attach client
          </button>
        </form>

        <form action={createSiteForProject} className="panel compact-form">
          <input type="hidden" name="project_id" value={id} />
          <div className="panel-head">
            <div>
              <p className="eyebrow">Quick add</p>
              <h2>New site</h2>
            </div>
          </div>

          <label className="field">
            <span>Site name *</span>
            <input name="name" required />
          </label>
          <label className="field">
            <span>Address</span>
            <input name="address_line_1" />
          </label>
          <label className="field">
            <span>Address line 2</span>
            <input name="address_line_2" />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Town / city</span>
              <input name="town_city" />
            </label>
            <label className="field">
              <span>Postcode</span>
              <input name="postcode" />
            </label>
          </div>
          <label className="field">
            <span>Access notes</span>
            <textarea name="access_notes" rows={3} />
          </label>
          <label className="field">
            <span>Induction / permit notes</span>
            <textarea name="induction_notes" rows={2} />
          </label>
          <label className="field">
            <span>Welfare</span>
            <textarea name="welfare_notes" rows={2} />
          </label>
          <label className="field">
            <span>Power</span>
            <textarea name="power_notes" rows={2} />
          </label>
          <label className="field">
            <span>Water</span>
            <textarea name="water_notes" rows={2} />
          </label>
          <label className="field">
            <span>Waste</span>
            <textarea name="waste_notes" rows={2} />
          </label>
          <label className="field">
            <span>Known hazards</span>
            <textarea name="known_hazards" rows={3} />
          </label>

          <button className="secondary-button full-button" type="submit">
            Create & attach site
          </button>
        </form>
      </div>
    </div>
  );
}
