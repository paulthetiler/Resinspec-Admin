import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { QaEvidenceUpload } from "@/components/qa-evidence-upload";
import { getPrestartState } from "@/lib/prestart";
import {
  QA_GATES,
  getQaGateByLabel,
  isQaReleased,
  sortQaRecords,
} from "@/lib/qa-gates";
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
    { data: qaEvidence },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, reference, title, system_id, technical_systems(code, name, revision, status)")
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
  ]);

  if (!project) notFound();

  const prestart = await getPrestartState(supabase, id);

  const system = Array.isArray(project.technical_systems)
    ? project.technical_systems[0]
    : project.technical_systems;
  const canReview = role === "owner" || role === "supervisor";
  const sortedQa = sortQaRecords(qa || []);

  const signedEvidence = await Promise.all(
    (qaEvidence || []).map(async (item) => {
      if (!item.storage_path) return { ...item, signedUrl: null };

      const { data } = await supabase.storage
        .from("project-documents")
        .createSignedUrl(item.storage_path, 60 * 60);

      return { ...item, signedUrl: data?.signedUrl ?? null };
    })
  );

  const evidenceByGate = new Map<
    string,
    (typeof signedEvidence)[number][]
  >();

  for (const item of signedEvidence) {
    if (!item.qa_record_id) continue;
    const existing = evidenceByGate.get(item.qa_record_id) || [];
    existing.push(item);
    evidenceByGate.set(item.qa_record_id, existing);
  }

  const actorIds = Array.from(
    new Set(
      sortedQa
        .flatMap((record) => [record.completed_by, record.accepted_by])
        .filter((value): value is string => Boolean(value))
    )
  );

  let actorNames = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actors } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds);

    actorNames = new Map(
      (actors || []).map((actor) => [actor.id, actor.full_name || "Team member"])
    );
  }

  const releasedCount = sortedQa.filter((record) =>
    isQaReleased(record.status)
  ).length;
  const currentRecord = sortedQa.find(
    (record) => !isQaReleased(record.status)
  );
  const currentGate = currentRecord
    ? getQaGateByLabel(currentRecord.hold_point)
    : null;
  const progress = QA_GATES.length
    ? Math.round((releasedCount / QA_GATES.length) * 100)
    : 0;

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · QA gate system</p>
          <h1>{project.title}</h1>
          <p>
            Each critical stage must be completed and released before the next
            stage opens.
            {system
              ? ` System: ${system.code} Rev ${system.revision} · ${system.status}.`
              : " No technical system assigned yet."}
          </p>
        </div>
        <div className="heading-actions">
          <Link
            className="secondary-button"
            href={`/jobs/${id}/handover/report`}
          >
            QA / handover report
          </Link>
          <Link className="secondary-button" href={`/jobs/${id}`}>
            Back to job
          </Link>
        </div>
      </section>

      {error ? <p className="form-error page-error">{error}</p> : null}

      {prestart?.releaseCurrent ? (
        <div className="foundation-note qa-prestart-note">
          <span className="pulse" />
          <div>
            <strong>Pre-start released</strong>
            <p>Gate 1 is permitted to proceed when site works begin.</p>
          </div>
          <Link className="text-button" href={`/jobs/${id}/prestart`}>
            View pre-start
          </Link>
        </div>
      ) : (
        <div className="prestart-stale-note qa-prestart-note">
          <strong>Gate 1 is locked.</strong>{" "}
          Current project inputs do not have a valid pre-start release.
          <Link className="text-button" href={`/jobs/${id}/prestart`}>
            Open pre-start
          </Link>
        </div>
      )}

      <section className="panel qa-panel">
        <div className="panel-head qa-panel-head">
          <div>
            <p className="eyebrow">ResinSpec QA Gate System</p>
            <h2>Failure-prevention sequence</h2>
          </div>

          {sortedQa.length < QA_GATES.length ? (
            <form action={seedStandardQa}>
              <input type="hidden" name="project_id" value={id} />
              <button className="secondary-button" type="submit">
                {sortedQa.length === 0 ? "Set up standard QA" : "Sync QA gates"}
              </button>
            </form>
          ) : null}
        </div>

        {sortedQa.length > 0 ? (
          <>
            <div className="qa-progress-card">
              <div>
                <span>QA release</span>
                <strong>
                  {releasedCount} / {QA_GATES.length} gates
                </strong>
              </div>
              <div className="qa-progress-track" aria-label={`${progress}% released`}>
                <i style={{ width: `${progress}%` }} />
              </div>
              <small>
                {currentGate
                  ? `Current: Gate ${currentGate.order} · ${currentGate.label}`
                  : "All QA gates released — handover can proceed."}
              </small>
            </div>

            <div className="qa-list">
              {sortedQa.map((record) => {
                const gate = getQaGateByLabel(record.hold_point);
                const previousGate = gate
                  ? QA_GATES.filter((item) => item.order < gate.order).find(
                      (item) => {
                        const previousRecord = sortedQa.find(
                          (candidate) => candidate.hold_point === item.label
                        );
                        return !previousRecord || !isQaReleased(previousRecord.status);
                      }
                    )
                  : null;
                const locked = Boolean(previousGate);
                const visualStatus =
                  locked && !isQaReleased(record.status)
                    ? "locked"
                    : record.status;
                const completedName = record.completed_by
                  ? actorNames.get(record.completed_by)
                  : null;
                const reviewedName = record.accepted_by
                  ? actorNames.get(record.accepted_by)
                  : null;
                const photos = evidenceByGate.get(record.id) || [];
                const canAddPhotos =
                  !locked && !isQaReleased(record.status) && Boolean(gate);

                return (
                  <article
                    className={`qa-row ${locked ? "qa-row-locked" : ""}`}
                    key={record.id}
                  >
                    <div className="qa-row-main">
                      <div className="qa-gate-number">
                        {gate ? String(gate.order).padStart(2, "0") : "—"}
                      </div>
                      <div className="qa-gate-copy">
                        <div className="qa-gate-title">
                          <span className={`status-badge qa-${visualStatus}`}>
                            {visualStatus.replaceAll("_", " ")}
                          </span>
                          <strong>{record.hold_point}</strong>
                        </div>

                        {gate ? (
                          <>
                            <small>{gate.purpose}</small>
                            <small className="qa-evidence-copy">
                              Evidence: {gate.evidence}
                            </small>
                          </>
                        ) : null}

                        {record.notes ? (
                          <small className="qa-record-note">{record.notes}</small>
                        ) : null}

                        {record.completed_at ? (
                          <small>
                            Completed {localDateTime(record.completed_at)}
                            {completedName ? ` by ${completedName}` : ""}
                          </small>
                        ) : null}

                        {record.accepted_at ? (
                          <small>
                            Reviewed {localDateTime(record.accepted_at)}
                            {reviewedName ? ` by ${reviewedName}` : ""}
                          </small>
                        ) : null}

                        {previousGate ? (
                          <small className="qa-lock-copy">
                            Locked until Gate {previousGate.order} ·{" "}
                            {previousGate.label} is released.
                          </small>
                        ) : null}

                        <div className="qa-photo-evidence">
                          <div className="qa-photo-head">
                            <span>
                              Photo evidence
                              {gate?.photoRequired ? " · required" : " · optional"}
                            </span>
                            <strong>{photos.length}</strong>
                          </div>

                          {photos.length > 0 ? (
                            <div className="qa-photo-grid">
                              {photos.map((photo) =>
                                photo.signedUrl ? (
                                  <a
                                    key={photo.id}
                                    href={photo.signedUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={photo.file_name || "QA evidence photo"}
                                  >
                                    <img
                                      src={photo.signedUrl}
                                      alt={photo.file_name || `${record.hold_point} evidence`}
                                    />
                                    <span>{photo.file_name || "Evidence photo"}</span>
                                  </a>
                                ) : null
                              )}
                            </div>
                          ) : gate?.photoRequired ? (
                            <small className="qa-photo-required">
                              At least one photo is required before this gate can be completed.
                            </small>
                          ) : (
                            <small>No photos attached to this gate.</small>
                          )}

                          {canAddPhotos && gate ? (
                            <QaEvidenceUpload
                              projectId={id}
                              qaRecordId={record.id}
                              gateOrder={gate.order}
                              gateLabel={gate.label}
                            />
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="qa-actions">
                      {!locked &&
                      (record.status === "open" ||
                        record.status === "rejected") ? (
                        <div className="qa-open-actions">
                          <form
                            action={completeQaRecord}
                            className="inline-note-form"
                          >
                            <input
                              type="hidden"
                              name="project_id"
                              value={id}
                            />
                            <input
                              type="hidden"
                              name="record_id"
                              value={record.id}
                            />
                            <input
                              name="notes"
                              required={Boolean(gate?.noteRequired)}
                              placeholder={
                                gate?.noteRequired
                                  ? "Evidence / what was checked"
                                  : "Optional supporting note"
                              }
                            />
                            <button className="text-button" type="submit">
                              Complete gate
                            </button>
                          </form>

                          {canReview && gate?.allowNotApplicable ? (
                            <form action={reviewQaRecord}>
                              <input
                                type="hidden"
                                name="project_id"
                                value={id}
                              />
                              <input
                                type="hidden"
                                name="record_id"
                                value={record.id}
                              />
                              <input
                                type="hidden"
                                name="decision"
                                value="not_applicable"
                              />
                              <button className="text-button" type="submit">
                                Mark N/A
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ) : null}

                      {canReview && !locked && record.status === "complete" ? (
                        <div className="qa-review-actions">
                          <form action={reviewQaRecord}>
                            <input
                              type="hidden"
                              name="project_id"
                              value={id}
                            />
                            <input
                              type="hidden"
                              name="record_id"
                              value={record.id}
                            />
                            <input
                              type="hidden"
                              name="decision"
                              value="accepted"
                            />
                            <button className="text-button" type="submit">
                              Accept & release next gate
                            </button>
                          </form>

                          <form
                            action={reviewQaRecord}
                            className="inline-note-form qa-reject-form"
                          >
                            <input
                              type="hidden"
                              name="project_id"
                              value={id}
                            />
                            <input
                              type="hidden"
                              name="record_id"
                              value={record.id}
                            />
                            <input
                              type="hidden"
                              name="decision"
                              value="rejected"
                            />
                            <input
                              name="review_note"
                              required
                              placeholder="Why is this rejected?"
                            />
                            <button
                              className="text-button danger-text"
                              type="submit"
                            >
                              Reject
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty-state compact-empty">
            <strong>QA gates not set up yet.</strong>
            <p>
              Start the standard ResinSpec sequence. Once live, a later gate
              cannot be released before the earlier critical stage is accepted.
            </p>
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
          ) : (
            <p className="qa-support-note">
              Gate 4 requires moisture, ambient temperature, slab temperature
              and relative humidity readings before release.
            </p>
          )}
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
              <input
                name="product"
                required
                placeholder="Primer / body coat / topcoat"
              />
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
                <input
                  name="mix_duration_seconds"
                  type="number"
                  min="0"
                  step="1"
                />
              </label>
              <label className="field">
                <span>Coverage m²</span>
                <input
                  name="coverage_area_m2"
                  type="number"
                  min="0"
                  step="0.01"
                />
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
          ) : (
            <p className="qa-support-note">
              Gate 6 cannot be released until at least one batch / mix record
              exists for the job.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
