import Link from "next/link";
import { createPerson } from "./actions";
import { requireAnyPermission } from "@/lib/access";
import { can } from "@/lib/permissions";

type NewPersonPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewPersonPage({
  searchParams,
}: NewPersonPageProps) {
  const { role } = await requireAnyPermission(["people:manage"]);
  const { error } = await searchParams;
  const showCommercial = can(role, "financials:view");

  return (
    <div className="standalone-page narrow-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Workforce record</p>
          <h1>Add person</h1>
          <p>
            Add the operational record first. A login can be linked later if they need app access.
          </p>
        </div>
        <Link className="secondary-button" href="/people">
          Cancel
        </Link>
      </section>

      <form action={createPerson} className="form-card">
        {error ? <p className="form-error">{error}</p> : null}

        <div className="form-grid">
          <label className="field field-wide">
            <span>Name *</span>
            <input name="full_name" required />
          </label>

          <label className="field">
            <span>Email</span>
            <input name="email" type="email" />
          </label>

          <label className="field">
            <span>Phone</span>
            <input name="phone" inputMode="tel" />
          </label>

          <label className="field">
            <span>Engagement</span>
            <select name="engagement_type" defaultValue="subcontractor">
              <option value="subcontractor">Subcontractor</option>
              <option value="employee">Employee</option>
              <option value="agency">Agency</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="field">
            <span>Primary role</span>
            <input
              name="primary_role"
              list="new-person-role-options"
              placeholder="Installer / lead installer / supervisor"
            />
            <datalist id="new-person-role-options">
              <option value="Installer" />
              <option value="Lead installer" />
              <option value="Supervisor" />
              <option value="Installer / supervisor" />
              <option value="Labourer / helper" />
              <option value="Surveyor" />
            </datalist>
          </label>

          <label className="field">
            <span>CSCS expiry</span>
            <input name="cscs_expiry" type="date" />
          </label>

          <label className="field">
            <span>Insurance expiry</span>
            <input name="insurance_expiry" type="date" />
          </label>


          <div className="section-divider field-wide">
            <span>Subcontractor / CIS compliance</span>
          </div>

          <label className="field"><span>Trading name</span><input name="trading_name" placeholder="e.g. Steve's Contract Services" /></label>
          <label className="field"><span>UTR</span><input name="utr" inputMode="numeric" autoComplete="off" /></label>
          <label className="field"><span>NI number</span><input name="ni_number" autoComplete="off" /></label>
          <label className="field"><span>Company number</span><input name="company_number" /></label>
          <label className="field"><span>CIS verification number</span><input name="cis_verification_number" /></label>
          <label className="field"><span>CIS deduction rate</span><select name="cis_deduction_rate" defaultValue=""><option value="">Not verified</option><option value="0">0% — gross</option><option value="20">20% — standard</option><option value="30">30% — higher</option></select></label>
          <label className="field"><span>CIS verified on</span><input name="cis_verified_on" type="date" /></label>
          <label className="field"><span>Status checked on</span><input name="status_checked_on" type="date" /></label>
          <label className="field"><span>Employment-status outcome</span><select name="status_outcome" defaultValue=""><option value="">Not checked</option><option value="self_employed">Self-employed</option><option value="employed">Employee</option><option value="undetermined">Undetermined</option><option value="review_required">Review required</option></select><small>Record the real working arrangement. CIS registration alone does not decide status.</small></label>
          <label className="field"><span>Subcontract agreement signed</span><input name="contract_signed_on" type="date" /></label>
          <label className="field field-wide"><span>Contractor / status notes</span><textarea name="contractor_notes" rows={3} placeholder="Project-based engagement, ability to accept/decline work, own business costs, rectification responsibility, CEST reference/notes..." /></label>

          <label className="field field-wide">
            <span>Training / competence notes</span>
            <textarea name="training_notes" rows={4} placeholder="Systems trained on, practical sign-off, tickets..." />
          </label>

          <label className="field field-wide">
            <span>Operational notes</span>
            <textarea name="operational_notes" rows={3} />
          </label>

          {showCommercial ? (
            <>
              <div className="section-divider field-wide">
                <span>Restricted commercial</span>
              </div>

              <label className="field">
                <span>Day rate £</span>
                <input name="day_rate" type="number" min="0" step="0.01" />
              </label>

              <label className="field">
                <span>Hourly rate £</span>
                <input name="hourly_rate" type="number" min="0" step="0.01" />
              </label>

              <label className="field">
                <span>Mileage rate £ / mile</span>
                <input name="mileage_rate" type="number" min="0" step="0.01" />
              </label>

              <label className="field">
                <span>Working-away allowance £</span>
                <input name="working_away_allowance" type="number" min="0" step="0.01" />
              </label>

              <label className="field field-wide">
                <span>Commercial / pay notes</span>
                <textarea
                  name="commercial_notes"
                  rows={3}
                  placeholder="e.g. £230/day lead rate, hotel paid direct, meals included..."
                />
              </label>
            </>
          ) : null}
        </div>

        <div className="form-actions">
          <Link className="secondary-button" href="/people">
            Cancel
          </Link>
          <button className="primary-button" type="submit">
            Add person
          </button>
        </div>
      </form>
    </div>
  );
}
