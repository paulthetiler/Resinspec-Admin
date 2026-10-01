import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { canAccessNav, navigation } from "@/lib/navigation";
import { can, type Role } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

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

async function TodayPage({ role }: { role: Role }) {
  const supabase = await createClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const commercialAccess = can(role, "commercial:view");

  const [
    pipelineResult,
    liveResult,
    qaResult,
    actionCountResult,
    actionsResult,
    programmeResult,
    activeProjectsResult,
    ramsResult,
    assignmentsResult,
    peopleResult,
    invoicesResult,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .in("status", ["lead", "qualifying", "survey", "estimating", "quoted"]),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .in("status", ["prestart", "live", "handover"]),
    supabase
      .from("qa_records")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "complete", "rejected"]),
    supabase
      .from("project_actions")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("project_actions")
      .select(
        "id, title, category, priority, due_at, project_id, projects(reference, title)"
      )
      .eq("status", "open")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase
      .from("projects")
      .select("id, reference, title, status, programme_start, programme_end")
      .gte("programme_start", today)
      .order("programme_start", { ascending: true })
      .limit(5),
    supabase
      .from("projects")
      .select("id, reference, title, status")
      .in("status", ["prestart", "live", "handover"]),
    supabase
      .from("rams_documents")
      .select("project_id, status")
      .eq("status", "approved"),
    supabase
      .from("project_assignments")
      .select("project_id"),
    supabase
      .from("people")
      .select("id, full_name, cscs_expiry, insurance_expiry")
      .eq("active", true),
    commercialAccess
      ? supabase
          .from("invoices")
          .select(
            "id, project_id, reference, due_on, net_amount, paid_amount, status, projects(reference, title)"
          )
          .lt("due_on", today)
          .not("status", "in", "(draft,paid,cancelled)")
          .order("due_on", { ascending: true })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const dashboardCards = [
    {
      label: "Pipeline",
      value: String(pipelineResult.count ?? 0),
      note: "Lead to quoted",
    },
    {
      label: "Live / pre-start",
      value: String(liveResult.count ?? 0),
      note: "Operational jobs",
    },
    {
      label: "QA holds",
      value: String(qaResult.count ?? 0),
      note: "Open / awaiting review",
    },
    {
      label: "Open actions",
      value: String(actionCountResult.count ?? 0),
      note: "Across accessible jobs",
    },
  ];

  const actions = actionsResult.data || [];
  const programme = programmeResult.data || [];
  const activeProjects = activeProjectsResult.data || [];
  const approvedRams = new Set(
    (ramsResult.data || []).map((row) => row.project_id)
  );
  const crewProjects = new Set(
    (assignmentsResult.data || []).map((row) => row.project_id)
  );

  const exceptions: Array<{
    key: string;
    title: string;
    detail: string;
    href: string;
    critical?: boolean;
  }> = [];

  for (const project of activeProjects) {
    if (!crewProjects.has(project.id)) {
      exceptions.push({
        key: "crew-" + project.id,
        title: "Crew not allocated",
        detail: project.reference + " · " + project.title,
        href: "/jobs/" + project.id + "/crew",
        critical: project.status === "live",
      });
    }

    if (!approvedRams.has(project.id)) {
      exceptions.push({
        key: "rams-" + project.id,
        title: "Approved RAMS missing",
        detail: project.reference + " · " + project.title,
        href: "/jobs/" + project.id + "/rams",
        critical: project.status === "live",
      });
    }
  }

  for (const person of peopleResult.data || []) {
    const checks = [
      { label: "CSCS", value: person.cscs_expiry },
      { label: "Insurance", value: person.insurance_expiry },
    ];

    for (const check of checks) {
      if (!check.value || check.value > next30) continue;
      exceptions.push({
        key: check.label + "-" + person.id,
        title:
          check.value < today
            ? check.label + " expired"
            : check.label + " expiring",
        detail: person.full_name + " · " + check.value,
        href: "/people/" + person.id,
        critical: check.value < today,
      });
    }
  }

  for (const invoice of invoicesResult.data || []) {
    const project = Array.isArray(invoice.projects)
      ? invoice.projects[0]
      : invoice.projects;
    const outstanding =
      Number(invoice.net_amount ?? 0) - Number(invoice.paid_amount ?? 0);

    exceptions.push({
      key: "invoice-" + invoice.id,
      title: "Invoice overdue",
      detail:
        (project?.reference ? project.reference + " · " : "") +
        invoice.reference +
        " · £" +
        Math.max(outstanding, 0).toFixed(0) +
        " outstanding",
      href: "/jobs/" + invoice.project_id + "/invoices",
      critical: true,
    });
  }

  exceptions.sort((a, b) => Number(Boolean(b.critical)) - Number(Boolean(a.critical)));

  function dueText(value: string | null) {
    if (!value) return "No due date";
    return new Date(value).toLocaleString("en-GB", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">ResinSpec control room</p>
          <h1>Today</h1>
          <p>
            The exception list: live work, holds and actions that actually need attention.
          </p>
        </div>
        {can(role, "jobs:edit") ? (
          <Link className="primary-button" href="/jobs/new">
            + New project
          </Link>
        ) : null}
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
            <span className="count-badge">{actions.length}</span>
          </div>

          {actions.length > 0 ? (
            <div className="stack-list">
              {actions.map((action) => {
                const project = Array.isArray(action.projects)
                  ? action.projects[0]
                  : action.projects;

                return (
                  <Link
                    className="stack-row"
                    key={action.id}
                    href={action.project_id ? "/jobs/" + action.project_id : "/"}
                  >
                    <span>
                      <strong>{action.title}</strong>
                      <small>
                        {action.category.replaceAll("_", " ")}
                        {project?.reference ? " · " + project.reference : ""}
                        {project?.title ? " · " + project.title : ""}
                      </small>
                    </span>
                    <span>
                      <strong
                        className={
                          action.priority === "critical"
                            ? "priority-critical"
                            : ""
                        }
                      >
                        {action.priority}
                      </strong>
                      <small>{dueText(action.due_at)}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <strong>Nothing needs chasing.</strong>
              <p>
                Open actions from jobs, surveys, QA and commercial work will surface here.
              </p>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Coming up</p>
              <h2>Programme</h2>
            </div>
          </div>

          {programme.length > 0 ? (
            <div className="timeline">
              {programme.map((project) => (
                <Link key={project.id} href={"/jobs/" + project.id}>
                  <span />
                  <p>
                    <strong>
                      {project.reference} · {project.title}
                    </strong>
                    <small>
                      {project.programme_start || "TBC"}
                      {project.programme_end
                        ? " → " + project.programme_end
                        : ""}
                      {project.status ? " · " + project.status : ""}
                    </small>
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No upcoming programme loaded.</strong>
              <p>Scheduled jobs will appear here automatically.</p>
            </div>
          )}
        </section>
      </div>

      <section className="panel control-exceptions">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Controls</p>
            <h2>Exceptions</h2>
          </div>
          <span className="count-badge">{exceptions.length}</span>
        </div>

        {exceptions.length > 0 ? (
          <div className="stack-list">
            {exceptions.slice(0, 12).map((item) => (
              <Link className="stack-row" href={item.href} key={item.key}>
                <span>
                  <strong className={item.critical ? "priority-critical" : ""}>
                    {item.title}
                  </strong>
                  <small>{item.detail}</small>
                </span>
                <span className="text-button">Open</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <strong>No control exceptions.</strong>
            <p>Crew, RAMS, workforce records and overdue invoices are clear.</p>
          </div>
        )}
      </section>

      <section className="foundation-note">
        <span className="pulse" />
        <div>
          <strong>Live operations foundation</strong>
          <p>
            Jobs, people, crew access, technical systems, private documents, QA,
            RAMS, estimator and commercial records share the same project.
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
      {slug === "" ? <TodayPage role={role} /> : <ModulePage slug={slug} />}
    </AdminShell>
  );
}
