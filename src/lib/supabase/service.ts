import 'server-only';
import {supabaseConfig} from '@/src/lib/env';
import {deploymentSupabaseServiceRoleKey} from '@/src/lib/integration/deployment-secrets';

export function supabaseServiceConfig(){
 const {url}=supabaseConfig();
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()||deploymentSupabaseServiceRoleKey.trim();
 if(!key)throw new Error('مفتاح خدمة Supabase غير مضبوط في بيئة الخادم.');
 return {url,key};
}
