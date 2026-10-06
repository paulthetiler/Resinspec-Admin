"use client";

import { useMemo, useState } from "react";
import {
  NEXT_ACTION_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  suggestedNextAction,
} from "@/lib/project-next-actions";

type ProjectStatusNextActionProps = {
  initialStatus?: string | null;
  initialAction?: string | null;
  initialDue?: string | null;
};

export function ProjectStatusNextAction({
  initialStatus = "lead",
  initialAction,
  initialDue,
}: ProjectStatusNextActionProps) {
  const startStatus = initialStatus || "lead";
  const startSuggestion = suggestedNextAction(startStatus);
  const startAction = initialAction?.trim() || startSuggestion;
  const startIsSuggested = !initialAction || initialAction === startSuggestion;
  const startKnownOption = NEXT_ACTION_OPTIONS.includes(
    startAction as (typeof NEXT_ACTION_OPTIONS)[number]
  );

  const [status, setStatus] = useState(startStatus);
  const [mode, setMode] = useState<"suggested" | "preset" | "custom">(
    startIsSuggested ? "suggested" : startKnownOption ? "preset" : "custom"
  );
  const [presetAction, setPresetAction] = useState(
    startIsSuggested || !startKnownOption ? "" : startAction
  );
  const [customAction, setCustomAction] = useState(
    !startIsSuggested && !startKnownOption ? startAction : ""
  );

  const suggestion = useMemo(() => suggestedNextAction(status), [status]);

  const action =
    mode === "suggested"
      ? suggestion
      : mode === "preset"
        ? presetAction
        : customAction;

  function handleActionChoice(value: string) {
    if (value === "__suggested__") {
      setMode("suggested");
      setPresetAction("");
      return;
    }

    if (value === "__custom__") {
      setMode("custom");
      return;
    }

    setMode("preset");
    setPresetAction(value);
  }

  const selectedValue =
    mode === "suggested"
      ? "__suggested__"
      : mode === "custom"
        ? "__custom__"
        : presetAction;

  return (
    <>
      <label className="field">
        <span>Status</span>
        <select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {PROJECT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Next action</span>
        <select
          value={selectedValue}
          onChange={(event) => handleActionChoice(event.target.value)}
        >
          <option value="__suggested__">
            Suggested: {suggestion}
          </option>
          {NEXT_ACTION_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value="__custom__">Other…</option>
        </select>
        <small>
          ResinSpec suggests this from the project status. Change it only when the job needs something different.
        </small>
        <input type="hidden" name="next_action" value={action} />
      </label>

      {mode === "custom" ? (
        <label className="field">
          <span>Custom next action</span>
          <input
            value={customAction}
            onChange={(event) => setCustomAction(event.target.value)}
            placeholder="e.g. Await landlord approval"
          />
        </label>
      ) : null}

      <label className="field">
        <span>Next action due</span>
        <input
          name="next_action_due"
          type="date"
          defaultValue={initialDue ?? ""}
        />
      </label>
    </>
  );
}
