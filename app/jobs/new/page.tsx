import Link from "next/link";
import { createProject } from "./actions";
import { requireAnyPermission } from "@/lib/access";
import { ProjectStatusNextAction } from "@/app/jobs/components/project-status-next-action";

type NewProjectPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewProjectPage({
  searchParams,
}: NewProjectPageProps) {
  await requireAnyPermission(["jobs:edit"]);
  const { error } = await searchParams;

  return (
    <div className="standalone-page narrow-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Project control</p>
          <h1>New project</h1>
          <p>
            Start with the essentials. Client, survey, technical and commercial records can then attach to this job.
          </p>
        </div>
        <Link className="secondary-button" href="/jobs">
          Cancel
        </Link>
      </section>

      <form action={createProject} className="form-card">
        {error ? <p className="form-error">{error}</p> : null}

        <div className="form-grid">
          <label className="field field-wide">
            <span>Project title *</span>
            <input name="title" required placeholder="e.g. Manchester food production floor" />
          </label>

          <ProjectStatusNextAction initialStatus="lead" />

          <label className="field">
            <span>Area m²</span>
            <input name="area_m2" type="number" step="0.01" min="0" placeholder="420" />
          </label>

          <label className="field">
            <span>Programme start</span>
            <input name="programme_start" type="date" />
          </label>

          <label className="field">
            <span>Programme finish</span>
            <input name="programme_end" type="date" />
          </label>

          <label className="field field-wide">
            <span>Scope summary</span>
            <textarea
              name="scope_summary"
              rows={5}
              placeholder="What is ResinSpec being asked to deliver?"
            />
          </label>
        </div>

        <div className="form-actions">
          <Link className="secondary-button" href="/jobs">
            Cancel
          </Link>
          <button className="primary-button" type="submit">
            Create project
          </button>
        </div>
      </form>
    </div>
  );
}
