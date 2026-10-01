import Link from "next/link";
import { createTechnicalSystem } from "./actions";
import { requireAnyPermission } from "@/lib/access";
import { TechnicalSystemFields } from "@/components/technical-system-fields";

type NewTechnicalPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewTechnicalPage({
  searchParams,
}: NewTechnicalPageProps) {
  await requireAnyPermission(["technical:edit"]);
  const { error } = await searchParams;

  return (
    <div className="standalone-page narrow-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Controlled technical data</p>
          <h1>New system</h1>
          <p>
            Every new system starts as Draft. Add only verified manufacturer or
            training information, then approve the revision once checked.
          </p>
        </div>
        <Link className="secondary-button" href="/technical">
          Cancel
        </Link>
      </section>

      <form action={createTechnicalSystem} className="form-card">
        {error ? <p className="form-error">{error}</p> : null}

        <TechnicalSystemFields />

        <div className="form-actions">
          <Link className="secondary-button" href="/technical">
            Cancel
          </Link>
          <button className="primary-button" type="submit">
            Create draft
          </button>
        </div>
      </form>
    </div>
  );
}
