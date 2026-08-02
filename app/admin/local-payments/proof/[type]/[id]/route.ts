import {NextResponse} from 'next/server';
import {requireAdmin} from '@/src/lib/auth';
import {signedLocalPaymentProof} from '@/src/lib/local-payments';
import {supabaseFetch} from '@/src/lib/supabase/server';

export async function GET(request:Request,{params}:{params:Promise<{type:string;id:string}>}){
 await requireAdmin();const{type,id}=await params;
 const table=type==='workspace'?'workspace_payment_submissions':type==='renewal'?'subscription_renewal_requests':type==='v2'?'pricing_local_payment_requests':null;
 if(!table)return new NextResponse('غير موجود',{status:404});
 const row=(await supabaseFetch(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=storage_path&limit=1`))?.[0];
 if(!row)return new NextResponse('غير موجود',{status:404});
 try{return NextResponse.redirect(await signedLocalPaymentProof(row.storage_path))}catch{return new NextResponse('تعذر فتح الإثبات',{status:502})}
}
