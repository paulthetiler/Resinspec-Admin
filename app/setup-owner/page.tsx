"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const OWNER_EMAIL = "paul@resinspec.uk";

export default function OwnerSetupPage() {
  const supabase = createClient();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const value = window.location.hash.replace(/^#/, "").trim();
    if (value) {
      setToken(value);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!token) {
      setMessage("This owner setup link is missing its one-time key.");
      return;
    }

    if (password.length < 12) {
      setMessage("Use at least 12 characters.");
      return;
    }

    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    setBusy(true);

    const result = await supabase.auth.signUp({
      email: OWNER_EMAIL,
      password,
      options: {
        data: {
          full_name: "Paul Finn",
          owner_bootstrap_token: token,
        },
      },
    });

    if (result.error) {
      setMessage(result.error.message);
      setBusy(false);
      return;
    }

    setComplete(true);

    if (result.data.session) {
      window.location.assign("/");
      return;
    }

    setNeedsEmailConfirmation(true);
    setBusy(false);
  }

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
            <small>OWNER SETUP</small>
          </span>
        </div>

        <div className="login-copy">
          <p className="eyebrow">One-time secure setup</p>
          <h1>Create Owner login</h1>
          <p>
            Set the password for {OWNER_EMAIL}. The setup key can be used once
            and is then invalidated in the database.
          </p>
        </div>

        {!complete ? (
          <form className="login-form" onSubmit={submit}>
            <label>
              <span>Password</span>
              <input
                type="password"
                minLength={12}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            <label>
              <span>Confirm password</span>
              <input
                type="password"
                minLength={12}
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </label>

            {message ? <p className="form-error">{message}</p> : null}

            <button type="submit" disabled={busy || !token}>
              {busy ? "Creating Owner…" : "Create Owner account"}
            </button>
          </form>
        ) : needsEmailConfirmation ? (
          <div className="setup-success">
            <strong>Owner account created.</strong>
            <p>
              Supabase requires email confirmation on this project. Check the
              inbox for {OWNER_EMAIL}, confirm it, then return to the login
              screen.
            </p>
            <Link className="primary-button" href="/login">
              Go to login
            </Link>
          </div>
        ) : (
          <div className="setup-success">
            <strong>Owner account created.</strong>
            <p>Opening ResinSpec Admin…</p>
          </div>
        )}

        <p className="login-footnote">
          Public signup remains unavailable. Future staff accounts are created
          by the Owner from People.
        </p>
      </section>
    </main>
  );
}
