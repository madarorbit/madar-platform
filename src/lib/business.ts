import 'server-only';
import {redirect} from 'next/navigation';
import {requireUser} from '@/src/lib/auth';
import {supabaseFetch} from '@/src/lib/supabase/server';

export type WorkspaceType='INDIVIDUAL'|'MERCHANT'|'COMPANY'|'STUDENT';
export type WorkspaceRecord={id:string;name:string;slug:string;type:WorkspaceType;status:string;currency:'YER'|'SAR'|'USD'};
export type BusinessWorkspace=WorkspaceRecord&{type:Exclude<WorkspaceType,'STUDENT'>};
export type WorkspaceMembership={role:'OWNER'|'ADMIN'|'MEMBER';organizations:WorkspaceRecord};
export type BusinessMembership=Omit<WorkspaceMembership,'organizations'>&{organizations:BusinessWorkspace};

export async function requireBusinessWorkspace(){
 const user=await requireUser();
 const rows=await supabaseFetch(`/rest/v1/organization_members?user_id=eq.${encodeURIComponent(user.id)}&select=role,organizations(id,name,slug,type,status,currency)`);
 const candidate=(rows||[]).find((row:WorkspaceMembership)=>row.organizations&&row.organizations.type!=='STUDENT') as WorkspaceMembership|undefined;
 if(!candidate?.organizations)redirect('/onboarding');
 if(candidate.organizations.status!=='active')redirect('/dashboard');
 const membership=candidate as BusinessMembership;
 return{user,membership,workspace:membership.organizations};
}

export function businessMoney(value:number|string|null|undefined,currency='YER'){
 return new Intl.NumberFormat('ar-YE',{style:'currency',currency,maximumFractionDigits:2}).format(Number(value||0));
}

export function numberValue(value:FormDataEntryValue|null,label:string,{min=0,allowZero=true}:{min?:number;allowZero?:boolean}={}){
 const number=Number(value);
 if(!Number.isFinite(number)||number<min||(!allowZero&&number===0))throw new Error(`${label} غير صالح.`);
 return number;
}
