import Link from "next/link";
import type { ReactNode } from "react";
import { canAccessNav, navigation } from "@/lib/navigation";
import type { Role } from "@/lib/permissions";

type AdminShellProps = {
  activeSlug: string;
  role: Role;
  children: ReactNode;
};

const roleLabels: Record<Role, string> = {
  owner: "Owner",
  office: "Office",
  commercial: "Commercial",
  supervisor: "Supervisor",
  installer: "Installer",
};

export function AdminShell({ activeSlug, role, children }: AdminShellProps) {
  const visibleNavigation = navigation.filter((item) => canAccessNav(role, item));

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
          {visibleNavigation.map((item) => {
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
            <strong>Supabase connected</strong>
            <small>Role access enforced</small>
          </span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="mobile-brand">ResinSpec Admin</span>
          </div>
          <div className="user-controls">
            <div className="user-chip">
              <span className="avatar">{roleLabels[role].slice(0, 2).toUpperCase()}</span>
              <span>
                <strong>Signed in</strong>
                <small>{roleLabels[role]}</small>
              </span>
            </div>
            <form action="/auth/signout" method="post">
              <button className="signout-button" type="submit">Sign out</button>
            </form>
          </div>
        </header>

        <main className="main-content">{children}</main>

        <nav className="mobile-nav" aria-label="Mobile admin navigation">
          {visibleNavigation.slice(0, 5).map((item) => {
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
