"use server";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import type {Role} from "@/lib/permissions";
const allowed:Role[]=["subcontractor","installer","supervisor","office","commercial"];
export async function startRolePreview(fd:FormData){const supabase=await createClient();const {data}=await supabase.rpc("current_app_role");if(data!=="owner")redirect("/");const role=String(fd.get("role")||"") as Role;if(!allowed.includes(role))redirect("/");const jar=await cookies();jar.set("resinspec_view_as",role,{httpOnly:true,sameSite:"lax",secure:true,path:"/"});redirect("/");}
export async function stopRolePreview(){const jar=await cookies();jar.delete("resinspec_view_as");redirect("/");}
