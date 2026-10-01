"use client";

export function PrintButton() {
  return (
    <button className="secondary-button print-button" onClick={() => window.print()}>
      Print / Save PDF
    </button>
  );
}
