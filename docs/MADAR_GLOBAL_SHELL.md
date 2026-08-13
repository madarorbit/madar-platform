# MADAR Global Shell & Navigation 3.0

هذه الوثيقة هي المرجع التنفيذي للهيكل الذي يحيط بمنصة مَدار. تعتمد
`MADAR_UX_ARCHITECTURE.md` و`MADAR_DESIGN_SYSTEM_2.md` ولا تعيد تعريفهما.

## 1. العقد المعماري

- يوجد Shell تفاعلي واحد للحساب وRetail وConnected وNative:
  `components/shell/MadarGlobalShell.tsx`.
- ملفات `AccountShell` و`EnterpriseWorkspaceShell` و`RetailWorkspaceShell` محوّلات
  سياق فقط؛ لا تملك Header أو Drawer أو Bottom navigation مستقلًا.
- الصفحات العامة والتجارة تستخدم `PageShell` و`Navbar` المشتركين بنفس عناصر الطبقة
  العالمية.
- ORBY يحتفظ بتخطيط المحادثة المركز، لكنه يستخدم طبقات مَدار وإجراءات المستخدم نفسها.
- Admin بيئة مميزة عمدًا؛ الدخول والعودة إلى المنصة واضحان، ولا يعاد تصميم محتواه هنا.

## 2. مستويات التنقل

| المستوى | السؤال الذي يجيب عنه | المصدر |
|---|---|---|
| Platform | أين أنا داخل مَدار؟ | `platformLayerNavigation` |
| Workspace | أين أنا داخل الخدمة الحالية؟ | Retail IA أو `workspaceNavigationGroups` |
| Local | أي تبويب/جزء من الصفحة؟ | مكوّن الصفحة أو `ShellModuleContext` |

لا تُستخدم Tabs كبديل للمستويين الأول والثاني. مصدر المصطلحات والمسارات العالمية هو
`src/lib/ux/platform-navigation.ts`، ومصدر Connected/Native المشروط هو
`src/lib/v2/navigation.ts`.

## 3. Global Shell

يتكون Shell من:

1. Skip link إلى المحتوى.
2. Sidebar سياقية على Desktop.
3. Top bar ثابتة أثناء تنقل الصفحات الفرعية.
4. منطقة محتوى لا تنهار عند خطأ القسم.
5. Bottom navigation مستقلة على Mobile.
6. Sheet موحدة باسم «طبقات مَدار».
7. ORBY floating entry خارج المحتوى.

بيانات الهوية والإشعارات والخدمات النشطة تُقرأ مرة لكل طلب عبر الدوال المحفوظة في
`src/lib/shell/server.ts`. لا تُنقل صلاحية حماية إلى العميل؛ القوائم تعرض ما تحقق منه
الخادم فقط، وتبقى Gates في المسارات والخادم.

## 4. Top bar

الترتيب المنطقي:

- Layers trigger.
- رجوع/تقدم مع fallback إلى Home للسياق.
- اسم المجموعة والمسار الحالي.
- بحث متجر في الحساب، أو Command palette داخل Workspace.
- ORBY، السلة، الإشعارات، Avatar.

على Mobile يختفي البحث الوسطي وتبقى هوية السياق والإجراءات الضرورية. لا يُنسخ
Desktop header كاملًا، ويكون الوصول إلى بقية العناصر من Bottom navigation وSheet.

## 5. طبقات مَدار

`MadarLayerNavigation` تعرض:

- الرئيسية.
- خدماتي.
- ORBY.
- المتجر، طلباتي، مكتبتي.
- الحساب، الاشتراكات، الإشعارات، المظهر.
- الخدمات والمساحات النشطة التي يملكها المستخدم فقط.

للزائر تعرض الرئيسية والخدمات وORBY والمتجر وتسجيل الدخول/إنشاء الحساب. الروابط
العامة الثانوية مثل المدونة والمساعدة تبقى ضمن Navigation العامة ولا تنافس طبقة الحساب.

## 6. تبديل الخدمة والمساحة

صيغة العنصر: `اسم التجارة — اسم الخدمة`.

- Retail يفتح Runtime المعتمد مباشرة.
- Connected وNative يمران عبر
  `/account/workspaces/[organizationId]/open`.
- مسار التبديل يتحقق خادميًا من UUID والعضوية واشتراك تجاري Active وغير منتهٍ، ثم
  ينفذ `can_view` قبل حفظ HttpOnly cookie والانتقال إلى `/workspace`.
- لا تظهر الخدمات Pending/Expired/Suspended في Switcher؛ تبقى حالتها وإجراءها في
  «خدماتي» و«الاشتراكات».
- فشل التحقق يعيد إلى «خدماتي» برسالة خطأ، ولا يبدل السياق.

## 7. Workspace Shell

### Retail

Primary navigation: الرئيسية، المبيعات، المنتجات، المخزون. التوريد والعلاقات والمال
والتقارير والإعدادات مجموعات ثانوية. Mobile primary: الرئيسية، المبيعات، المنتجات،
ORBY، ثم المزيد.

### Connected Business

تعكس `CONNECTED_EXTERNAL`: نظرة عامة، الربط والمزامنة، ORBY، البيانات الواصلة،
المراقبة والتقارير، المهام، الإعدادات. لا تُعرض عملية Native غير موجودة.

### Native Business

تعكس `MADAR_NATIVE` والوحدات المفعلة فعليًا: النظرة العامة، التشغيل بحسب القطاع،
الربط/الأتمتة، الإدارة، ORBY. الوحدات غير المفعلة لا تظهر.

