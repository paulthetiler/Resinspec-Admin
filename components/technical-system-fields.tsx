type TechnicalSystemValues = {
  code?: string | null;
  name?: string | null;
  manufacturer?: string | null;
  category?: string | null;
  substrate_requirements?: string | null;
  thickness?: string | null;
  nominal_thickness_mm?: number | string | null;
  primer?: string | null;
  body_coat?: string | null;
  broadcast?: string | null;
  topcoat?: string | null;
  mixing_instructions?: string | null;
  coverage_notes?: string | null;
  pot_life_notes?: string | null;
  cure_notes?: string | null;
  application_limits?: string | null;
  slip_rating?: string | null;
  temperature_notes?: string | null;
  chemical_notes?: string | null;
  tds_reference?: string | null;
  sds_reference?: string | null;
};

export function TechnicalSystemFields({
  system = {},
}: {
  system?: TechnicalSystemValues;
}) {
  return (
    <div className="form-grid">
      <label className="field">
        <span>System code *</span>
        <input name="code" required defaultValue={system.code ?? ""} />
      </label>

      <label className="field">
        <span>System name *</span>
        <input name="name" required defaultValue={system.name ?? ""} />
      </label>

      <label className="field">
        <span>Manufacturer</span>
        <input name="manufacturer" defaultValue={system.manufacturer ?? ""} />
      </label>

      <label className="field">
        <span>Category</span>
        <input name="category" defaultValue={system.category ?? ""} />
      </label>

      <label className="field">
        <span>Nominal thickness mm</span>
        <input
          name="nominal_thickness_mm"
          type="number"
          min="0"
          step="0.1"
          defaultValue={system.nominal_thickness_mm ?? ""}
        />
      </label>

      <label className="field">
        <span>Slip rating</span>
        <input name="slip_rating" defaultValue={system.slip_rating ?? ""} />
      </label>

      <label className="field field-wide">
        <span>Thickness notes</span>
        <input name="thickness" defaultValue={system.thickness ?? ""} />
      </label>

      <label className="field field-wide">
        <span>Substrate requirements</span>
        <textarea
          name="substrate_requirements"
          rows={4}
          defaultValue={system.substrate_requirements ?? ""}
        />
      </label>

      <div className="section-divider field-wide">
        <span>System build</span>
      </div>

      <label className="field">
        <span>Primer</span>
        <textarea name="primer" rows={3} defaultValue={system.primer ?? ""} />
      </label>

      <label className="field">
        <span>Body coat</span>
        <textarea
          name="body_coat"
          rows={3}
          defaultValue={system.body_coat ?? ""}
        />
      </label>

      <label className="field">
        <span>Broadcast</span>
        <textarea
          name="broadcast"
          rows={3}
          defaultValue={system.broadcast ?? ""}
        />
      </label>

      <label className="field">
        <span>Topcoat</span>
        <textarea name="topcoat" rows={3} defaultValue={system.topcoat ?? ""} />
      </label>

      <div className="section-divider field-wide">
        <span>Site-critical application data</span>
      </div>

      <label className="field field-wide">
        <span>Mixing instructions</span>
        <textarea
          name="mixing_instructions"
          rows={5}
          defaultValue={system.mixing_instructions ?? ""}
        />
      </label>

      <label className="field">
        <span>Coverage</span>
        <textarea
          name="coverage_notes"
          rows={3}
          defaultValue={system.coverage_notes ?? ""}
        />
      </label>

      <label className="field">
        <span>Pot life</span>
        <textarea
          name="pot_life_notes"
          rows={3}
          defaultValue={system.pot_life_notes ?? ""}
        />
      </label>

      <label className="field">
        <span>Cure / recoat</span>
        <textarea
          name="cure_notes"
          rows={3}
          defaultValue={system.cure_notes ?? ""}
        />
      </label>

      <label className="field">
        <span>Temperature</span>
        <textarea
          name="temperature_notes"
          rows={3}
          defaultValue={system.temperature_notes ?? ""}
        />
      </label>

      <label className="field field-wide">
        <span>Application limits</span>
        <textarea
          name="application_limits"
          rows={4}
          defaultValue={system.application_limits ?? ""}
        />
      </label>

      <label className="field field-wide">
        <span>Service / resistance notes</span>
        <textarea
          name="chemical_notes"
          rows={3}
          defaultValue={system.chemical_notes ?? ""}
        />
      </label>

      <div className="section-divider field-wide">
        <span>Controlled references</span>
      </div>

      <label className="field">
        <span>Technical data reference</span>
        <input
          name="tds_reference"
          defaultValue={system.tds_reference ?? ""}
        />
      </label>

      <label className="field">
        <span>Safety data reference</span>
        <input
          name="sds_reference"
          defaultValue={system.sds_reference ?? ""}
        />
      </label>
    </div>
  );
}
