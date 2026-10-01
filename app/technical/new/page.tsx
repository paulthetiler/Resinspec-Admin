import Link from "next/link";
import { createTechnicalSystem } from "./actions";
import { requireAnyPermission } from "@/lib/access";

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
          <h1>New system revision</h1>
          <p>
            Only put manufacturer-confirmed data here. Draft first; approve once the system and application limits are verified.
          </p>
        </div>
        <Link className="secondary-button" href="/technical">
          Cancel
        </Link>
      </section>

      <form action={createTechnicalSystem} className="form-card">
        {error ? <p className="form-error">{error}</p> : null}

        <div className="form-grid">
          <label className="field">
            <span>System code *</span>
            <input name="code" required placeholder="PUC-06" />
          </label>

          <label className="field">
            <span>Revision *</span>
            <input name="revision" type="number" min="1" step="1" defaultValue="1" required />
          </label>

          <label className="field field-wide">
            <span>System name *</span>
            <input name="name" required placeholder="6 mm PU cement heavy duty" />
          </label>

          <label className="field">
            <span>Manufacturer</span>
            <input name="manufacturer" placeholder="Manufacturer / supplier" />
          </label>

          <label className="field">
            <span>Category</span>
            <input name="category" placeholder="PU cement / epoxy / MMA / coating" />
          </label>

          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="retired">Retired</option>
            </select>
          </label>

          <label className="field">
            <span>Nominal thickness mm</span>
            <input name="nominal_thickness_mm" type="number" min="0" step="0.1" />
          </label>

          <label className="field">
            <span>Slip rating</span>
            <input name="slip_rating" placeholder="e.g. R11 / PTV value" />
          </label>

          <label className="field">
            <span>Thickness notes</span>
            <input name="thickness" placeholder="Permitted build / variation" />
          </label>

          <label className="field field-wide">
            <span>Substrate requirements</span>
            <textarea name="substrate_requirements" rows={4} placeholder="Strength, moisture, contamination, preparation standard..." />
          </label>

          <label className="field">
            <span>Primer</span>
            <textarea name="primer" rows={3} placeholder="Product and application detail" />
          </label>

          <label className="field">
            <span>Body coat</span>
            <textarea name="body_coat" rows={3} placeholder="Product and application detail" />
          </label>

          <label className="field">
            <span>Broadcast</span>
            <textarea name="broadcast" rows={3} placeholder="Aggregate / broadcast detail" />
          </label>

          <label className="field">
            <span>Topcoat</span>
            <textarea name="topcoat" rows={3} placeholder="Product and application detail" />
          </label>

          <label className="field field-wide">
            <span>Mixing instructions</span>
            <textarea name="mixing_instructions" rows={5} placeholder="Exact components, ratios, mixing time, sequence and constraints" />
          </label>

          <label className="field">
            <span>Coverage</span>
            <textarea name="coverage_notes" rows={3} />
          </label>

          <label className="field">
            <span>Pot life</span>
            <textarea name="pot_life_notes" rows={3} />
          </label>

          <label className="field">
            <span>Cure / recoat</span>
            <textarea name="cure_notes" rows={3} />
          </label>

          <label className="field">
            <span>Temperature</span>
            <textarea name="temperature_notes" rows={3} />
          </label>

          <label className="field field-wide">
            <span>Application limits</span>
            <textarea name="application_limits" rows={4} placeholder="Moisture, dew point, temperature, overcoat window, wet-edge constraints..." />
          </label>

          <label className="field field-wide">
            <span>Chemical / service notes</span>
            <textarea name="chemical_notes" rows={3} />
          </label>

          <label className="field">
            <span>TDS reference</span>
            <input name="tds_reference" placeholder="Document / URL reference" />
          </label>

          <label className="field">
            <span>SDS reference</span>
            <input name="sds_reference" placeholder="Document / URL reference" />
          </label>
        </div>

        <div className="form-actions">
          <Link className="secondary-button" href="/technical">
            Cancel
          </Link>
          <button className="primary-button" type="submit">
            Save system
          </button>
        </div>
      </form>
    </div>
  );
}
