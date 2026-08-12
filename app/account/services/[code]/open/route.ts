import {NextResponse} from 'next/server';
import {currentUser,supabaseFetch} from '@/src/lib/supabase/server';
import {isServiceCode,serviceDefinition} from '@/src/lib/services/catalog';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:Request,{params}:{params:Promise<{code:string}>}){
 const user=await currentUser();
 const{code:rawCode}=await params,code=rawCode.toUpperCase();
 if(!user){const target=new URL('/login',request.url);target.searchParams.set('next',`/account/services/${encodeURIComponent(rawCode)}/open`);return NextResponse.redirect(target);}
 if(!isServiceCode(code))return NextResponse.redirect(new URL('/account?error=service',request.url));
 const rows=await supabaseFetch(`/rest/v1/workspace_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&service_code=eq.${encodeURIComponent(code)}&status=eq.active&activation_state=eq.ACTIVE&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&select=organization_id,service_code&order=created_at.desc&limit=1`).catch(()=>[]) as Array<{organization_id:string;service_code:string}>;
 const subscription=rows[0];
 if(!subscription)return NextResponse.redirect(new URL(`/account/services/${code}/setup`,request.url));
 if(code!=='MADAR_RETAIL')await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,{method:'PATCH',body:JSON.stringify({default_commercial_organization_id:subscription.organization_id})});
 return NextResponse.redirect(new URL(serviceDefinition(code).runtimeHref,request.url));
}
