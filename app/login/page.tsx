import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

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
          <p>Authorised ResinSpec staff and subcontractors only.</p>
        </div>

        <form action={login} className="login-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit">Sign in</button>
        </form>

        <p className="login-footnote">
          Accounts are issued internally. There is no public registration.
        </p>
      </section>
    </main>
  );
}
