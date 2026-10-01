import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";

type TechnicalDetailProps = {
  params: Promise<{ id: string }>;
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
}: TechnicalDetailProps) {
  const { id } = await params;
  const { supabase } = await requireAnyPermission(["technical:view"]);

  const { data: system } = await supabase
    .from("technical_systems")
    .select("*")
    .eq("id", id)
    .single();

  if (!system) notFound();

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
        <Link className="secondary-button" href="/technical">
          Back to technical
        </Link>
      </section>

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
            <Detail label="Substrate requirements" value={system.substrate_requirements} />
            <Detail label="Application limits" value={system.application_limits} />
            <Detail label="Temperature" value={system.temperature_notes} />
            <Detail label="Chemical / service" value={system.chemical_notes} />
          </dl>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Manufacturer documents</p>
              <h2>References</h2>
            </div>
          </div>
          <dl className="detail-list">
            <Detail label="TDS" value={system.tds_reference} />
            <Detail label="SDS" value={system.sds_reference} />
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
    </div>
  );
}
