import {redirect} from 'next/navigation';
import {requireAdmin} from '@/src/lib/auth';
import {signedFeedbackAttachment} from '@/src/lib/feedback-attachments';
import {supabaseFetch} from '@/src/lib/supabase/server';

export const runtime='nodejs';export const dynamic='force-dynamic';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 await requireAdmin();const{id}=await params;
 const feedback=(await supabaseFetch(`/rest/v1/platform_feedback?id=eq.${encodeURIComponent(id)}&select=attachment_path`))?.[0];
 if(!feedback?.attachment_path)return Response.json({error:'لا يوجد مرفق لهذا البلاغ.'},{status:404});
 redirect(await signedFeedbackAttachment(feedback.attachment_path,120));
}
