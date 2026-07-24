import 'server-only';
import {z} from 'zod';

const optionalUrl=z.union([z.literal(''),z.string().url('الرابط غير صالح.')]).transform(value=>value||null);
const nullableUuid=z.union([z.literal(''),z.string().uuid('المعرف غير صالح.')]).transform(value=>value||null);
const booleanField=z.preprocess(value=>value==='on'||value==='true'||value===true,z.boolean());
const lines=z.preprocess(value=>String(value||'').split(/\r?\n|،|,/).map(item=>item.trim()).filter(Boolean),z.array(z.string().max(160)).max(100));

export const catalogSchema=z.object({
 id:z.union([z.literal(''),z.string().uuid()]).optional().default(''),
 kind:z.enum(['product','service','plan']),
 name:z.string().trim().min(2,'الاسم قصير جدًا.').max(180),
 slug:z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'الرابط المختصر يجب أن يكون أحرفًا إنجليزية صغيرة وأرقامًا وشرطات.'),
 short_description:z.string().trim().max(500).optional().default(''),
 long_description:z.string().trim().max(12000).optional().default(''),
 price:z.coerce.number().min(0).max(999999999),
 compare_at_price:z.preprocess(value=>value===''||value===null?null:value,z.coerce.number().min(0).nullable()),
 currency:z.string().trim().min(2).max(8).default('SAR'),
 category_id:nullableUuid,
 subcategory_id:nullableUuid,
 item_type:z.string().trim().min(2).max(40),
 status:z.enum(['draft','published','archived','coming_soon','sold_out','disabled']),
 visibility:z.enum(['visible','hidden']),
 availability:z.enum(['available','coming_soon','sold_out','disabled']).default('available'),
 sort_order:z.coerce.number().int().min(-100000).max(100000).default(0),
 thumbnail_url:optionalUrl,
 video_url:optionalUrl,
 external_url:optionalUrl,
 purchase_url:optionalUrl,
 keywords:lines,
 features:lines,
 includes:lines,
 seo_title:z.string().trim().max(180).optional().default(''),
 seo_description:z.string().trim().max(320).optional().default(''),
 delivery_duration:z.string().trim().max(120).optional().default(''),
 delivery_type:z.string().trim().max(40).optional().default('manual_delivery'),
 billing_interval:z.enum(['one_time','monthly','quarterly','yearly']).optional().default('monthly'),
 trial_days:z.coerce.number().int().min(0).max(365).optional().default(0),
 requires_approval:booleanField.default(false),
 is_free:booleanField.default(false),
 is_active:booleanField.default(false),
 is_featured:booleanField.default(false),
 show_in_store:booleanField.default(false),
 show_on_home:booleanField.default(false),
 allow_reviews:booleanField.default(false),
 allow_comments:booleanField.default(false),
});

export const taxonomySchema=z.object({
 id:z.union([z.literal(''),z.string().uuid()]).optional().default(''),
 kind:z.enum(['category','subcategory','tag']),
 name:z.string().trim().min(2).max(160),
 slug:z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
 description:z.string().trim().max(2000).optional().default(''),
 category_id:nullableUuid.optional().default(null),
 visibility:z.enum(['visible','hidden']).optional().default('hidden'),
 is_active:booleanField.default(false),
 sort_order:z.coerce.number().int().min(-100000).max(100000).default(0),
 seo_title:z.string().trim().max(180).optional().default(''),
 seo_description:z.string().trim().max(320).optional().default(''),
});

export const offerSchema=z.object({
 id:z.union([z.literal(''),z.string().uuid()]).optional().default(''),
 name:z.string().trim().min(2).max(180),
 slug:z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
 description:z.string().trim().max(2000).optional().default(''),
 discount_type:z.enum(['percentage','fixed','override_price']),
 discount_value:z.coerce.number().min(0).max(999999999),
 starts_at:z.string().optional().default(''),
 ends_at:z.string().optional().default(''),
 status:z.enum(['draft','published','archived','coming_soon','sold_out','disabled']),
 visibility:z.enum(['visible','hidden']),
 is_active:booleanField.default(false),
});

export const settingSchema=z.object({
 id:z.union([z.literal(''),z.string().uuid()]).optional().default(''),
 setting_key:z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
 setting_value:z.string().trim().min(2).max(20000).transform(value=>JSON.parse(value) as unknown),
 description:z.string().trim().max(1000).optional().default(''),
 is_public:booleanField.default(false),
});

export function formObject(form:FormData){return Object.fromEntries(form.entries())}
export function zodMessage(error:unknown){if(error instanceof z.ZodError)return error.issues[0]?.message||'تحقق من الحقول المدخلة.';return error instanceof Error?error.message:'تعذر التحقق من البيانات.'}
