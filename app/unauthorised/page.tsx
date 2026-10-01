export default function UnauthorisedPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-copy">
          <p className="eyebrow">ResinSpec Admin</p>
          <h1>Access not assigned</h1>
          <p>
            This login is valid, but it does not currently have an active ResinSpec role.
            Ask the owner or office administrator to assign access.
          </p>
        </div>
      </section>
    </main>
  );
}
