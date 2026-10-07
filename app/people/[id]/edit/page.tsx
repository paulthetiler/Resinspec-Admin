import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/access";
import { can } from "@/lib/permissions";
import { updatePerson } from "./actions";

type EditPersonPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditPersonPage({
  params,
  searchParams,
}: EditPersonPageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, role } = await requireAnyPermission(["people:manage"]);
  const showCommercial = can(role, "financials:view");

  const { data: person } = await supabase
    .from("people")
    .select("*")
    .eq("id", id)
    .single();

  if (!person) notFound();

  const commercial = showCommercial
    ? (
        await supabase
          .from("people_commercials")
          .select("*")
          .eq("person_id", id)
          .maybeSingle()
      ).data
    : null;

  return (
    <div className="standalone-page narrow-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Workforce record</p>
          <h1>Edit {person.full_name}</h1>
          <p>
            Update the actual workforce record here. App-access permissions are
            managed separately on the person page.
          </p>
        </div>
        <Link className="secondary-button" href={`/people/${id}`}>
          Cancel
        </Link>
      </section>

      <form action={updatePerson} className="form-card">
        <input type="hidden" name="person_id" value={id} />

        {error ? <p className="form-error page-error">{error}</p> : null}

        <div className="form-grid">
          <label className="field field-wide">
            <span>Name *</span>
            <input
              name="full_name"
              required
              defaultValue={person.full_name}
            />
          </label>

          <label className="field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              defaultValue={person.email ?? ""}
            />
          </label>

          <label className="field">
            <span>Phone</span>
            <input
              name="phone"
              inputMode="tel"
              defaultValue={person.phone ?? ""}
            />
          </label>

          <label className="field">
            <span>Engagement</span>
            <select
              name="engagement_type"
              defaultValue={person.engagement_type}
            >
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
              list="person-role-options"
              defaultValue={person.primary_role ?? ""}
              placeholder="Installer / lead installer / supervisor"
            />
            <datalist id="person-role-options">
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
            <input
              name="cscs_expiry"
              type="date"
              defaultValue={person.cscs_expiry ?? ""}
            />
          </label>

          <label className="field">
            <span>Insurance expiry</span>
            <input
              name="insurance_expiry"
              type="date"
              defaultValue={person.insurance_expiry ?? ""}
            />
          </label>

          <label className="check-row field-wide person-active-toggle">
            <input
              name="active"
              type="checkbox"
              defaultChecked={person.active}
            />
            <span>Active workforce record</span>
          </label>


          <div className="section-divider field-wide">
            <span>Subcontractor / CIS compliance</span>
          </div>

          <label className="field"><span>Trading name</span><input name="trading_name" defaultValue={person.trading_name ?? ""} /></label>
          <label className="field"><span>UTR</span><input name="utr" inputMode="numeric" autoComplete="off" defaultValue={person.utr ?? ""} /></label>
          <label className="field"><span>NI number</span><input name="ni_number" autoComplete="off" defaultValue={person.ni_number ?? ""} /></label>
          <label className="field"><span>Company number</span><input name="company_number" defaultValue={person.company_number ?? ""} /></label>
          <label className="field"><span>CIS verification number</span><input name="cis_verification_number" defaultValue={person.cis_verification_number ?? ""} /></label>
          <label className="field"><span>CIS deduction rate</span><select name="cis_deduction_rate" defaultValue={person.cis_deduction_rate ?? ""}><option value="">Not verified</option><option value="0">0% — gross</option><option value="20">20% — standard</option><option value="30">30% — higher</option></select></label>
          <label className="field"><span>CIS verified on</span><input name="cis_verified_on" type="date" defaultValue={person.cis_verified_on ?? ""} /></label>
          <label className="field"><span>Status checked on</span><input name="status_checked_on" type="date" defaultValue={person.status_checked_on ?? ""} /></label>
          <label className="field"><span>Employment-status outcome</span><select name="status_outcome" defaultValue={person.status_outcome ?? ""}><option value="">Not checked</option><option value="self_employed">Self-employed</option><option value="employed">Employee</option><option value="undetermined">Undetermined</option><option value="review_required">Review required</option></select><small>Record the real working arrangement. CIS registration alone does not decide status.</small></label>
          <label className="field"><span>Subcontract agreement signed</span><input name="contract_signed_on" type="date" defaultValue={person.contract_signed_on ?? ""} /></label>
          <label className="field field-wide"><span>Contractor / status notes</span><textarea name="contractor_notes" rows={3} defaultValue={person.contractor_notes ?? ""} /></label>

          <label className="field field-wide">
            <span>Training / competence notes</span>
            <textarea
              name="training_notes"
              rows={4}
              defaultValue={person.training_notes ?? ""}
              placeholder="Systems trained on, practical sign-off, tickets..."
            />
          </label>

          <label className="field field-wide">
            <span>Operational notes</span>
            <textarea
              name="operational_notes"
              rows={3}
              defaultValue={person.operational_notes ?? ""}
            />
          </label>

          {showCommercial ? (
            <>
              <div className="section-divider field-wide">
                <span>Restricted commercial</span>
              </div>

              <label className="field">
                <span>Day rate £</span>
                <input
                  name="day_rate"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={commercial?.day_rate ?? ""}
                />
              </label>

              <label className="field">
                <span>Hourly rate £</span>
                <input
                  name="hourly_rate"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={commercial?.hourly_rate ?? ""}
                />
              </label>

              <label className="field">
                <span>Mileage rate £ / mile</span>
                <input
                  name="mileage_rate"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={commercial?.mileage_rate ?? ""}
                />
              </label>

              <label className="field">
                <span>Working-away allowance £</span>
                <input
                  name="working_away_allowance"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={commercial?.working_away_allowance ?? ""}
                />
              </label>

              <label className="field field-wide">
                <span>Commercial / pay notes</span>
                <textarea
                  name="commercial_notes"
                  rows={3}
                  defaultValue={commercial?.commercial_notes ?? ""}
                  placeholder="e.g. £230/day lead rate, hotel paid direct, meals included..."
                />
              </label>
            </>
          ) : null}
        </div>

        <div className="form-actions">
          <Link className="secondary-button" href={`/people/${id}`}>
            Cancel
          </Link>
          <button className="primary-button" type="submit">
            Save person
          </button>
        </div>
      </form>
    </div>
  );
}
