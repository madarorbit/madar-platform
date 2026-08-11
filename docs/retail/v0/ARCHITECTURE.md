# MADAR Retail Integration Architecture

## الحدود الحالية

MADAR Retail مساحة مستقلة وظيفيًا داخل `madar-platform`، وليست تطبيق Auth ثانيًا. المنصة الرئيسية هي مصدر الهوية والصلاحيات والمزودات وORBY؛ مشروع Supabase Retail يبقى قاعدة بيانات مالية منفصلة.

```mermaid
flowchart TD
  B["المتصفح / Android القادم"] --> P["MADAR Platform · جلسة وصلاحيات"]
  P --> R["Retail BFF · /api/retail + Server Actions"]
  R --> D["Supabase Retail المنفصل"]
  R --> O["ORBY Core + Provider Registry في مَدار"]
  D --> L["Inventory · Cash · Debt Ledgers"]
  L --> A["Deterministic Analytics"]
  A --> O
```

## مسارات المنتج

| السطح | المسار |
|---|---|
| Landing عامة | `/retail` |
| إعداد المنظمة | `/retail/onboarding` |
| مساحة التشغيل | `/retail/workspace/*` |
| إدارة Retail | `/admin/retail` |
| ORBY Retail | `/api/retail/orby` |
| Sync v1 | `/api/retail/v1/sync/*` |

## الثقة والبيانات

- Cookies `madar-access-token` و`madar-refresh-token` تخص Supabase الرئيسي فقط.
- العضوية في `organization_members` هي مصدر صلاحية Retail؛ OWNER/ADMIN/MEMBER تتحول إلى OWNER/MANAGER/STAFF.
- `platform_organization_id` يربط منظمة مَدار بمساحة Retail واحدة دون foreign key بين قاعدتين.
- `RETAIL_SUPABASE_SERVICE_ROLE_KEY` لا يصل إلى Client Component. الخادم يتحقق أولًا من جلسة مَدار والمنظمة ثم يقيّد كل قراءة بـworkspace المرتبط.
- الكتابات لا تنفذ CRUD ماليًا. `retail_platform_execute` جسر service-only بقائمة عمليات ثابتة، يعيد actor UUID داخل معاملة PostgreSQL ثم يستدعي RPCs الأصلية؛ لذلك تبقى الذرية، idempotency، العضوية، الاشتراك والledgers فعالة.
- قاعدة Retail لا تمنح `authenticated` تنفيذ SECURITY DEFINER RPCs؛ فحص Supabase Security Advisor بعد التقوية = صفر ملاحظات.

## الطبقات

| الطبقة | المسار |
|---|---|
| UI | `app/retail`, `components/retail-v0` |
| BFF/Auth federation | `src/lib/retail/server/auth`, `src/lib/retail/supabase` |
| Domain | `src/lib/retail/domain`, `src/lib/retail/types.ts` |
| Financial mutations | `src/lib/retail/server/retail/actions.ts` + PostgreSQL RPCs |
| Analytics | `src/lib/retail/server/analytics` + `retail_analytics_snapshot` |
| ORBY | `app/api/retail/orby`, ORBY Core الرئيسي، grounding الحتمي |
| Sync | `app/api/retail/v1/sync`, `src/lib/retail/sync` |
| Database | `supabase-retail/migrations` |

Dashboard يجمع الأرقام في SQL، ولا ينقل آلاف الصفوف للمتصفح. الأموال `numeric` والحركات المالية تنجح كاملة أو تتراجع كاملة.
