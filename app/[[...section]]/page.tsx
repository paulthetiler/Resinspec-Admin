import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { canAccessNav, navigation } from "@/lib/navigation";\nimport type { Role } from "@/lib/permissions";\nimport { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ section?: string[] }>;
};

const dashboardCards = [
  { label: "Tender actions", value: "0", note: "Nothing due yet" },
  { label: "Live jobs", value: "0", note: "No projects loaded" },
  { label: "RAMS / QA holds", value: "0", note: "No actions outstanding" },
  { label: "Cash runway", value: "—", note: "Connect commercial data" },
];

const moduleContent: Record<
  string,
  {
    eyebrow: string;
    title: string;
    intro: string;
    cards: Array<{ title: string; body: string; badge?: string }>;
  }
> = {
  pipeline: {
    eyebrow: "Enquiry to order",
    title: "Pipeline",
    intro:
      "Qualify work properly before it becomes a job. Every opportunity will move through survey, estimate, quote and decision without losing the original information.",
    cards: [
      {
        title: "Lead register",
        body: "New enquiries, client, site, value band, source, next action and owner.",
      },
      {
        title: "Survey queue",
        body: "Site visits, substrate assessment, access, moisture, contamination, joints and evidence.",
      },
      {
        title: "Quotes",
        body: "Quote versions, exclusions, expiry, follow-up and won / lost reason.",
      },
    ],
  },
  jobs: {
    eyebrow: "One project record",
    title: "Jobs",
    intro:
      "Every operational, technical and commercial record hangs from the same project. This is the centre of the ResinSpec system.",
    cards: [
      {
        title: "Project overview",
        body: "Client, site, scope, system, area, programme, crew, supervisor and status.",
      },
      {
        title: "Crew allocation",
        body: "Assign installers and supervisors so each person only sees the jobs they need.",
      },
      {
        title: "Project timeline",
        body: "Survey, approval, mobilisation, install, QA, handover, invoice and close-out.",
      },
    ],
  },
  technical: {
    eyebrow: "Controlled system library",
    title: "Technical",
    intro:
      "Approved flooring systems should be repeatable, versioned and usable on site without relying on memory.",
    cards: [
      {
        title: "System library",
        body: "Primer, body coat, broadcast, topcoat, thickness, substrate requirements and application limits.",
      },
      {
        title: "Mixing & coverage",
        body: "Manufacturer-approved ratios, batch size, pot life, expected coverage and cure windows.",
      },
      {
        title: "TDS / SDS register",
        body: "Current technical and safety documents linked to the exact system revision used on each job.",
      },
    ],
  },
  documents: {
    eyebrow: "Evidence, not paperwork theatre",
    title: "Documents & QA",
    intro:
      "The site team gets a short, controlled sequence of documents and hold points. The office gets a complete audit trail.",
    cards: [
      {
        title: "RAMS & briefings",
        body: "Approved RAMS, revisions, crew acknowledgement and project-specific method information.",
      },
      {
        title: "QA hold points",
        body: "Substrate acceptance, readings, preparation, batches, consumption, finish and sign-off.",
      },
      {
        title: "Handover pack",
        body: "Photos, QA evidence, product records, care information, snags and final acceptance.",
      },
    ],
  },
  people: {
    eyebrow: "Competence & allocation",
    title: "People",
    intro:
      "Keep the useful workforce information in one place without turning ResinSpec into an HR software company.",
    cards: [
      {
        title: "Worker profiles",
        body: "Role, contact details, employment type, rate band and current availability.",
      },
      {
        title: "Competence",
        body: "Systems trained on, practical sign-offs, tickets and supervisor approval.",
      },
      {
        title: "Expiry control",
        body: "CSCS, insurance, right-to-work records where applicable and training reminders.",
      },
    ],
  },
  commercial: {
    eyebrow: "Restricted area",
    title: "Commercial",
    intro:
      "This area is permission-controlled. Site operatives and normal office users do not automatically see margin, cost or company financial information.",
    cards: [
      {
        title: "Estimator",
        body: "Placeholder ready. Survey data will eventually feed a proper cost build-up, contingency and sell-price model.",
        badge: "Coming later",
      },
      {
        title: "Job commercial",
        body: "Estimated cost, actual cost, variations, applications, invoices, retention and payment status.",
      },
      {
        title: "Management",
        body: "Gross contribution, margin, debtor exposure and 30–40 day committed-cash runway.",
      },
    ],
  },
};

function TodayPage() {
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">Thursday · ResinSpec control room</p>
          <h1>Today</h1>
          <p>
            This screen will become the exception list: what needs attention, not a wall of meaningless charts.
          </p>
        </div>
        <button className="primary-button" type="button" disabled>
          + New project
        </button>
      </section>

      <section className="metric-grid" aria-label="Business overview">
        {dashboardCards.map((card) => (
          <article className="metric-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.note}</small>
          </article>
        ))}
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Action centre</p>
              <h2>Needs attention</h2>
            </div>
            <span className="count-badge">0</span>
          </div>
          <div className="empty-state">
            <strong>Nothing to chase yet.</strong>
            <p>
              Once the database is connected this will surface missing RAMS, crew gaps, overdue quotes,
              expiring competence records and commercial actions.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Coming up</p>
              <h2>Programme</h2>
            </div>
          </div>
          <div className="timeline">
            <div>
              <span />
              <p><strong>No jobs loaded</strong><small>Programme will populate from live projects.</small></p>
            </div>
          </div>
        </section>
      </div>

      <section className="foundation-note">
        <span className="pulse" />
        <div>
          <strong>Foundation stage</strong>
          <p>
            Navigation and access structure are now in place. Live data, authentication and document storage
            are the next layer.
          </p>
        </div>
      </section>
    </>
  );
}

function ModulePage({ slug }: { slug: string }) {
  const content = moduleContent[slug];
  if (!content) notFound();

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p>{content.intro}</p>
        </div>
      </section>

      <section className="module-grid">
        {content.cards.map((card) => (
          <article className="module-card" key={card.title}>
            <div className="module-card-top">
              <span className="module-icon" aria-hidden="true" />
              {card.badge ? <span className="soft-badge">{card.badge}</span> : null}
            </div>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
            <button type="button" disabled>
              Not connected yet
            </button>
          </article>
        ))}
      </section>
    </>
  );
}

export default async function AdminPage({ params }: PageProps) {
  const { section = [] } = await params;
  if (section.length > 1) notFound();

  const slug = section[0] ?? "";
  const item = navigation.find((navItem) => navItem.slug === slug);
  if (!item) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("current_app_role");
  const role = data as Role | null;

  if (!role || !["owner", "office", "commercial", "supervisor", "installer"].includes(role)) {
    redirect("/unauthorised");
  }

  if (!canAccessNav(role, item)) {
    const firstAllowed = navigation.find((navItem) => canAccessNav(role, navItem));
    redirect(firstAllowed?.slug ? `/${firstAllowed.slug}` : "/");
  }

  return (
    <AdminShell activeSlug={slug} role={role}>
      {slug === "" ? <TodayPage /> : <ModulePage slug={slug} />}
    </AdminShell>
  );
}
