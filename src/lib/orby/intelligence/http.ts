import {NextResponse} from 'next/server';
import type {AuthUser} from '@/src/lib/supabase/server';
import type {OrbyIdentity,OrbyJsonObject} from '../core/contracts';
import {createServerOrbyIntelligence} from './server';

const messages:Record<string,string>={
 ORBY_ACCESS_DENIED:'ليست لديك صلاحية للوصول إلى بيانات ORBY في هذه المساحة.',ORBY_ADMIN_REQUIRED:'يلزم دور المالك أو المدير لتنفيذ هذه العملية.',
 ORBY_MEMORY_DISABLED:'ذاكرة ORBY غير مفعلة لهذه المؤسسة.',ORBY_MEMORY_CONSENT_REQUIRED:'تتطلب الذاكرة طويلة المدى موافقة صريحة.',
 ORBY_DOCUMENT_EXTRACTOR_UNAVAILABLE:'لا يوجد مستخرج نص مناسب لهذا النوع من الملفات. يمكن إعداد موصل OCR للصور وملفات PDF الممسوحة.',
 ORBY_EMBEDDING_MODEL_UNAVAILABLE:'لا تتوفر خدمة تضمينات دلالية.',ORBY_KNOWLEDGE_SOURCE_NOT_FOUND:'مصدر المعرفة غير موجود.',ORBY_INSIGHT_NOT_FOUND:'لم يتم العثور على Insight المطلوب.',
 ORBY_DISABLED:'نواة ORBY غير مفعلة لهذه المساحة.',EXECUTION_DISABLED:'طبقة تنفيذ ORBY غير مفعلة لهذه المؤسسة.',TOOL_DISABLED:'الأداة المطلوبة غير مفعلة.',
};
export async function intelligenceIdentity(user:AuthUser,input:{organizationId?:unknown;workspaceId?:unknown},options:{admin?:boolean}={}):Promise<OrbyIdentity>{const organizationId=String(input.organizationId||'').trim(),workspaceId=String(input.workspaceId||'').trim();if(!organizationId)throw new Error('ORBY_ORGANIZATION_REQUIRED');const identity={organizationId,userId:user.id,workspaceId:workspaceId||organizationId},runtime=await createServerOrbyIntelligence(),membership=await runtime.memberships.resolve(identity);if(!membership)throw new Error('ORBY_ACCESS_DENIED');if(options.admin&&!['OWNER','ADMIN'].includes(membership.role))throw new Error('ORBY_ADMIN_REQUIRED');return identity;}
export function object(value:unknown):OrbyJsonObject{return value&&typeof value==='object'&&!Array.isArray(value)?value as OrbyJsonObject:{};}
export function requiredString(value:unknown,code:string,max=12000){const text=String(value||'').trim();if(!text||text.length>max)throw new Error(code);return text;}
export function intelligenceErrorResponse(error:unknown){const raw=error instanceof Error?error.message:'ORBY_INTERNAL_ERROR',code=raw.split(':')[0],status=code.includes('REQUIRED')||code.includes('INVALID')||code.includes('EMPTY')||code.includes('CONSENT')?400:code.includes('ACCESS')||code.includes('ADMIN')||code.includes('PERMISSION')?403:code.includes('NOT_FOUND')?404:code.includes('DISABLED')||code.includes('UNAVAILABLE')?503:500;return NextResponse.json({ok:false,error:{code,message:messages[code]||'تعذر إتمام عملية ORBY بأمان.'}},{status,headers:{'Cache-Control':'no-store'}});}