## 8. Desktop وMobile

| الحجم | السلوك |
|---|---|
| 1440+ | Sidebar كاملة، Top bar بثلاث مناطق، محتوى واسع مضبوط |
| 1024–1439 | نفس hierarchy بمساحة أكثر إحكامًا وقابلية طي Sidebar |
| 768–1023 | لا Sidebar؛ Header سياقية وBottom navigation وSheet |
| 390–767 | Header مختصرة، لا بحث وسطي، 4 وجهات + المزيد |
| 360–389 | أسماء وإجراءات أكثر اختصارًا مع بقاء touch targets |

Bottom navigation تستخدم أربعة عناصر معتمدة وزر «المزيد» فقط. تأخذ safe area في
الحسبان، ويترك المحتوى مسافة تمنع تغطيته. Floating ORBY يحجز مساحة Bottom nav،
ويتحرك بعد long press ثم يلتصق بأقرب حافة ويحفظ موضعه محليًا.

## 9. الحساب والإشعارات والتجارة

- الضغط على Avatar يفتح Menu مختصرة: الرئيسية، خدماتي، الاشتراكات، المدفوعات، مكتبتي، المظهر،
  الإدارة عند الصلاحية، وتسجيل الخروج.
- Notification menu تعرض العدد وآخر خمسة أحداث ورابط المركز. Toasts ليست جزءًا منها.
- السلة تستخدم `CartStatusLink` نفسه في Public/Account/Workspace/ORBY ولا تغير منطقها.
- المتجر والمكتبة والطلبات وجهات Platform، وليست Workspace مستقلة.
- الاشتراكات منفصلة عن مشتريات المتجر.

## 10. ORBY

- هوية واحدة ومسار واحد `/orby`.
- فتحه من Platform يعطي General/User context.
- فتحه من Retail أو Workspace يمرر المنظمة والخدمة المصرح بهما.
- Header المحادثة تعرض Layers، العودة إلى السياق، المحادثات، السياق الحالي، إجراءات
  الحساب، ومحادثة جديدة.
- `GlobalUserActions` تخفي رابط ORBY داخل ORBY نفسه لتجنب التكرار.
- Composer لم يتغير، وORBY Core لم يتغير.

## 11. Back وDeep links

- زر الرجوع يستخدم History فقط إذا كان `document.referrer` داخليًا ومختلفًا؛ وإلا
  يعود إلى Home السياق. هذا يمنع Dead end عند فتح Deep link مباشرة.
- Proxy يحفظ `pathname + search` في `next` للضيف على المسارات المحمية.
- فتح `/workspace` أو `/retail/workspace` بلا استحقاق يعيد إلى الحساب ولا يعرض
  Navigation غير مسموحة.
- Success/Checkout behavior لم يُغير في هذه المرحلة.

## 12. Theme وAccessibility

- كل عناصر Shell تستخدم Semantic tokens وتعمل مع Light/Dark/System.
- `Sheet` تحبس focus، تدعم Escape، وتعيد focus إلى العنصر السابق.
- `Menu` تدعم Escape والإغلاق خارجها، ولها أسماء واضحة.
- Icon-only actions لها `aria-label`، والروابط النشطة تستخدم `aria-current` مع حد/علامة
  إضافية لا اللون وحده.
- يوجد Skip link، ترتيب DOM منطقي، touch targets، RTL، و`prefers-reduced-motion`.
- الأكواد وIDs والنص LTR يعالجان موضعيًا داخل المحتوى، ولا تقلب Shell أيقونات غير اتجاهية.

## 13. Error وLoading

أخطاء Account/Workspace/Retail تظهر داخل منطقة المحتوى وتترك Shell قابلة للاستخدام.
Loading يستخدم Skeleton مطابقًا للمحتوى. ORBY له Loading shell خاص به، ولا يظهر فراغًا
أبيض. عطل Global identity/session وحده يخرج إلى Gate المناسب.

## 14. Migration

تم إيقاف ملكية التنقل داخل:

- `components/account/AccountShell.tsx`
- `components/workspace/EnterpriseWorkspaceShell.tsx`
- `components/retail-v0/layout/RetailWorkspaceShell.tsx`

هذه الملفات تبقى adapters بأسماء مستقرة لتجنب كسر imports، وتُحذف عندما تنتقل
المسارات إلى تعريف السياق المباشر. لا تُنشأ أسماء `Old/New`.

## 15. حدود المرحلة والفجوات

- تفاصيل Home وAccount مؤجلة للمرحلة الرابعة.
- محتوى صفحات Store وAdmin القديمة ما زال يحتاج ترحيل DS تدريجي؛ Shell لا يخفي ذلك.
- Admin يحتفظ بـShell مميزة مع انتقال واضح فقط؛ إعادة تصميمه خارج النطاق.
- لا توجد بيانات موثوقة في كل Connected workspace لعرض last sync/error في Top bar؛
  لا نخترعها.
- لا يوجد Global Search جديد؛ البحث العالمي الحالي للمتجر وCommand palette للمساحة.
- لا AR/VR ولا صفحات فارغة ولا Voice mode مستقل.

## 16. بوابة القبول

يلزم قبل إعلان المرحلة مكتملة: typecheck، lint، جميع tests، production build، فحص
Guest routes وAuth redirects وdeep links، فحص Production deployment/logs، ثم تسجيل
أي رحلة لم يمكن اختبارها بحساب حقيقي بصراحة في تقرير التسليم.
