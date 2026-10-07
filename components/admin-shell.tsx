import Link from "next/link";
import type { ReactNode } from "react";
import { MobileMenu } from "@/components/mobile-menu";
import { can, type Role } from "@/lib/permissions";
import { canAccessNav, navigation } from "@/lib/navigation";

type AdminShellProps={activeSlug:string;role:Role;children:ReactNode};
const roleLabels:Record<Role,string>={owner:"Owner",office:"Office",commercial:"Commercial",supervisor:"Supervisor",installer:"Installer"};

export function AdminShell({activeSlug,role,children}:AdminShellProps){
 const visibleNavigation=navigation.filter(item=>canAccessNav(role,item));
 const moreHref=visibleNavigation.find(item=>!["","jobs"].includes(item.slug))?.slug;
 const canCreate=can(role,"jobs:edit");
 return <div className="app-shell">
  <aside className="sidebar">
   <div className="brand-block"><Link className="brand" href="/" aria-label="ResinSpec Admin home"><img className="admin-logo" src="/resinspec-logo.svg" alt="ResinSpec Flooring" /><span className="admin-label">ADMIN</span></Link><p>Operations system</p></div>
   <nav className="side-nav" aria-label="Admin navigation">{visibleNavigation.map(item=>{const href=item.slug?`/${item.slug}`:"/";return <Link key={item.slug||"today"} href={href} className={item.slug===activeSlug?"nav-item is-active":"nav-item"}><span className="nav-dot"/><span>{item.label}</span></Link>})}</nav>
   <div className="sidebar-foot"><span className="status-dot"/><span><strong>Supabase connected</strong><small>Role access enforced</small></span></div>
  </aside>
  <div className="workspace">
   <header className="topbar"><Link className="mobile-brand" href="/"><img className="admin-logo mobile-admin-logo" src="/resinspec-logo.svg" alt="ResinSpec Flooring" /><span className="admin-label mobile-admin-label">ADMIN</span></Link><div className="user-controls"><MobileMenu items={visibleNavigation.map(item=>({slug:item.slug,label:item.label}))} activeSlug={activeSlug} /><div className="user-chip"><span className="avatar">{roleLabels[role].slice(0,2).toUpperCase()}</span><span><strong>Signed in</strong><small>{roleLabels[role]}</small></span></div><form action="/auth/signout" method="post"><button className="signout-button" type="submit">Sign out</button></form></div></header>
   <main className="main-content">{children}</main>
   <nav className="mobile-nav" aria-label="Mobile admin navigation">
    <Link href="/" className={activeSlug===""?"is-active":""}><span className="mobile-nav-icon">⌂</span><span>Home</span></Link>
    <Link href="/jobs" className={activeSlug==="jobs"?"is-active":""}><span className="mobile-nav-icon">▣</span><span>Jobs</span></Link>
    {canCreate?<Link href="/jobs/new" className="mobile-nav-create" aria-label="New project"><span className="mobile-plus">+</span><span>New</span></Link>:<Link href="/documents"><span className="mobile-plus">+</span><span>Site</span></Link>}
    <Link href="/alerts" className={activeSlug==="alerts"?"is-active":"mobile-attention-link"}><span className="mobile-nav-icon">●</span><span>Alerts</span></Link>
    <Link href={moreHref?`/${moreHref}`:"/"} className={!["","jobs","alerts"].includes(activeSlug)?"is-active":""}><span className="mobile-nav-icon">•••</span><span>More</span></Link>
   </nav>
  </div>
 </div>
}