import Link from "next/link";
import type { ReactNode } from "react";
import { navigation } from "@/lib/navigation";

type AdminShellProps = {
  activeSlug: string;
  children: ReactNode;
};

export function AdminShell({ activeSlug, children }: AdminShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <Link className="brand" href="/" aria-label="ResinSpec Admin home">
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>
              <strong>ResinSpec</strong>
              <small>ADMIN</small>
            </span>
          </Link>
          <p>Operations system</p>
        </div>

        <nav className="side-nav" aria-label="Admin navigation">
          {navigation.map((item) => {
            const href = item.slug ? `/${item.slug}` : "/";
            const active = item.slug === activeSlug;

            return (
              <Link
                key={item.slug || "today"}
                href={href}
                className={active ? "nav-item is-active" : "nav-item"}
              >
                <span className="nav-dot" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <span className="status-dot" />
          <span>
            <strong>Foundation build</strong>
            <small>Database not connected</small>
          </span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="mobile-brand">ResinSpec Admin</span>
          </div>
          <div className="user-chip">
            <span className="avatar">PF</span>
            <span>
              <strong>Paul</strong>
              <small>Owner</small>
            </span>
          </div>
        </header>

        <main className="main-content">{children}</main>

        <nav className="mobile-nav" aria-label="Mobile admin navigation">
          {navigation.slice(0, 5).map((item) => {
            const href = item.slug ? `/${item.slug}` : "/";
            const active = item.slug === activeSlug;
            return (
              <Link
                key={item.slug || "today-mobile"}
                href={href}
                className={active ? "is-active" : ""}
              >
                {item.shortLabel}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
