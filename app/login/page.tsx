import { requestLoginLink } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; sent?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, sent } = await searchParams;

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>ResinSpec</strong>
            <small>ADMIN</small>
          </span>
        </div>

        <div className="login-copy">
          <p className="eyebrow">Private operations system</p>
          <h1>Sign in</h1>
          <p>Enter your authorised work email and we will send a secure sign-in link.</p>
        </div>

        <form action={requestLoginLink} className="login-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          {sent ? (
            <p className="form-success">
              Check your email. The sign-in link is single-use.
            </p>
          ) : null}

          <button type="submit">Send sign-in link</button>
        </form>

        <p className="login-footnote">
          Access is issued internally. Unknown email addresses cannot register.
        </p>
      </section>
    </main>
  );
}
