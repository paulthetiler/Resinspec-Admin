import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/access";

type JobPageProps = {
  params: Promise<{ id: string }>;
};

export default async function JobPage({ params }: JobPageProps) {
  const { id } = await params;
  const { supabase, role } = await requireAnyPermission([
    "jobs:view_all",
    "jobs:view_assigned",
  ]);

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, reference, title, status, area_m2, programme_start, programme_end, scope_summary, next_action, next_action_due, clients(trading_name, legal_name), sites(name, address_line_1, address_line_2, town_city, postcode, access_notes, induction_notes, welfare_notes, power_notes, water_notes, waste_notes, known_hazards), technical_systems(code, name, manufacturer, revision, thickness, mixing_instructions, coverage_notes, pot_life_notes, cure_notes, application_limits, temperature_notes)"
    )
    .eq("id", id)
    .single();

  if (!project) {
    notFound();
  }

  const [{ count: documentCount }, { count: qaCount }, { count: crewCount }] =
    await Promise.all([
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("project_id", id),
      supabase
        .from("qa_records")
        .select("id", { count: "exact", head: true })
        .eq("project_id", id),
      supabase
        .from("project_assignments")
        .select("id", { count: "exact", head: true })
        .eq("project_id", id),
    ]);

  const commercial = can(role, "commercial:view")
    ? (
        await supabase
          .from("project_commercials")
          .select(
            "order_value, estimated_direct_cost, risk_adjusted_cost, target_margin_pct, actual_direct_cost, variation_value, invoiced_value, paid_value"
          )
          .eq("project_id", id)
          .maybeSingle()
      ).data
    : null;

  const client = Array.isArray(project.clients)
    ? project.clients[0]
    : project.clients;
  const site = Array.isArray(project.sites) ? project.sites[0] : project.sites;
  const system = Array.isArray(project.technical_systems)
    ? project.technical_systems[0]
    : project.technical_systems;

  const siteAddress = site
    ? [
        site.address_line_1,
        site.address_line_2,
        site.town_city,
        site.postcode,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const directionsUrl = siteAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        siteAddress
      )}`
    : null;

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference}</p>
          <h1>{project.title}</h1>
          <p>
            {client?.trading_name || client?.legal_name || "Client not added"}
            {site?.name ? ` · ${site.name}` : ""}
            {site?.town_city ? ` · ${site.town_city}` : ""}
          </p>
        </div>
        <div className="heading-actions">
          {can(role, "jobs:edit") ? (
            <>
              <Link className="secondary-button" href={`/jobs/${id}/edit`}>
                Edit
              </Link>
              <Link className="secondary-button" href={`/jobs/${id}/crew`}>
                Crew
              </Link>
            </>
          ) : null}

          {can(role, "survey:view") ? (
            <Link className="secondary-button" href={`/jobs/${id}/survey`}>
              Survey
            </Link>
          ) : null}

          {can(role, "documents:view") ? (
            <>
              <Link className="secondary-button" href={`/jobs/${id}/rams`}>
                RAMS
              </Link>
              <Link className="secondary-button" href={`/jobs/${id}/documents`}>
                Files
              </Link>
            </>
          ) : null}

          {can(role, "qa:view") ? (
            <Link className="secondary-button" href={`/jobs/${id}/qa`}>
              QA
            </Link>
          ) : null}

          {can(role, "dashboard:view") ? (
            <Link className="secondary-button" href={`/jobs/${id}/actions`}>
              Actions
            </Link>
          ) : null}

          {can(role, "commercial:view") ? (
            <Link className="secondary-button" href={`/jobs/${id}/commercial`}>
              Commercial
            </Link>
          ) : null}

          <Link className="secondary-button" href="/jobs">
            Jobs
          </Link>
        </div>
      </section>

      <section className="detail-grid">
        <article className="detail-card">
          <span>Status</span>
          <strong className="status-badge">{project.status}</strong>
        </article>
        <article className="detail-card">
          <span>Area</span>
          <strong>{project.area_m2 ? `${project.area_m2} m²` : "TBC"}</strong>
        </article>
        <article className="detail-card">
          <span>Crew</span>
          <strong>{crewCount ?? 0}</strong>
        </article>
        <article className="detail-card">
          <span>Documents / QA</span>
          <strong>{documentCount ?? 0} / {qaCount ?? 0}</strong>
        </article>
      </section>

      <div className="two-column site-brief-grid">
        <section className="panel site-brief-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Site</p>
              <h2>Location & access</h2>
            </div>
            {directionsUrl ? (
              <a
                className="secondary-button"
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
              >
                Directions
              </a>
            ) : null}
          </div>

          <dl className="detail-list">
            <div>
              <dt>Address</dt>
              <dd>{siteAddress || "Address not added"}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>{site?.access_notes || "No access notes"}</dd>
            </div>
            <div>
              <dt>Induction / permits</dt>
              <dd>{site?.induction_notes || "No induction notes"}</dd>
            </div>
            <div>
              <dt>Known hazards</dt>
              <dd>{site?.known_hazards || "None recorded"}</dd>
            </div>
          </dl>

          <div className="site-utilities">
            <span><strong>Welfare</strong>{site?.welfare_notes || "—"}</span>
            <span><strong>Power</strong>{site?.power_notes || "—"}</span>
            <span><strong>Water</strong>{site?.water_notes || "—"}</span>
            <span><strong>Waste</strong>{site?.waste_notes || "—"}</span>
          </div>
        </section>

        <section className="panel technical-critical">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Site-critical technical</p>
              <h2>Mixing & timing</h2>
            </div>
          </div>

          {system ? (
            <dl className="detail-list">
              <div>
                <dt>System</dt>
                <dd>
                  {system.code} · Rev {system.revision} · {system.name}
                </dd>
              </div>
              <div>
                <dt>Mixing</dt>
                <dd>{system.mixing_instructions || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Pot life</dt>
                <dd>{system.pot_life_notes || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Coverage</dt>
                <dd>{system.coverage_notes || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Cure / recoat</dt>
                <dd>{system.cure_notes || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Application limits</dt>
                <dd>{system.application_limits || system.temperature_notes || "Not recorded"}</dd>
              </div>
            </dl>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No approved system assigned.</strong>
              <p>Do not install until a technical system revision is attached to the project.</p>
            </div>
          )}
        </section>
      </div>

      <div className="two-column">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Job brief</p>
              <h2>Scope & programme</h2>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Scope</dt>
              <dd>{project.scope_summary || "Not added yet"}</dd>
            </div>
            <div>
              <dt>Programme</dt>
              <dd>
                {project.programme_start || "TBC"} → {project.programme_end || "TBC"}
              </dd>
            </div>
            <div>
              <dt>Next action</dt>
              <dd>
                {project.next_action || "None"}
                {project.next_action_due ? ` · ${project.next_action_due}` : ""}
              </dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Technical</p>
              <h2>Assigned system</h2>
            </div>
          </div>
          {system ? (
            <dl className="detail-list">
              <div>
                <dt>System</dt>
                <dd>{system.code} · {system.name}</dd>
              </div>
              <div>
                <dt>Manufacturer</dt>
                <dd>{system.manufacturer || "—"}</dd>
              </div>
              <div>
                <dt>Revision</dt>
                <dd>Rev {system.revision}</dd>
              </div>
            </dl>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No system assigned.</strong>
              <p>System selection will be attached after survey/specification.</p>
            </div>
          )}
        </section>
      </div>

      {can(role, "commercial:view") ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Restricted commercial</p>
              <h2>Job financials</h2>
            </div>
          </div>
          {commercial ? (
            <div className="commercial-grid">
              <div><span>Order value</span><strong>£{commercial.order_value ?? "—"}</strong></div>
              <div><span>Risk-adjusted cost</span><strong>£{commercial.risk_adjusted_cost ?? "—"}</strong></div>
              <div><span>Target margin</span><strong>{commercial.target_margin_pct ?? "—"}%</strong></div>
              <div><span>Actual cost</span><strong>£{commercial.actual_direct_cost ?? "—"}</strong></div>
              <div><span>Variations</span><strong>£{commercial.variation_value ?? "—"}</strong></div>
              <div><span>Paid</span><strong>£{commercial.paid_value ?? "—"}</strong></div>
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No commercial record yet.</strong>
              <p>The estimator and job costing layer will create this automatically later.</p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
