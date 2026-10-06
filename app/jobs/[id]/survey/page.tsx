import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/lib/permissions";
import { requireAnyPermission } from "@/lib/access";
import { SurveyEvidenceUpload } from "@/components/survey-evidence-upload";
import { completeSurvey, reviewSurvey, saveSurvey } from "./actions";

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
        <Link className="secondary-button" href={`/jobs/${id}`}>
          Back to job
        </Link>
      </section>

      {error ? <p className="form-error page-error">{error}</p> : null}
      {saved ? <p className="form-success page-error">Survey saved.</p> : null}

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

          <label className="field field-wide">
            <span>Substrate condition</span>
            <textarea
              name="substrate_condition"
              rows={3}
              defaultValue={survey?.substrate_condition ?? ""}
            />
          </label>

          <label className="field field-wide">
            <span>Contamination</span>
            <textarea
              name="contamination_notes"
              rows={3}
              defaultValue={survey?.contamination_notes ?? ""}
              placeholder="Oil, grease, chemicals, laitance, unknown coatings..."
            />
          </label>

          <label className="field field-wide">
            <span>Cracks / movement joints</span>
            <textarea
              name="cracks_and_joints"
              rows={3}
              defaultValue={survey?.cracks_and_joints ?? ""}
            />
          </label>

          <label className="field field-wide">
            <span>Preparation approach</span>
            <textarea
              name="preparation_notes"
              rows={4}
              defaultValue={survey?.preparation_notes ?? ""}
              placeholder="Grinding / shot blast / scabble / repairs / removal..."
            />
          </label>

          <div className="section-divider field-wide">
            <span>Moisture & environment</span>
          </div>

          <label className="field">
            <span>Moisture test method</span>
            <input
              name="moisture_test_method"
              defaultValue={survey?.moisture_test_method ?? ""}
            />
          </label>

          <label className="field">
            <span>Moisture summary</span>
            <input
              name="moisture_summary"
              defaultValue={survey?.moisture_summary ?? ""}
            />
          </label>

          <label className="field field-wide">
            <span>Falls / drainage</span>
            <textarea
              name="falls_and_drainage"
              rows={3}
              defaultValue={survey?.falls_and_drainage ?? ""}
            />
          </label>

          <div className="section-divider field-wide">
            <span>Site logistics</span>
          </div>

          <label className="field field-wide">
            <span>Access constraints</span>
            <textarea
              name="access_constraints"
              rows={3}
              defaultValue={survey?.access_constraints ?? ""}
            />
          </label>

          <label className="field">
            <span>Power / water</span>
            <textarea
              name="power_and_water"
              rows={3}
              defaultValue={survey?.power_and_water ?? ""}
            />
          </label>

          <label className="field">
            <span>Downtime window</span>
            <textarea
              name="downtime_window"
              rows={3}
              defaultValue={survey?.downtime_window ?? ""}
            />
          </label>

          <label className="field field-wide">
            <span>Programme constraints</span>
            <textarea
              name="programme_constraints"
              rows={3}
              defaultValue={survey?.programme_constraints ?? ""}
            />
          </label>

          <div className="section-divider field-wide">
            <span>Service requirements</span>
          </div>

          <label className="field field-wide">
            <span>Service conditions</span>
            <textarea
              name="service_conditions"
              rows={3}
              defaultValue={survey?.service_conditions ?? ""}
              placeholder="Traffic, impact, forklift use, wet service, continuous use..."
            />
          </label>

          <label className="field">
            <span>Slip requirement</span>
            <textarea
              name="slip_requirement"
              rows={3}
              defaultValue={survey?.slip_requirement ?? ""}
            />
          </label>

          <label className="field">
            <span>Hygiene requirement</span>
            <textarea
              name="hygiene_requirement"
              rows={3}
              defaultValue={survey?.hygiene_requirement ?? ""}
            />
          </label>

          <label className="field">
            <span>Washdown requirement</span>
            <textarea
              name="washdown_requirement"
              rows={3}
              defaultValue={survey?.washdown_requirement ?? ""}
            />
          </label>

          <label className="field">
            <span>Thermal exposure</span>
            <textarea
              name="thermal_exposure"
              rows={3}
              defaultValue={survey?.thermal_exposure ?? ""}
              placeholder="Hot wash, steam, ovens, freezer transition..."
            />
          </label>

          <label className="field field-wide">
            <span>Chemical exposure</span>
            <textarea
              name="chemical_exposure"
              rows={3}
              defaultValue={survey?.chemical_exposure ?? ""}
            />
          </label>

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
