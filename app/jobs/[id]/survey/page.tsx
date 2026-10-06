import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/access";
import { SurveyEvidenceUpload } from "@/components/survey-evidence-upload";
import { QuickEntryField } from "@/components/quick-entry-field";
import { completeSurvey, reviewSurvey, saveSurvey } from "./actions";

function localDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

type SurveyPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    completed?: string;
    released?: string;
    blocked?: string;
  }>;
};

export default async function SurveyPage({
  params,
  searchParams,
}: SurveyPageProps) {
  const { id } = await params;
  const { error, saved, completed, released, blocked } = await searchParams;
  const { supabase, role } = await requireAnyPermission(["survey:view"]);

  const [{ data: project }, { data: survey }, { data: photos }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, reference, title, area_m2, sites(name, town_city, postcode)")
      .eq("id", id)
      .single(),
    supabase
      .from("surveys")
      .select("*")
      .eq("project_id", id)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("id, survey_id, file_name, storage_path, created_at")
      .eq("project_id", id)
      .eq("document_type", "photo")
      .in("status", ["complete", "approved"])
      .not("survey_id", "is", null)
      .order("created_at", { ascending: true }),
  ]);

  if (!project) notFound();

  const site = Array.isArray(project.sites) ? project.sites[0] : project.sites;
  const editable = can(role, "survey:edit");
  const canReview = role === "owner" || role === "supervisor";

  const signedPhotos = await Promise.all(
    (photos || [])
      .filter((photo) => !survey || photo.survey_id === survey.id)
      .map(async (photo) => {
        if (!photo.storage_path) return { ...photo, signedUrl: null };

        const { data } = await supabase.storage
          .from("project-documents")
          .createSignedUrl(photo.storage_path, 60 * 60);

        return { ...photo, signedUrl: data?.signedUrl ?? null };
      })
  );

  const actorIds = Array.from(
    new Set(
      [
        survey?.surveyed_by,
        survey?.completed_by,
        survey?.reviewed_by,
        survey?.released_by,
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
      (actors || []).map((actor) => [actor.id, actor.full_name || "Team member"])
    );
  }

  const releaseStatus = survey?.release_status || "draft";

  if (!editable) {
    return (
      <div className="standalone-page">
        <section className="page-heading">
          <div>
            <p className="eyebrow">{project.reference} · survey</p>
            <h1>{project.title}</h1>
            <p>
              {site?.name || "Site not added"}
              {site?.town_city ? ` · ${site.town_city}` : ""}
            </p>
          </div>
          <Link className="secondary-button" href={`/jobs/${id}`}>
            Back to job
          </Link>
        </section>

        {!survey ? (
          <section className="panel">
            <div className="empty-state">
              <strong>No survey recorded yet.</strong>
              <p>This job has not yet had a technical survey saved.</p>
            </div>
          </section>
        ) : (
          <div className="two-column">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Substrate</p>
                  <h2>Survey summary</h2>
                </div>
              </div>
              <dl className="detail-list">
                <div><dt>Substrate</dt><dd>{survey.substrate_type || "—"}</dd></div>
                <div><dt>Condition</dt><dd>{survey.substrate_condition || "—"}</dd></div>
                <div><dt>Contamination</dt><dd>{survey.contamination_notes || "—"}</dd></div>
                <div><dt>Cracks / joints</dt><dd>{survey.cracks_and_joints || "—"}</dd></div>
                <div><dt>Moisture</dt><dd>{survey.moisture_summary || "—"}</dd></div>
              </dl>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Service</p>
                  <h2>Requirements</h2>
                </div>
              </div>
              <dl className="detail-list">
                <div><dt>Slip</dt><dd>{survey.slip_requirement || "—"}</dd></div>
                <div><dt>Hygiene</dt><dd>{survey.hygiene_requirement || "—"}</dd></div>
                <div><dt>Washdown</dt><dd>{survey.washdown_requirement || "—"}</dd></div>
                <div><dt>Thermal</dt><dd>{survey.thermal_exposure || "—"}</dd></div>
                <div><dt>Chemical</dt><dd>{survey.chemical_exposure || "—"}</dd></div>
              </dl>
            </section>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="standalone-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{project.reference} · technical survey</p>
          <h1>{project.title}</h1>
          <p>
            {site?.name || "Site not added"}
            {site?.town_city ? ` · ${site.town_city}` : ""}
            {project.area_m2 ? ` · ${project.area_m2} m²` : ""}
          </p>
        </div>
        <div className="heading-actions">
          <Link className="secondary-button" href={`/jobs/${id}/prestart`}>
            Pre-start
          </Link>
          <Link className="secondary-button" href={`/jobs/${id}`}>
            Back to job
          </Link>
        </div>
      </section>

      {error ? <p className="form-error page-error">{error}</p> : null}
      {saved ? (
        <p className="form-success page-error">
          Survey saved. Any previous technical release has been reset for review.
        </p>
      ) : null}
      {completed ? (
        <p className="form-success page-error">
          Survey completed and ready for technical review.
        </p>
      ) : null}
      {released ? (
        <p className="form-success page-error">
          Technical survey released for pre-start.
        </p>
      ) : null}
      {blocked ? (
        <p className="form-error page-error">
          Survey blocked. Resolve the review note, save the survey and complete it again.
        </p>
      ) : null}

      <section className="survey-control-grid">
        <article className="panel survey-release-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Survey control</p>
              <h2>Technical release</h2>
            </div>
            <span className={`status-badge survey-${releaseStatus}`}>
              {releaseStatus.replaceAll("_", " ")}
            </span>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Technical outcome</dt>
              <dd>{survey?.technical_outcome?.replaceAll("_", " ") || "Review"}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>
                {localDateTime(survey?.completed_at)}
                {survey?.completed_by
                  ? ` · ${actorNames.get(survey.completed_by) || "Team member"}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>Reviewed</dt>
              <dd>
                {localDateTime(survey?.reviewed_at)}
                {survey?.reviewed_by
                  ? ` · ${actorNames.get(survey.reviewed_by) || "Team member"}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>Review note</dt>
              <dd>{survey?.review_note || "—"}</dd>
            </div>
          </dl>

          {survey && ["draft", "blocked"].includes(releaseStatus) ? (
            <form action={completeSurvey} className="survey-control-action">
              <input type="hidden" name="project_id" value={id} />
              <button className="primary-button" type="submit">
                Complete survey
              </button>
              <small>
                Requires every technical field to be answered and at least 3 survey photos.
                Use N/A instead of leaving a condition assumed.
              </small>
            </form>
          ) : null}

          {survey && releaseStatus === "complete" && canReview ? (
            <div className="survey-review-actions">
              <form action={reviewSurvey}>
                <input type="hidden" name="project_id" value={id} />
                <input type="hidden" name="decision" value="released" />
                <button className="primary-button" type="submit">
                  Release for pre-start
                </button>
              </form>

              <form action={reviewSurvey} className="compact-form">
                <input type="hidden" name="project_id" value={id} />
                <input type="hidden" name="decision" value="blocked" />
                <label className="field">
                  <span>Block / review note</span>
                  <input
                    name="review_note"
                    required
                    placeholder="What must be resolved?"
                  />
                </label>
                <button className="secondary-button" type="submit">
                  Block survey
                </button>
              </form>
            </div>
          ) : null}

          {survey && releaseStatus === "complete" && !canReview ? (
            <p className="qa-support-note">
              Survey complete. Owner or supervisor technical release required.
            </p>
          ) : null}
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Site evidence</p>
              <h2>Survey photos</h2>
            </div>
            <span className="count-badge">{signedPhotos.length}</span>
          </div>

          {signedPhotos.length > 0 ? (
            <div className="survey-photo-grid">
              {signedPhotos.map((photo) =>
                photo.signedUrl ? (
                  <a
                    key={photo.id}
                    href={photo.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={photo.file_name || "Survey evidence"}
                  >
                    <img
                      src={photo.signedUrl}
                      alt={photo.file_name || "Survey evidence"}
                    />
                    <span>{photo.file_name || "Survey evidence"}</span>
                  </a>
                ) : null
              )}
            </div>
          ) : (
            <p className="qa-support-note">
              Add clear overall, substrate/detail and site/logistics photos. Three are required before completion.
            </p>
          )}

          {survey && releaseStatus !== "released" ? (
            <SurveyEvidenceUpload projectId={id} surveyId={survey.id} />
          ) : survey && releaseStatus === "released" ? (
            <p className="qa-support-note">
              Released survey evidence is frozen. Save an amended survey first if new evidence must be added.
            </p>
          ) : (
            <p className="qa-support-note">
              Save the survey once before adding evidence photos.
            </p>
          )}
        </article>
      </section>

      <form action={saveSurvey} className="form-card">
        <input type="hidden" name="project_id" value={id} />

        <div className="form-grid">
          <label className="field">
            <span>Survey date</span>
            <input
              name="survey_date"
              type="date"
              defaultValue={survey?.survey_date ?? ""}
            />
          </label>

          <label className="field">
            <span>Technical outcome</span>
            <select
              name="technical_outcome"
              defaultValue={survey?.technical_outcome ?? "review"}
            >
              <option value="review">Review</option>
              <option value="suitable">Suitable</option>
              <option value="further_testing">Further testing</option>
              <option value="manufacturer_review">Manufacturer review</option>
              <option value="decline">Decline</option>
            </select>
          </label>

          <div className="section-divider field-wide">
            <span>Substrate & preparation</span>
          </div>

          <label className="field">
            <span>Substrate type</span>
            <input
              name="substrate_type"
              defaultValue={survey?.substrate_type ?? ""}
              placeholder="Concrete / screed / tiles / resin..."
            />
          </label>

          <label className="field">
            <span>Existing finish</span>
            <input
              name="existing_finish"
              defaultValue={survey?.existing_finish ?? ""}
            />
          </label>

          <QuickEntryField
            name="substrate_condition"
            label="Substrate condition"
            defaultValue={survey?.substrate_condition}
            wide
            options={[
              "Sound / good condition",
              "Minor defects",
              "Poor / extensive defects",
              "Uneven / damaged",
              "Further investigation required",
              "N/A",
            ]}
            placeholder="Tap a common answer or add a short site note."
          />

          <QuickEntryField
            name="contamination_notes"
            label="Contamination"
            defaultValue={survey?.contamination_notes}
            wide
            multi
            options={[
              "None visible",
              "Oil / grease",
              "Chemical contamination",
              "Laitance",
              "Unknown coating",
              "Further testing required",
              "N/A",
            ]}
            placeholder="Tap what applies. Add detail only where needed."
          />

          <QuickEntryField
            name="cracks_and_joints"
            label="Cracks / movement joints"
            defaultValue={survey?.cracks_and_joints}
            wide
            multi
            options={[
              "None visible",
              "Hairline cracks",
              "Cracks require repair",
              "Movement joints present",
              "Joints need detailing",
              "Further investigation required",
              "N/A",
            ]}
          />

          <QuickEntryField
            name="preparation_notes"
            label="Preparation approach"
            defaultValue={survey?.preparation_notes}
            wide
            multi
            rows={3}
            options={[
              "Diamond grind",
              "Shot blast",
              "Scabble",
              "Existing coating removal",
              "Crack / defect repairs",
              "Edge detailing",
              "Final industrial vacuum",
              "Manufacturer review required",
            ]}
            placeholder="Select the expected prep and edit if the job needs something different."
          />

          <div className="section-divider field-wide">
            <span>Moisture & environment</span>
          </div>

          <QuickEntryField
            name="moisture_test_method"
            label="Moisture test method"
            defaultValue={survey?.moisture_test_method}
            rows={2}
            options={[
              "RH test",
              "Moisture meter screening",
              "Carbide / CM test",
              "Manufacturer-specified test",
              "Further test required",
              "N/A",
            ]}
          />

          <QuickEntryField
            name="moisture_summary"
            label="Moisture summary"
            defaultValue={survey?.moisture_summary}
            rows={2}
            options={[
              "Within system limit",
              "Elevated / not accepted",
              "DPM may be required",
              "Further testing required",
              "Result pending",
              "N/A",
            ]}
          />

          <QuickEntryField
            name="falls_and_drainage"
            label="Falls / drainage"
            defaultValue={survey?.falls_and_drainage}
            wide
            multi
            options={[
              "No drainage requirement",
              "Existing falls acceptable",
              "Falls require correction",
              "Drains / gullies present",
              "Drain detailing required",
              "N/A",
            ]}
          />

          <div className="section-divider field-wide">
            <span>Site logistics</span>
          </div>

          <QuickEntryField
            name="access_constraints"
            label="Access constraints"
            defaultValue={survey?.access_constraints}
            wide
            multi
            options={[
              "Good unrestricted access",
              "Restricted access",
              "Loading / delivery restrictions",
              "Stairs / lift access",
              "Live occupied site",
              "Permit / induction required",
              "N/A",
            ]}
          />

          <QuickEntryField
            name="power_and_water"
            label="Power / water"
            defaultValue={survey?.power_and_water}
            rows={2}
            multi
            options={[
              "Power available",
              "Water available",
              "110V required",
              "Temporary supply required",
              "Supply location TBC",
              "N/A",
            ]}
          />

          <QuickEntryField
            name="downtime_window"
            label="Downtime window"
            defaultValue={survey?.downtime_window}
            rows={2}
            options={[
              "Flexible",
              "Overnight only",
              "Weekend shutdown",
              "24-hour window",
              "48-hour window",
              "Exact return-to-service time required",
            ]}
          />

          <QuickEntryField
            name="programme_constraints"
            label="Programme constraints"
            defaultValue={survey?.programme_constraints}
            wide
            multi
            options={[
              "No unusual constraints",
              "Phased works",
              "Night work",
              "Weekend work",
              "Live site / work around others",
              "Fast return to service",
              "Client programme TBC",
            ]}
          />

          <div className="section-divider field-wide">
            <span>Service requirements</span>
          </div>

          <QuickEntryField
            name="service_conditions"
            label="Service conditions"
            defaultValue={survey?.service_conditions}
            wide
            multi
            options={[
              "Pedestrian traffic",
              "Trolleys / pallet trucks",
              "Forklift traffic",
              "Heavy impact",
              "Wet service",
              "Continuous operation",
              "Food / production area",
            ]}
            placeholder="Tap all that apply, then add anything unusual."
          />

          <QuickEntryField
            name="slip_requirement"
            label="Slip requirement"
            defaultValue={survey?.slip_requirement}
            rows={2}
            options={[
              "Standard finish",
              "Enhanced anti-slip",
              "Wet-area high grip",
              "Client slip rating specified",
              "Requirement TBC",
              "N/A",
            ]}
          />

          <QuickEntryField
            name="hygiene_requirement"
            label="Hygiene requirement"
            defaultValue={survey?.hygiene_requirement}
            rows={2}
            options={[
              "Standard commercial",
              "Seamless hygienic finish",
              "Food production hygiene",
              "Healthcare / clean area",
              "Client hygiene spec applies",
              "N/A",
            ]}
          />

          <QuickEntryField
            name="washdown_requirement"
            label="Washdown requirement"
            defaultValue={survey?.washdown_requirement}
            rows={2}
            options={[
              "No washdown",
              "Routine wet cleaning",
              "Pressure washing",
              "Hot washdown",
              "Chemical cleaning",
              "Requirement TBC",
            ]}
          />

          <QuickEntryField
            name="thermal_exposure"
            label="Thermal exposure"
            defaultValue={survey?.thermal_exposure}
            rows={2}
            multi
            options={[
              "Ambient only",
              "Hot wash",
              "Steam",
              "Oven / hot process",
              "Freezer / cold store",
              "Thermal cycling",
              "N/A",
            ]}
          />

          <QuickEntryField
            name="chemical_exposure"
            label="Chemical exposure"
            defaultValue={survey?.chemical_exposure}
            wide
            multi
            options={[
              "None known",
              "Cleaning detergents",
              "Oils / fuels",
              "Acids / alkalis",
              "Food acids / sugars",
              "Client chemical list required",
              "Manufacturer review required",
            ]}
          />

          <label className="field field-wide">
            <span>Client requirements / notes</span>
            <textarea
              name="client_requirements"
              rows={4}
              defaultValue={survey?.client_requirements ?? ""}
            />
          </label>
        </div>

        <div className="form-actions">
          <Link className="secondary-button" href={`/jobs/${id}`}>
            Cancel
          </Link>
          <button className="primary-button" type="submit">
            Save survey
          </button>
        </div>
      </form>
    </div>
  );
}
