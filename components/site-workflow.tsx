import Link from "next/link";
import type { SiteWorkflowState } from "@/lib/site-workflow";

type Props = {
  workflow: SiteWorkflowState;
};

export function SiteWorkflow({ workflow }: Props) {
  return (
    <>
      <section className="site-workflow">
        <div className="site-workflow-head">
          <div>
            <p className="eyebrow">Site workflow</p>
            <h2>{workflow.phaseLabel}</h2>
            <p>
              Follow the job in order. The system shows the next action and
              keeps later stages locked until the required controls are clear.
            </p>
          </div>

          <div className="site-workflow-phase">
            <span>Current phase</span>
            <strong>{workflow.phaseLabel}</strong>
          </div>
        </div>

        <article
          className={
            workflow.nextAction.blocked
              ? "site-next-action is-blocked"
              : "site-next-action"
          }
        >
          <div className="site-next-copy">
            <span>{workflow.nextAction.eyebrow}</span>
            <h3>{workflow.nextAction.title}</h3>
            <p>{workflow.nextAction.detail}</p>
          </div>

          <Link className="site-next-button" href={workflow.nextAction.href}>
            <span>{workflow.nextAction.buttonLabel}</span>
            <b>Continue →</b>
          </Link>
        </article>

        <div className="site-workflow-grid">
          {workflow.items.map((item) => (
            <Link
              className={`site-workflow-card is-${item.tone}`}
              href={item.href}
              key={item.code}
            >
              <div className="site-workflow-card-top">
                <span>{item.label}</span>
                {item.progress ? (
                  <strong className="site-workflow-progress">
                    {item.progress}
                  </strong>
                ) : null}
              </div>

              <strong>{item.status}</strong>
              <p>{item.detail}</p>
              <span className="site-workflow-open">Open →</span>
            </Link>
          ))}
        </div>
      </section>

      <Link className="site-workflow-sticky" href={workflow.nextAction.href}>
        <span>
          <small>{workflow.nextAction.eyebrow}</small>
          <strong>{workflow.nextAction.title}</strong>
        </span>
        <b>Continue →</b>
      </Link>
    </>
  );
}
