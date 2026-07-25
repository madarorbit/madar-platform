import {requireSuperAdmin} from '@/src/lib/auth';
import {supabaseFetch} from '@/src/lib/supabase/server';
import {supabaseServiceConfig} from '@/src/lib/supabase/service';

export const dynamic='force-dynamic';
const encodeStoragePath=(path:string)=>path.split('/').map(encodeURIComponent).join('/');

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 await requireSuperAdmin();const{id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return new Response('ملف غير صالح.',{status:400});
 const rows=await supabaseFetch(`/rest/v1/job_applications?id=eq.${encodeURIComponent(id)}&select=cv_storage_path,cv_file_name,cv_mime_type&limit=1`) as Array<{cv_storage_path:string|null;cv_file_name:string|null;cv_mime_type:string|null}>;
 const row=rows[0];if(!row?.cv_storage_path)return new Response('لا توجد سيرة ذاتية لهذا الطلب.',{status:404});
 const{url,key}=supabaseServiceConfig(),response=await fetch(`${url}/storage/v1/object/career-cvs/${encodeStoragePath(row.cv_storage_path)}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:'no-store'});
 if(!response.ok)return new Response('تعذر فتح السيرة الذاتية.',{status:502});
 const filename=(row.cv_file_name||'cv').replace(/[\r\n"]/g,'_');
 return new Response(await response.arrayBuffer(),{headers:{'Content-Type':row.cv_mime_type||'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
