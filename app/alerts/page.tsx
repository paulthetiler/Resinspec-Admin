import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { can } from "@/lib/permissions";
import { getAccessContext } from "@/lib/access";
import { redirect } from "next/navigation";

export default async function AlertsPage() {
 const {supabase,role}=await getAccessContext(); if(!role)redirect("/unauthorised");
 const {data:claimsData}=await supabase.auth.getClaims(); const userId=claimsData?.claims?.sub;
 const [a,i,e,v,n]=await Promise.all([
  supabase.from("project_actions").select("id,title,priority,due_at,project_id,projects(reference,title)").eq("status","open").order("due_at",{ascending:true,nullsFirst:false}).limit(20),
  can(role,"issues:review")?supabase.from("site_issues").select("id,category,detail,project_id,projects(reference,title)").neq("status","resolved").order("created_at",{ascending:false}).limit(20):Promise.resolve({data:[]}),
  can(role,"expenses:review")?supabase.from("worker_expenses").select("id,category,amount,expense_date,project_id,projects(reference,title)").eq("status","pending").order("created_at",{ascending:false}).limit(20):Promise.resolve({data:[]}),
  can(role,"invoices:review")?supabase.from("subcontractor_invoices").select("id,invoice_number,gross_amount,project_id,projects(reference,title)").eq("status","submitted").order("created_at",{ascending:false}).limit(20):Promise.resolve({data:[]}),
  userId?supabase.from("user_notifications").select("id,title,body,href,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(20):Promise.resolve({data:[]})
 ]);
 const actions=a.data||[],issues=i.data||[],expenses=e.data||[],invoices=v.data||[],notes=n.data||[];
 const total=actions.length+issues.length+expenses.length+invoices.length+notes.length;
 const pn=(r:any)=>{const p=Array.isArray(r.projects)?r.projects[0]:r.projects;return p?.reference?p.reference+(p.title?" · "+p.title:""):"Project"};
 return <AdminShell activeSlug="alerts" role={role}>
  <section className="page-heading"><div><p className="eyebrow">Action centre</p><h1>Alerts</h1><p>Things that need attention across jobs, site and approvals.</p></div><span className="count-badge">{total}</span></section>
  {!total?<section className="panel"><div className="empty-state"><strong>Nothing needs your attention.</strong><p>New site issues, approvals, project actions and direct notifications will appear here.</p></div></section>:null}
  {actions.length?<section className="panel"><div className="panel-head"><div><p className="eyebrow">Jobs</p><h2>Open actions</h2></div><span className="count-badge">{actions.length}</span></div><div className="stack-list">{actions.map((r:any)=><Link className="stack-row" key={r.id} href={"/jobs/"+r.project_id+"/actions"}><span><strong>{r.title}</strong><small>{pn(r)}{r.due_at?" · due "+new Date(r.due_at).toLocaleDateString("en-GB"):""}</small></span><b className={r.priority==="critical"?"priority-critical":""}>{r.priority}</b></Link>)}</div></section>:null}
  {issues.length?<section className="panel"><div className="panel-head"><div><p className="eyebrow">Site</p><h2>Unresolved issues</h2></div><span className="count-badge">{issues.length}</span></div><div className="stack-list">{issues.map((r:any)=><Link className="stack-row" key={r.id} href={"/jobs/"+r.project_id+"/issues"}><span><strong>{String(r.category).replaceAll("_"," ")}</strong><small>{pn(r)} · {r.detail}</small></span><span className="text-button">Open</span></Link>)}</div></section>:null}
  {expenses.length?<section className="panel"><div className="panel-head"><div><p className="eyebrow">Approvals</p><h2>Expenses waiting</h2></div><span className="count-badge">{expenses.length}</span></div><div className="stack-list">{expenses.map((r:any)=><Link className="stack-row" key={r.id} href={"/jobs/"+r.project_id+"/expenses"}><span><strong>£{Number(r.amount).toFixed(2)} · {String(r.category).replaceAll("_"," ")}</strong><small>{pn(r)} · {r.expense_date}</small></span><span className="text-button">Review</span></Link>)}</div></section>:null}
  {invoices.length?<section className="panel"><div className="panel-head"><div><p className="eyebrow">CIS</p><h2>Invoices waiting</h2></div><span className="count-badge">{invoices.length}</span></div><div className="stack-list">{invoices.map((r:any)=><Link className="stack-row" key={r.id} href={"/jobs/"+r.project_id+"/cis-invoices"}><span><strong>Invoice {r.invoice_number} · £{Number(r.gross_amount).toFixed(2)}</strong><small>{pn(r)}</small></span><span className="text-button">Review</span></Link>)}</div></section>:null}
  {notes.length?<section className="panel"><div className="panel-head"><div><p className="eyebrow">Messages</p><h2>Your notifications</h2></div><span className="count-badge">{notes.length}</span></div><div className="stack-list">{notes.map((r:any)=>r.href?<Link className="stack-row" key={r.id} href={r.href}><span><strong>{r.title}</strong><small>{r.body}</small></span><span className="text-button">Open</span></Link>:<div className="stack-row" key={r.id}><span><strong>{r.title}</strong><small>{r.body}</small></span></div>)}</div></section>:null}
 </AdminShell>
}