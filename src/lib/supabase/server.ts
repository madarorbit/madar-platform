import 'server-only';
import { cookies } from 'next/headers';
import { supabaseConfig } from '@/src/lib/env';

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EDITOR' | 'CUSTOMER';
export type Profile = { id:string; email:string|null; full_name:string|null; phone:string|null; avatar_url:string|null; role:Role; status:'active'|'disabled' };
export type AuthUser = { id:string; email?:string|null; email_confirmed_at?:string|null; phone?:string|null; created_at?:string; app_metadata?:Record<string,unknown>|null; user_metadata?:Record<string,unknown>|null };

type SupabaseErrorPayload={code?:string;message?:string;msg?:string;error_description?:string;details?:string;hint?:string};
const domainErrorMessages:Record<string,string>={
 'Authentication required':'يجب تسجيل الدخول لإتمام العملية.',
 'Not authorized':'ليست لديك صلاحية لتنفيذ هذه العملية.',
 'User not found':'لا يوجد مستخدم مسجل بهذا البريد الإلكتروني.',
 'Member already exists':'هذا المستخدم عضو في المساحة بالفعل.',
 'Admins may add members only':'مدير المساحة يستطيع إضافة أعضاء عاديين فقط.',
 'Ownership transfer is not available here':'لا يمكن نقل ملكية المساحة من هذه الصفحة.',
 'Member not found':'المستخدم المحدد ليس عضوًا في المساحة.',
 'Admins may remove members only':'مدير المساحة يستطيع إزالة الأعضاء العاديين فقط.',
 'You cannot remove yourself':'لا يمكنك إزالة عضويتك بنفسك.',
 'Invalid operation':'عملية إدارة العضوية غير صالحة.'
};
function requestErrorMessage(status:number,payload:SupabaseErrorPayload|null){
 const source=payload?.message||payload?.msg||payload?.error_description||'';
 if(domainErrorMessages[source])return domainErrorMessages[source];
 if(status===401)return'انتهت جلسة تسجيل الدخول. سجّل الدخول مجددًا.';
 if(status===403)return'ليست لديك صلاحية لتنفيذ هذه العملية.';
 if(status===404)return'لم يتم العثور على البيانات المطلوبة.';
 if(status===409||payload?.code==='23505')return'توجد بيانات مسجلة بالقيمة نفسها بالفعل.';
 if(status===413)return'حجم الملف أو الطلب أكبر من الحد المسموح.';
 if(status===422)return'تعذر قبول البيانات أو انتهت صلاحية الرابط المستخدم.';
 if(status===429)return'تمت محاولات كثيرة خلال وقت قصير. حاول مجددًا بعد قليل.';
 return status>=500?'الخدمة غير متاحة مؤقتًا. حاول مجددًا بعد قليل.':'تعذر إتمام العملية. تحقق من البيانات وحاول مرة أخرى.';
}
export class SupabaseRequestError extends Error {
 constructor(public status:number,public code:string|undefined,message:string){super(message);this.name='SupabaseRequestError';}
}
export async function serverToken() { return (await cookies()).get('madar-access-token')?.value; }
export async function supabaseFetch(path:string, init:RequestInit = {}) {
 const {url,key}=supabaseConfig(); const token=await serverToken();
 const headers = new Headers(init.headers); headers.set('apikey', key); headers.set('Content-Type','application/json'); if(token) headers.set('Authorization',`Bearer ${token}`); headers.set('Prefer', headers.get('Prefer') || 'return=representation');
 const response=await fetch(`${url}${path}`, {...init, headers, cache:'no-store'});
 if(!response.ok) {
  const payload=await response.json().catch(()=>null) as SupabaseErrorPayload|null;
  const context={path:path.split('?')[0],status:response.status,code:payload?.code};
  if(response.status>=500)console.error('Supabase request failed',context);
  else if(payload?.code!=='P0001')console.warn('Supabase request rejected',context);
  throw new SupabaseRequestError(response.status,payload?.code,requestErrorMessage(response.status,payload));
 }
 return response.status===204?null:response.json();
}
export async function currentUser():Promise<AuthUser|null>{ const token=await serverToken(); if(!token)return null; try{return await supabaseFetch('/auth/v1/user') as AuthUser;}catch{return null;} }
export async function profileForUser(userId:string):Promise<Profile|undefined>{ const rows=await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,full_name,phone,avatar_url,role,status`); return rows?.[0] as Profile|undefined; }
export async function currentProfile(){ const user=await currentUser(); if(!user)return null; return profileForUser(user.id); }
