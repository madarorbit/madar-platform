import {redirect} from 'next/navigation';
import {requireAdmin} from '@/src/lib/auth';
import {signedLocalPaymentProof} from '@/src/lib/local-payments';
import {supabaseFetch} from '@/src/lib/supabase/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 await requireAdmin();
 const{id}=await params;
 if(!uuid.test(id))redirect('/admin/orby-plus?error=proof');
 const rows=await supabaseFetch(`/rest/v1/orby_plus_payment_requests?id=eq.${encodeURIComponent(id)}&select=storage_path&limit=1`).catch(()=>[]) as Array<{storage_path:string|null}>;
 const path=rows[0]?.storage_path;
 if(!path)redirect('/admin/orby-plus?error=proof');
 let url:string;
 try{url=await signedLocalPaymentProof(path);}catch{redirect('/admin/orby-plus?error=proof');}
 redirect(url);
}
