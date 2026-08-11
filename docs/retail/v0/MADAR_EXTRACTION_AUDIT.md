# MADAR Retail Integration Audit

قرار المنتج تغيّر صراحةً في 2026-08-11 من تطبيق مستقل إلى مساحة متكاملة داخل `madar-platform`. لذلك أصبح هذا الملف يسجل ما تم دمجه وما بقي معزولًا.

| المجال | القرار | التنفيذ |
|---|---|---|
| Google/Auth/sessions | `REUSE` | مسارات مَدار الحالية وcookies وPKCE هي المصدر الوحيد؛ حُذف Auth Runtime الخاص بـRetail. |
| profiles/organization permissions | `REUSE + ADAPT` | profile و`organization_members` من المنصة؛ mapping OWNER/ADMIN/MEMBER إلى أدوار Retail. |
| Retail PostgreSQL والledgers | `REUSE` | بقي مشروع Supabase Retail منفصلًا؛ أضيف `platform_organization_id` وجسر service-only. |
| Financial RPCs/idempotency | `REUSE` | بقيت RPCs الأصلية دون إعادة كتابة، وتُستدعى بالactor الحقيقي داخل المعاملة. |
| RLS | `REUSE + HARDEN` | السياسات بقيت؛ أُلغي التنفيذ المباشر لـauthenticated وأصبح BFF هو trust boundary. |
| ORBY Core/providers/models | `REUSE` | Retail يستخدم نواة مَدار ومزوداتها وModel Registry بدل OpenRouter adapter مستقل. |
| Retail analytics/grounding | `REUSE` | الأرقام من قاعدة Retail الحتمية، وتدخل ORBY كevidence فقط. |
| UI/RTL/design | `ADAPT` | نُقلت صفحات Retail إلى `/retail` مع CSS scoped وهوية مَدار وروابط dashboard/admin. |
| Admin | `ADAPT` | لوحة Retail تحت `/admin/retail` وداخل Enterprise Admin Shell. |
| Sync API | `ADAPT` | انتقلت إلى `/api/retail/v1/sync` وتقبل Platform Bearer فقط. |
| Auth/SSR الخاص بـRetail | `DO_NOT_COPY` | وجود جلسة Supabase ثانية في المتصفح يكسر نموذج الصلاحيات الموحد. |
| Provider key/config الخاص بـRetail | `DO_NOT_COPY` | يمنع ازدواج المزودات والسياسات والتكاليف. |
| مستودع/Vercel Runtime المنفصل | `LEGACY` | لا يعتمد runtime المدمج عليهما؛ المصدر القانوني أصبح هذا المستودع ومشروع Vercel الرئيسي. |

قاعدة البيانات المنفصلة مقصودة لعزل البيانات وصحة الدفاتر، وليست حدود هوية ثانية. الأسرار لا تُنسخ إلى Git ولا إلى العميل.
