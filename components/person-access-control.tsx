"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/permissions";

type StaffRole = Exclude<Role, "owner">;

type Props = {
  personId: string;
  email: string | null;
  userId: string | null;
  currentRole: string | null;
};

export function PersonAccessControl({
  personId,
  email,
  userId,
  currentRole,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [role, setRole] = useState<StaffRole>(
    (currentRole as StaffRole | null) ?? "installer"
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null
  );

  async function createLogin() {
    setBusy(true);
    setMessage(null);
    setTemporaryPassword(null);

    const { data, error } = await supabase.functions.invoke(
      "admin-create-user",
      {
        body: {
          person_id: personId,
          role,
        },
      }
    );

    if (error || !data?.ok) {
      setMessage(
        data?.error || error?.message || "Could not create staff login."
      );
      setBusy(false);
      return;
    }

    setTemporaryPassword(data.temporary_password);
    setMessage("Login created. Give the temporary password to this person securely.");
    setBusy(false);
    router.refresh();
  }

  async function updateRole() {
    if (!userId) return;

    setBusy(true);
    setMessage(null);

    const { error } = await supabase.rpc("set_user_role", {
      target_user_id: userId,
      new_role: role,
      enabled: true,
    });

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    setMessage("Access role updated.");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="access-control">
      <label className="field">
        <span>App role</span>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as StaffRole)}
        >
          <option value="installer">Installer</option>
          <option value="supervisor">Supervisor</option>
          <option value="office">Office</option>
          <option value="commercial">Commercial</option>
        </select>
      </label>

      {!userId ? (
        <button
          className="primary-button full-button"
          type="button"
          onClick={createLogin}
          disabled={busy || !email}
        >
          {busy ? "Creating…" : "Create app login"}
        </button>
      ) : (
        <button
          className="secondary-button full-button"
          type="button"
          onClick={updateRole}
          disabled={busy}
        >
          {busy ? "Saving…" : "Update access role"}
        </button>
      )}

      {!email ? (
        <p className="upload-message">
          Add an email address before creating app access.
        </p>
      ) : null}

      {message ? <p className="upload-message">{message}</p> : null}

      {temporaryPassword ? (
        <div className="temporary-credential">
          <span>Temporary password — shown once</span>
          <code>{temporaryPassword}</code>
          <small>
            The user is forced to replace it on first sign-in.
          </small>
        </div>
      ) : null}
    </div>
  );
}
