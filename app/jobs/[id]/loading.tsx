export default function Loading() {
  return (
    <div className="standalone-page page-loading" aria-live="polite" aria-busy="true">
      <div className="loading-heading">
        <span className="loading-line loading-line-short" />
        <span className="loading-line loading-line-title" />
        <span className="loading-line loading-line-copy" />
      </div>
      <div className="loading-card-grid">
        <span className="loading-card" />
        <span className="loading-card" />
        <span className="loading-card" />
      </div>
      <span className="loading-panel" />
    </div>
  );
}
