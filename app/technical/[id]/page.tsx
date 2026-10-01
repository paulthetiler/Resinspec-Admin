import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/access";
import { TechnicalSystemFields } from "@/components/technical-system-fields";
import {
  approveTechnicalSystem,
  createTechnicalRevision,
  retireTechnicalSystem,
  updateTechnicalSystem,
} from "./actions";

type TechnicalDetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    approved?: string;
  }>;
};

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

export default async function TechnicalDetailPage({
  params,
  searchParams,
}: TechnicalDetailProps) {
  const { id } = await params;
  const messages = await searchParams;
  const { supabase, role } = await requireAnyPermission(["technical:view"]);

  const { data: system } = await supabase
    .from("technical_systems")
    .select("*")
    .eq("id", id)
    .single();

  if (!system) notFound();

  const editable =
    system.status === "draft" && can(role, "technical:edit");

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            {system.code} · Revision {system.revision}
          </p>
          <h1>{system.name}</h1>
          <p>
            {system.manufacturer || "Manufacturer not recorded"}
            {system.category ? ` · ${system.category}` : ""}
          </p>
        </div>

        <div className="heading-actions">
          {can(role, "technical:edit") && system.status !== "draft" ? (
            <form action={createTechnicalRevision}>
              <input type="hidden" name="system_id" value={system.id} />
              <button className="secondary-button" type="submit">
                New revision
              </button>
            </form>
          ) : null}

          {can(role, "technical:edit") && system.status === "approved" ? (
            <form action={retireTechnicalSystem}>
              <input type="hidden" name="system_id" value={system.id} />
              <button className="secondary-button" type="submit">
                Retire
              </button>
            </form>
          ) : null}

          <Link className="secondary-button" href="/technical">
            Back to technical
          </Link>
        </div>
      </section>

      {messages.error ? (
        <p className="form-error page-error">{messages.error}</p>
      ) : null}
      {messages.saved ? (
        <p className="form-success page-error">Draft saved.</p>
      ) : null}
      {messages.approved ? (
        <p className="form-success page-error">
          Revision approved and locked.
        </p>
      ) : null}

      <section className="detail-grid">
        <article className="detail-card">
          <span>Status</span>
          <strong className="status-badge">{system.status}</strong>
        </article>
        <article className="detail-card">
          <span>Nominal thickness</span>
          <strong>
            {system.nominal_thickness_mm
              ? `${system.nominal_thickness_mm} mm`
              : "—"}
          </strong>
        </article>
        <article className="detail-card">
          <span>Slip</span>
          <strong>{system.slip_rating || "—"}</strong>
        </article>
        <article className="detail-card">
          <span>Revision</span>
          <strong>{system.revision}</strong>
        </article>
      </section>

      {editable ? (
        <>
          <form action={updateTechnicalSystem} className="form-card">
            <input type="hidden" name="system_id" value={system.id} />
            <TechnicalSystemFields system={system} />

            <div className="form-actions">
              <button className="secondary-button" type="submit">
                Save draft
              </button>
            </div>
          </form>

          <section className="approval-box technical-approval-box">
            <p>
              Approval confirms this revision has been checked against
              controlled manufacturer or training information. Approval locks
              this revision and retires the previously approved revision with
              the same system code.
            </p>
            <form action={approveTechnicalSystem}>
              <input type="hidden" name="system_id" value={system.id} />
              <button className="primary-button" type="submit">
                Approve revision {system.revision}
              </button>
            </form>
          </section>
        </>
      ) : (
        <>
          <div className="two-column">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Build-up</p>
                  <h2>System layers</h2>
                </div>
              </div>
              <dl className="detail-list">
                <Detail label="Primer" value={system.primer} />
                <Detail label="Body coat" value={system.body_coat} />
                <Detail label="Broadcast" value={system.broadcast} />
                <Detail label="Topcoat" value={system.topcoat} />
                <Detail label="Thickness notes" value={system.thickness} />
              </dl>
            </section>

            <section className="panel technical-critical">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Site-critical</p>
                  <h2>Mixing & timing</h2>
                </div>
              </div>
              <dl className="detail-list">
                <Detail label="Mixing" value={system.mixing_instructions} />
                <Detail label="Coverage" value={system.coverage_notes} />
                <Detail label="Pot life" value={system.pot_life_notes} />
                <Detail label="Cure / recoat" value={system.cure_notes} />
              </dl>
            </section>
          </div>

          <div className="two-column">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Acceptance</p>
                  <h2>Substrate & limits</h2>
                </div>
              </div>
              <dl className="detail-list">
                <Detail
                  label="Substrate requirements"
                  value={system.substrate_requirements}
                />
                <Detail
                  label="Application limits"
                  value={system.application_limits}
                />
                <Detail
                  label="Temperature"
                  value={system.temperature_notes}
                />
                <Detail
                  label="Service / resistance"
                  value={system.chemical_notes}
                />
              </dl>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Controlled documents</p>
                  <h2>References</h2>
                </div>
              </div>
              <dl className="detail-list">
                <Detail
                  label="Technical data"
                  value={system.tds_reference}
                />
                <Detail
                  label="Safety data"
                  value={system.sds_reference}
                />
                <Detail
                  label="Approved"
                  value={
                    system.approved_at
                      ? new Date(system.approved_at).toLocaleDateString("en-GB")
                      : "Not approved"
                  }
                />
              </dl>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
