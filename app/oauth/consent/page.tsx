import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { approveOAuth, denyOAuth } from "./actions";

type ConsentPageProps = {
  searchParams: Promise<{ authorization_id?: string; error?: string }>;
};

type AuthorizationDetails = {
  authorization_id?: string;
  redirect_url?: string;
  client?: {
    name?: string;
    client_name?: string;
    id?: string;
  };
  client_name?: string;
  scopes?: string[];
  scope?: string;
};

export default async function OAuthConsentPage({
  searchParams,
}: ConsentPageProps) {
  const { authorization_id: authorizationId, error: pageError } =
    await searchParams;

  if (!authorizationId) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error || !data) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="login-copy">
            <p className="eyebrow">Connection request</p>
            <h1>Could not load request</h1>
            <p>{error?.message ?? "The authorization request is no longer valid."}</p>
          </div>
        </section>
      </main>
    );
  }

  const details = data as AuthorizationDetails;

  if (!details.authorization_id && details.redirect_url) {
    redirect(details.redirect_url);
  }

  const clientName =
    details.client?.name ||
    details.client?.client_name ||
    details.client_name ||
    "ChatGPT";

  const scopes = Array.isArray(details.scopes)
    ? details.scopes
    : details.scope
      ? details.scope.split(" ").filter(Boolean)
      : [];

  return (
    <main className="login-page">
      <section className="login-card oauth-consent-card">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>ResinSpec</strong>
            <small>SECURE CONNECTION</small>
          </span>
        </div>

        <div className="login-copy">
          <p className="eyebrow">Connect estimator</p>
          <h1>Allow {clientName}?</h1>
          <p>
            This connection lets ChatGPT use your ResinSpec account permissions
            to read estimating data and create controlled draft records.
          </p>
        </div>

        <div className="oauth-permissions">
          <strong>What the connection can do</strong>
          <ul>
            <li>Read jobs, surveys, tender-file metadata and technical systems.</li>
            <li>Read estimate revisions, commercial context and draft quotes.</li>
            <li>Create new draft estimate revisions from explicit cost lines.</li>
            <li>Create internal RFIs/actions and draft client quotes.</li>
          </ul>
          <p>
            It cannot issue a quote, email a client, accept an estimate, adopt a
            budget, delete historic revisions or bypass ResinSpec permissions.
          </p>
        </div>

        {scopes.length > 0 ? (
          <div className="oauth-scope-list">
            <span>Requested access</span>
            <strong>{scopes.join(" · ")}</strong>
          </div>
        ) : null}

        {pageError ? <p className="form-error">{pageError}</p> : null}

        <div className="oauth-actions">
          <form action={denyOAuth}>
            <input
              type="hidden"
              name="authorization_id"
              value={authorizationId}
            />
            <button className="secondary-button" type="submit">
              Deny
            </button>
          </form>

          <form action={approveOAuth}>
            <input
              type="hidden"
              name="authorization_id"
              value={authorizationId}
            />
            <button className="primary-button" type="submit">
              Allow connection
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
