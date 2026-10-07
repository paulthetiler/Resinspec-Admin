"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MenuItem={slug:string;label:string};
type Props={items:MenuItem[];activeSlug:string};

export function MobileMenu({items,activeSlug}:Props){
 const [open,setOpen]=useState(false);
 useEffect(()=>{
  if(!open)return;
  const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};
  document.addEventListener("keydown",close);
  document.body.style.overflow="hidden";
  return ()=>{document.removeEventListener("keydown",close);document.body.style.overflow=""};
 },[open]);

 return <>
  <button className="mobile-menu-button" type="button" aria-label="Open full menu" aria-expanded={open} aria-controls="mobile-full-menu" onClick={()=>setOpen(true)}>
   <span aria-hidden="true">☰</span>
  </button>
  {open?<div className="mobile-menu-layer">
   <button className="mobile-menu-backdrop" type="button" aria-label="Close menu" onClick={()=>setOpen(false)} />
   <aside className="mobile-menu-drawer" id="mobile-full-menu" aria-label="Full admin navigation">
    <div className="mobile-menu-head"><div><strong>Menu</strong><small>ResinSpec Admin</small></div><button type="button" aria-label="Close menu" onClick={()=>setOpen(false)}>×</button></div>
    <nav>{items.map(item=>{const href=item.slug?`/${item.slug}`:"/";return <Link key={item.slug||"today"} href={href} className={item.slug===activeSlug?"is-active":""} onClick={()=>setOpen(false)}>{item.label}</Link>})}</nav>
   </aside>
  </div>:null}
 </>;
}
