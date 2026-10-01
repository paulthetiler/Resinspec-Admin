"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const OWNER_EMAIL = "paul@resinspec.uk";

export default function SetupPage() {
  const supabase = createClient();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const setupToken = window.location.hash.replace(/^#/, "").trim();
    if (setupToken) {
      setToken(setupToken);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!token) {
      setMessage("This setup link is missing its one-time key.");
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

    const { data, error } = await supabase.functions.invoke("bootstrap-owner", {
      body: { token, password },
    });

    if (error || !data?.ok) {
      setMessage(
        data?.error ||
          error?.message ||
          "Owner account could not be created."
      );
      setBusy(false);
      return;
    }

    const signIn = await supabase.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password,
    });

    if (signIn.error) {
      setMessage(
        "Owner account was created, but automatic sign-in failed. Use the normal login screen."
      );
      setBusy(false);
      return;
    }

    window.location.assign("/");
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
          <p className="eyebrow">One-time setup</p>
          <h1>Create Owner account</h1>
          <p>
            Choose the password for {OWNER_EMAIL}. This setup link works once
            and then locks itself.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <label>
            <span>Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </label>

          {message ? <p className="form-error">{message}</p> : null}

          <button type="submit" disabled={busy || !token}>
            {busy ? "Creating Owner account…" : "Create Owner account"}
          </button>
        </form>

        <p className="login-footnote">
          There is no public signup. Future staff access is issued from the
          People area by the Owner.
        </p>
      </section>
    </main>
  );
}
