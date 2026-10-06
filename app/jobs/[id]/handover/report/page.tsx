import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { PrintButton } from "@/components/print-button";
import {
  QA_GATES,
  getQaGateByLabel,
  isQaReleased,
  sortQaRecords,
} from "@/lib/qa-gates";

type QaHandoverReportProps = {
  params: Promise<{ id: string }>;
};

function date(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function humanize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function joinValue(
  value: number | string | null | undefined,
  unit: string | null | undefined
) {
  if (value === null || value === undefined || value === "") return "—";
  return `${value}${unit ? ` ${unit}` : ""}`;
}

export default async function QaHandoverReportPage({
  params,
}: QaHandoverReportProps) {
  const { id } = await params;
  const { supabase } = await requireAnyPermission(["qa:view"]);

  const [
    { data: project },
    { data: qaRows },
    { data: readings },
    { data: batches },
    { data: photos },
    { data: snags },
    { data: handover },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, reference, title, status, area_m2, scope_summary, programme_start, programme_end, clients(legal_name, trading_name), sites(name, address_line_1, address_line_2, town_city, postcode), technical_systems(code, name, manufacturer, revision, status, category, thickness, nominal_thickness_mm, slip_rating, cure_notes)"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("qa_records")
      .select(
        "id, hold_point, status, notes, completed_by, completed_at, accepted_by, accepted_at"
      )
      .eq("project_id", id),
    supabase
      .from("site_readings")
      .select(
        "id, reading_type, value, unit, location, notes, recorded_by, recorded_at"
      )
      .eq("project_id", id)
      .order("recorded_at", { ascending: true }),
    supabase
      .from("batch_logs")
      .select(
        "id, product, batch_reference, quantity, unit, mix_ratio, mix_duration_seconds, coverage_area_m2, mixed_at, pot_life_deadline, ambient_temp, slab_temp, relative_humidity, notes"
      )
      .eq("project_id", id)
      .order("mixed_at", { ascending: true }),
    supabase
      .from("documents")
      .select(
        "id, qa_record_id, file_name, storage_path, mime_type, created_at"
      )
      .eq("project_id", id)
      .eq("document_type", "photo")
      .in("status", ["complete", "approved"])
      .not("qa_record_id", "is", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("snags")
      .select(
        "id, title, detail, status, priority, due_on, completed_at, accepted_at"
      )
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("handover_records")
      .select("*")
      .eq("project_id", id)
      .maybeSingle(),
  ]);

  if (!project) notFound();

  const client = Array.isArray(project.clients)
    ? project.clients[0]
    : project.clients;
  const site = Array.isArray(project.sites) ? project.sites[0] : project.sites;
  const system = Array.isArray(project.technical_systems)
    ? project.technical_systems[0]
    : project.technical_systems;

  const sortedQa = sortQaRecords(qaRows || []);
  const actorIds = Array.from(
    new Set(
      [
        ...sortedQa.flatMap((record) => [
          record.completed_by,
          record.accepted_by,
        ]),
        handover?.prepared_by,
      ].filter((value): value is string => Boolean(value))
    )
  );

  let actorNames = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actors } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds);

    actorNames = new Map(
      (actors || []).map((actor) => [
        actor.id,
        actor.full_name || "ResinSpec team member",
      ])
    );
  }

  const signedPhotos = await Promise.all(
    (photos || []).map(async (photo) => {
      if (!photo.storage_path) return { ...photo, signedUrl: null };

      const { data } = await supabase.storage
        .from("project-documents")
        .createSignedUrl(photo.storage_path, 60 * 60 * 2);

      return { ...photo, signedUrl: data?.signedUrl ?? null };
    })
  );

  const photosByGate = new Map<string, typeof signedPhotos>();
  for (const photo of signedPhotos) {
    if (!photo.qa_record_id) continue;
    const existing = photosByGate.get(photo.qa_record_id) || [];
    existing.push(photo);
    photosByGate.set(photo.qa_record_id, existing);
  }

  const qaStatusByLabel = new Map(
    sortedQa.map((record) => [record.hold_point, record.status])
  );
  const qaReleased = QA_GATES.every((gate) => {
    const status = qaStatusByLabel.get(gate.label);
    return Boolean(status && isQaReleased(status));
  });
  const clientIssue =
    qaReleased &&
    Boolean(handover && ["issued", "accepted"].includes(handover.status));
  const reportStatus = clientIssue
    ? handover?.status === "accepted"
      ? "FINAL · ACCEPTED"
      : "ISSUED"
    : "DRAFT · NOT FOR CLIENT ISSUE";

  const siteAddress = site
    ? [
        site.address_line_1,
        site.address_line_2,
        site.town_city,
        site.postcode,
      ]
        .filter(Boolean)
        .join(", ")
    : "—";

  const clientName =
    client?.trading_name || client?.legal_name || "Client not recorded";
  const systemThickness =
    system?.thickness ||
    (system?.nominal_thickness_mm
      ? `${system.nominal_thickness_mm} mm nominal`
      : "—");

  return (
    <main className="qa-handover-report">
      <div className="report-print-actions">
        <Link className="secondary-button" href={`/jobs/${id}/handover`}>
          Back to handover
        </Link>
        <PrintButton />
      </div>

      <header className="report-head">
        <div>
          <p className="eyebrow">ResinSpec Flooring</p>
          <h1>Installation QA & Handover Record</h1>
          <p>
            {project.reference} · {project.title}
          </p>
        </div>
        <div className="report-brand-block">
          <strong>ResinSpec</strong>
          <span>FLOORING</span>
        </div>
      </header>

      <div
        className={`report-status ${clientIssue ? "report-status-final" : "report-status-draft"}`}
      >
        <strong>{reportStatus}</strong>
        <span>
          Handover status: {humanize(handover?.status || "draft")} · QA gates
          released: {qaReleased ? "yes" : "no"}
        </span>
      </div>

      <section className="report-section">
        <div className="report-section-head">
          <span>01</span>
          <div>
            <h2>Project & installation</h2>
            <p>Job identity, site and installed system.</p>
          </div>
        </div>

        <div className="report-summary-grid">
          <div>
            <span>Client</span>
            <strong>{clientName}</strong>
          </div>
          <div>
            <span>Site</span>
            <strong>{site?.name || "—"}</strong>
            <small>{siteAddress}</small>
          </div>
          <div>
            <span>Floor area</span>
            <strong>{project.area_m2 ? `${project.area_m2} m²` : "—"}</strong>
          </div>
          <div>
            <span>Completion</span>
            <strong>{date(handover?.completion_date)}</strong>
          </div>
          <div>
            <span>System</span>
            <strong>
              {system ? `${system.code} · ${system.name}` : "Not recorded"}
            </strong>
            {system ? (
              <small>
                {system.manufacturer || "Manufacturer not recorded"} · Rev{" "}
                {system.revision}
              </small>
            ) : null}
          </div>
          <div>
            <span>System build</span>
            <strong>{systemThickness}</strong>
            <small>
              {[system?.category, system?.slip_rating]
                .filter(Boolean)
                .join(" · ") || "—"}
            </small>
          </div>
        </div>

        <div className="report-copy-block">
          <span>Scope</span>
          <p>{project.scope_summary || "Scope not recorded."}</p>
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-head">
          <span>02</span>
          <div>
            <h2>QA gate record</h2>
            <p>Critical installation stages and supervisor release history.</p>
          </div>
        </div>

        <div className="report-gates">
          {QA_GATES.map((gate) => {
            const record = sortedQa.find(
              (row) => row.hold_point === gate.label
            );
            const gatePhotos = record
              ? photosByGate.get(record.id) || []
              : [];
            const completedName = record?.completed_by
              ? actorNames.get(record.completed_by)
              : null;
            const reviewedName = record?.accepted_by
              ? actorNames.get(record.accepted_by)
              : null;

            return (
              <article className="report-gate" key={gate.code}>
                <div className="report-gate-head">
                  <span>{String(gate.order).padStart(2, "0")}</span>
                  <div>
                    <h3>{gate.label}</h3>
                    <small>{gate.purpose}</small>
                  </div>
                  <strong
                    className={`report-gate-status report-gate-${record?.status || "missing"}`}
                  >
                    {humanize(record?.status || "missing")}
                  </strong>
                </div>

                {record?.notes ? (
                  <p className="report-gate-note">{record.notes}</p>
                ) : null}

                <div className="report-gate-meta">
                  <span>
                    <b>Completed</b>{" "}
                    {record?.completed_at
                      ? `${dateTime(record.completed_at)}${completedName ? ` · ${completedName}` : ""}`
                      : "—"}
                  </span>
                  <span>
                    <b>Reviewed</b>{" "}
                    {record?.accepted_at
                      ? `${dateTime(record.accepted_at)}${reviewedName ? ` · ${reviewedName}` : ""}`
                      : "—"}
                  </span>
                  <span>
                    <b>Photo evidence</b> {gatePhotos.length}
                  </span>
                </div>

                {gatePhotos.length > 0 ? (
                  <div className="report-photo-grid">
                    {gatePhotos.map((photo) =>
                      photo.signedUrl ? (
                        <figure key={photo.id}>
                          <img
                            src={photo.signedUrl}
                            alt={photo.file_name || `${gate.label} evidence`}
                          />
                          <figcaption>
                            {photo.file_name || "QA evidence"} ·{" "}
                            {dateTime(photo.created_at)}
                          </figcaption>
                        </figure>
                      ) : null
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="report-section report-page-break-before">
        <div className="report-section-head">
          <span>03</span>
          <div>
            <h2>Measured site conditions</h2>
            <p>Recorded installation readings retained against the project.</p>
          </div>
        </div>

        {readings && readings.length > 0 ? (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Reading</th>
                  <th>Value</th>
                  <th>Location</th>
                  <th>Recorded</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((reading) => (
                  <tr key={reading.id}>
                    <td>{humanize(reading.reading_type)}</td>
                    <td>{joinValue(reading.value, reading.unit)}</td>
                    <td>{reading.location || "—"}</td>
                    <td>{dateTime(reading.recorded_at)}</td>
                    <td>{reading.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="report-empty">No site readings recorded.</p>
        )}
      </section>

      <section className="report-section">
        <div className="report-section-head">
          <span>04</span>
          <div>
            <h2>Material batch & mix traceability</h2>
            <p>Products and application data recorded during installation.</p>
          </div>
        </div>

        {batches && batches.length > 0 ? (
          <div className="report-table-wrap">
            <table className="report-table report-batch-table">
              <thead>
                <tr>
                  <th>Product / batch</th>
                  <th>Quantity</th>
                  <th>Mix</th>
                  <th>Coverage</th>
                  <th>Conditions</th>
                  <th>Mixed</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      <strong>{batch.product}</strong>
                      <small>{batch.batch_reference || "No batch ref"}</small>
                    </td>
                    <td>{joinValue(batch.quantity, batch.unit)}</td>
                    <td>
                      {batch.mix_ratio || "—"}
                      {batch.mix_duration_seconds
                        ? ` · ${batch.mix_duration_seconds}s`
                        : ""}
                    </td>
                    <td>
                      {batch.coverage_area_m2
                        ? `${batch.coverage_area_m2} m²`
                        : "—"}
                    </td>
                    <td>
                      {[
                        batch.ambient_temp !== null
                          ? `Air ${batch.ambient_temp}°C`
                          : null,
                        batch.slab_temp !== null
                          ? `Slab ${batch.slab_temp}°C`
                          : null,
                        batch.relative_humidity !== null
                          ? `RH ${batch.relative_humidity}%`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td>{dateTime(batch.mixed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="report-empty">No batch / mix records recorded.</p>
        )}
      </section>

      <section className="report-section">
        <div className="report-section-head">
          <span>05</span>
          <div>
            <h2>Snag & close-out record</h2>
            <p>Outstanding items and their final acceptance status.</p>
          </div>
        </div>

        {snags && snags.length > 0 ? (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Completed</th>
                  <th>Accepted</th>
                </tr>
              </thead>
              <tbody>
                {snags.map((snag) => (
                  <tr key={snag.id}>
                    <td>
                      <strong>{snag.title}</strong>
                      {snag.detail ? <small>{snag.detail}</small> : null}
                    </td>
                    <td>{humanize(snag.priority)}</td>
                    <td>{humanize(snag.status)}</td>
                    <td>{dateTime(snag.completed_at)}</td>
                    <td>{dateTime(snag.accepted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="report-empty">No snags recorded.</p>
        )}
      </section>

      <section className="report-section report-handover-section">
        <div className="report-section-head">
          <span>06</span>
          <div>
            <h2>Handover</h2>
            <p>Completion, care information and final client acceptance.</p>
          </div>
        </div>

        <div className="report-handover-grid">
          <div>
            <span>Completion date</span>
            <strong>{date(handover?.completion_date)}</strong>
          </div>
          <div>
            <span>Client contact</span>
            <strong>{handover?.client_contact_name || "—"}</strong>
          </div>
          <div>
            <span>Issued</span>
            <strong>{dateTime(handover?.issued_at)}</strong>
          </div>
          <div>
            <span>Accepted</span>
            <strong>{dateTime(handover?.accepted_at)}</strong>
          </div>
        </div>

        <div className="report-copy-grid">
          <div>
            <span>Care / cleaning information</span>
            <p>{handover?.care_information || "Not recorded."}</p>
          </div>
          <div>
            <span>Warranty information</span>
            <p>{handover?.warranty_information || "Not recorded."}</p>
          </div>
          <div>
            <span>Outstanding items / exclusions</span>
            <p>{handover?.outstanding_items || "None recorded."}</p>
          </div>
          <div>
            <span>Cure / return-to-service information</span>
            <p>{system?.cure_notes || "Refer to the approved system data."}</p>
          </div>
        </div>

        <div className="report-acceptance">
          <div>
            <span>Accepted by</span>
            <strong>{handover?.accepted_by_name || "—"}</strong>
            <small>Client representative</small>
          </div>
          <div>
            <span>Prepared by</span>
            <strong>
              {handover?.prepared_by
                ? actorNames.get(handover.prepared_by) || "ResinSpec Flooring"
                : "ResinSpec Flooring"}
            </strong>
            <small>Installation record</small>
          </div>
        </div>
      </section>

      <footer className="report-footer">
        <div>
          <strong>ResinSpec Flooring</strong>
          <span>Industrial · Hygienic · Commercial</span>
        </div>
        <div>
          <span>{project.reference}</span>
          <span>Report generated {dateTime(new Date().toISOString())}</span>
        </div>
      </footer>
    </main>
  );
}
