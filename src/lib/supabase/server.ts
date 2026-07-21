import 'server-only';
import { cookies } from 'next/headers';
import { supabaseConfig } from '@/src/lib/env';

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'CUSTOMER';
export type Profile = { id:string; email:string; full_name:string|null; phone:string|null; avatar_url:string|null; role:Role; status:'active'|'disabled' };
export class SupabaseRequestError extends Error {
 constructor(public status:number, public code:string|undefined) { super('تعذر إتمام العملية. حاول مرة أخرى.'); }
}
export async function serverToken() { return (await cookies()).get('madar-access-token')?.value; }
export async function supabaseFetch(path:string, init:RequestInit = {}) {
 const {url,key}=supabaseConfig(); const token=await serverToken();
 const headers = new Headers(init.headers); headers.set('apikey', key); headers.set('Content-Type','application/json'); if(token) headers.set('Authorization',`Bearer ${token}`); headers.set('Prefer', headers.get('Prefer') || 'return=representation');
 const response=await fetch(`${url}${path}`, {...init, headers, cache:'no-store'});
 if(!response.ok) {
  const payload=await response.json().catch(()=>null) as {code?:string}|null;
  console.error('Supabase request failed', {path:path.split('?')[0],status:response.status,code:payload?.code});
  throw new SupabaseRequestError(response.status,payload?.code);
 }
 return response.status===204?null:response.json();
}
export async function currentUser(){ const token=await serverToken(); if(!token)return null; try{return await supabaseFetch('/auth/v1/user');}catch{return null;} }
export async function currentProfile(){ const user=await currentUser(); if(!user)return null; const rows=await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,full_name,phone,avatar_url,role,status`); return rows?.[0] as Profile|undefined; }
