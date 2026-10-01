import { changePassword } from "./actions";

type ChangePasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ChangePasswordPage({
  searchParams,
}: ChangePasswordPageProps) {
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
            <small>ACCOUNT SECURITY</small>
          </span>
        </div>

        <div className="login-copy">
          <p className="eyebrow">First sign-in</p>
          <h1>Set your password</h1>
          <p>
            Replace the temporary password before accessing any project data.
          </p>
        </div>

        <form action={changePassword} className="login-form">
          <label>
            <span>New password</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>

          <label>
            <span>Confirm password</span>
            <input
              type="password"
              name="confirm"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit">Save password</button>
        </form>
      </section>
    </main>
  );
}
