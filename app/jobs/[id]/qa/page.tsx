import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import {
  addBatchLog,
  addSiteReading,
  completeQaRecord,
  reviewQaRecord,
  seedStandardQa,
} from "./actions";

type QaPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

function localDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function QaPage({
  params,
  searchParams,
}: QaPageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, role } = await requireAnyPermission([
    "qa:view",
    "qa:complete",
  ]);

  const [
    { data: project },
    { data: qa },
    { data: readings },
    { data: batches },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, reference, title, system_id, technical_systems(code, name, revision)")
      .eq("id", id)
      .single(),
    supabase
      .from("qa_records")
      .select("id, hold_point, status, notes, completed_at, accepted_at")
      .eq("project_id", id)
      .order("created_at"),
    supabase
      .from("site_readings")
      .select("id, reading_type, value, unit, location, notes, recorded_at")
      .eq("project_id", id)
      .order("recorded_at", { ascending: false })
      .limit(20),
    supabase
      .from("batch_logs")
      .select(
        "id, product, batch_reference, quantity, unit, mix_ratio, mix_duration_seconds, coverage_area_m2, mixed_at, pot_life_deadline, ambient_temp, slab_temp, relative_humidity, notes"
      )
      .eq("project_id", id)
      .order("mixed_at", { ascending: false })
      .limit(20),
  ]);

  if (!project) notFound();

  const system = Array.isArray(project.technical_systems)
    ? project.technical_systems[0]
    : project.technical_systems;
  const canReview = role === "owner" || role === "supervisor";

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · QA</p>
          <h1>{project.title}</h1>
          <p>
            Critical hold points, site readings and batch evidence.
            {system ? ` System: ${system.code} Rev ${system.revision}.` : ""}
          </p>
        </div>
        <Link className="secondary-button" href={`/jobs/${id}`}>
          Back to job
        </Link>
      </section>

      {error ? <p className="form-error page-error">{error}</p> : null}

      <section className="panel qa-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Critical hold points</p>
            <h2>QA sequence</h2>
          </div>

          {(!qa || qa.length === 0) ? (
            <form action={seedStandardQa}>
              <input type="hidden" name="project_id" value={id} />
              <button className="secondary-button" type="submit">
                Set up standard QA
              </button>
            </form>
          ) : null}
        </div>

        {qa && qa.length > 0 ? (
          <div className="qa-list">
            {qa.map((record) => (
              <article className="qa-row" key={record.id}>
                <div className="qa-row-main">
                  <span className={`status-badge qa-${record.status}`}>
                    {record.status.replace("_", " ")}
                  </span>
                  <div>
                    <strong>{record.hold_point}</strong>
                    {record.notes ? <small>{record.notes}</small> : null}
                    {record.completed_at ? (
                      <small>Completed {localDateTime(record.completed_at)}</small>
                    ) : null}
                  </div>
                </div>

                <div className="qa-actions">
                  {(record.status === "open" || record.status === "rejected") ? (
                    <form action={completeQaRecord} className="inline-note-form">
                      <input type="hidden" name="project_id" value={id} />
                      <input type="hidden" name="record_id" value={record.id} />
                      <input name="notes" placeholder="Evidence / note" />
                      <button className="text-button" type="submit">
                        Mark complete
                      </button>
                    </form>
                  ) : null}

                  {canReview && record.status === "complete" ? (
                    <div className="inline-actions">
                      <form action={reviewQaRecord}>
                        <input type="hidden" name="project_id" value={id} />
                        <input type="hidden" name="record_id" value={record.id} />
                        <input type="hidden" name="decision" value="accepted" />
                        <button className="text-button" type="submit">
                          Accept
                        </button>
                      </form>
                      <form action={reviewQaRecord}>
                        <input type="hidden" name="project_id" value={id} />
                        <input type="hidden" name="record_id" value={record.id} />
                        <input type="hidden" name="decision" value="rejected" />
                        <button className="text-button danger-text" type="submit">
                          Reject
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <strong>QA not set up yet.</strong>
            <p>Use the standard critical hold points rather than a huge generic checklist.</p>
          </div>
        )}
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Measured evidence</p>
              <h2>Site readings</h2>
            </div>
          </div>

          <form action={addSiteReading} className="compact-form">
            <input type="hidden" name="project_id" value={id} />

            <div className="form-grid">
              <label className="field">
                <span>Reading</span>
                <select name="reading_type" defaultValue="moisture">
                  <option value="moisture">Moisture</option>
                  <option value="ambient_temp">Ambient temp</option>
                  <option value="slab_temp">Slab temp</option>
                  <option value="relative_humidity">Relative humidity</option>
                  <option value="dew_point">Dew point</option>
                  <option value="pull_off">Pull-off test</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="field">
                <span>Value</span>
                <input name="value" type="number" step="0.001" required />
              </label>

              <label className="field">
                <span>Unit</span>
                <input name="unit" required placeholder="%, °C, MPa..." />
              </label>

              <label className="field">
                <span>Location</span>
                <input name="location" placeholder="Bay 2 / grid A4" />
              </label>
            </div>

            <label className="field">
              <span>Note</span>
              <input name="notes" />
            </label>

            <button className="secondary-button full-button" type="submit">
              Add reading
            </button>
          </form>

          {readings && readings.length > 0 ? (
            <div className="compact-log">
              {readings.map((reading) => (
                <div key={reading.id}>
                  <span>
                    <strong>
                      {reading.value} {reading.unit}
                    </strong>
                    <small>
                      {reading.reading_type.replaceAll("_", " ")}
                      {reading.location ? ` · ${reading.location}` : ""}
                    </small>
                  </span>
                  <small>{localDateTime(reading.recorded_at)}</small>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Traceability</p>
              <h2>Batch / mix log</h2>
            </div>
          </div>

          <form action={addBatchLog} className="compact-form">
            <input type="hidden" name="project_id" value={id} />

            <label className="field">
              <span>Product *</span>
              <input name="product" required placeholder="Body coat / topcoat product" />
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Batch reference</span>
                <input name="batch_reference" />
              </label>
              <label className="field">
                <span>Mix ratio</span>
                <input name="mix_ratio" placeholder="A:B or full-kit" />
              </label>
              <label className="field">
                <span>Quantity</span>
                <input name="quantity" type="number" step="0.001" />
              </label>
              <label className="field">
                <span>Unit</span>
                <input name="unit" placeholder="kg / kit" />
              </label>
              <label className="field">
                <span>Mix seconds</span>
                <input name="mix_duration_seconds" type="number" min="0" step="1" />
              </label>
              <label className="field">
                <span>Coverage m²</span>
                <input name="coverage_area_m2" type="number" min="0" step="0.01" />
              </label>
              <label className="field">
                <span>Ambient °C</span>
                <input name="ambient_temp" type="number" step="0.1" />
              </label>
              <label className="field">
                <span>Slab °C</span>
                <input name="slab_temp" type="number" step="0.1" />
              </label>
              <label className="field">
                <span>RH %</span>
                <input name="relative_humidity" type="number" step="0.1" />
              </label>
            </div>

            <label className="field">
              <span>Notes</span>
              <input name="notes" />
            </label>

            <button className="secondary-button full-button" type="submit">
              Log batch
            </button>
          </form>

          {batches && batches.length > 0 ? (
            <div className="compact-log">
              {batches.map((batch) => (
                <div key={batch.id}>
                  <span>
                    <strong>{batch.product}</strong>
                    <small>
                      {batch.batch_reference || "No batch ref"}
                      {batch.mix_ratio ? ` · ${batch.mix_ratio}` : ""}
                      {batch.coverage_area_m2
                        ? ` · ${batch.coverage_area_m2} m²`
                        : ""}
                    </small>
                  </span>
                  <small>{localDateTime(batch.mixed_at)}</small>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
