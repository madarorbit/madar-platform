'use client';

import { Button } from "@/components/ui/Enterprise";
import {
  ActiveFilterChip,
  DashboardAlertBlock,
  DashboardCriticalException,
  DashboardDataState,
  DashboardDrillDownLink,
  DashboardEmptyState,
  DashboardFilterBar,
  DashboardInsightBlock,
  DashboardLoadingState,
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardSection,
  DashboardStatusBlock,
  DashboardSummaryBlock,
  DashboardSupportingInfo,
  DashboardVisualizationShell,
  DataTrustIndicator,
  DateRangeControl,
  MetricContext,
} from "@/components/dashboard/Dashboard";

function ShowcaseGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="md-ds-section">
      <header>
        <h2 className="md-type-h2">{title}</h2>
        <p className="md-type-body-sm md-muted">{description}</p>
      </header>
      {children}
    </section>
  );
}

export default function DashboardDesignSystemShowcase() {
  return (
    <div className="md-dashboard-showcase">
      <div className="md-notice md-notice-info">
        <div>
          <strong>بيانات توضيحية للواجهة فقط</strong>
          <p className="md-help mt-1">
            هذه القيم لا تمثل نشاطًا أو خدمة إنتاجية؛ الغرض منها اختبار العقود البصرية والحالات بالعربية وRTL.
          </p>
        </div>
      </div>

      <ShowcaseGroup
        title="التسلسل الهرمي والمؤشرات (Hierarchy & Metrics)"
        description="بطاقة المؤشر مرنة: يمكن عرض القيمة وحدها، بينما السياق والمقارنة والثقة والحالة والإجراء كلها اختيارية."
      >
        <DashboardSection
          eyebrow="مثال مشترك"
          title="قراءة سريعة للحالة"
          description="العنوان والسياق يسبقان الزينة، ولا توجد دلالة تلقائية بأن الرقم الأعلى أفضل."
          actions={<Button size="sm" variant="secondary">إجراء اختباري</Button>}
        >
          <DashboardMetricGrid>
            <DashboardMetricCard
              label="مؤشر رئيسي بدون مقارنة"
              value="١٢٬٤٨٠"
              supportingContext="سياق مختصر يشرح الرقم دون تحويل البطاقة إلى تقرير."
            />
            <DashboardMetricCard
              label="مؤشر مع مرجع"
              value="٧٤"
              unit="وحدة"
              comparison={<MetricContext label="مقارنة مرجعية" value="+٦" kind="reference" />}
              trust={<DataTrustIndicator state="fresh" compact />}
              action={<DashboardDrillDownLink href="#dashboard-drilldown">عرض التفاصيل</DashboardDrillDownLink>}
            />
            <DashboardMetricCard
              label="تسمية عربية طويلة لاختبار الالتفاف والاستجابة على الشاشات الصغيرة"
              value="٣٫٨"
              unit="نقطة"
              status={<DataTrustIndicator state="partial" compact />}
              supportingContext="جزء من البيانات متوفر، لذلك يظهر سياق الثقة بدل إخفاء النقص."
              compactOnMobile
            />
          </DashboardMetricGrid>
        </DashboardSection>
      </ShowcaseGroup>

      <ShowcaseGroup
        title="الحالة والملاحظة والتنبيه والاستثناء الحرج (Status / Insight / Alert / Critical Exception)"
        description="أربع عقود دلالية مستقلة؛ الاختلاف ليس مجرد تغيير لون رسالة عامة واحدة."
      >
        <div className="grid gap-3">
          <DashboardStatusBlock
            title="الحالة مستقرة"
            description="وصف لحالة حالية لا يطلب من المستخدم إجراءً."
            tone="success"
          />
          <DashboardInsightBlock
            title="ظهر تغير يستحق الفهم"
            description="ملاحظة مفيدة قد تقود للتحقق، لكنها ليست تنبيهًا بحد ذاتها."
            action={<DashboardDrillDownLink href="#dashboard-insight">فهم السياق</DashboardDrillDownLink>}
          />
          <DashboardAlertBlock
            title="هناك أمر يحتاج مراجعة"
            description="التنبيه يوضح أن انتباه المستخدم مطلوب ويقدم مسارًا واضحًا عند الحاجة."
            severity="warning"
            action={<Button size="sm" variant="secondary">مراجعة</Button>}
          />
          <DashboardCriticalException
            title="لا يمكن الاعتماد على بعض الأرقام الآن"
            description="استثناء حرج يبقى ظاهرًا لأنه يغير سلامة القرار، وليس لأنه أحمر فقط."
            impact="قد تكون بعض القيم المعروضة غير مكتملة حتى استعادة مصدر البيانات."
            trust={<DataTrustIndicator state="stale" updatedAt="مثال توضيحي" />}
            action={<Button variant="danger">فتح الإجراء المرتبط</Button>}
          />
        </div>
      </ShowcaseGroup>

      <ShowcaseGroup
        title="حالات البيانات والثقة (Data States & Trust)"
        description="التحميل والفراغ والخطأ والبيانات الجزئية والقديمة حالات من الدرجة الأولى، ولا تتحول تلقائيًا إلى أصفار."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <DashboardSummaryBlock title="حالة بيانات جزئية" description="مثال لحالة ثقة على مستوى القسم.">
            <DashboardDataState
              state="partial"
              title="التغطية غير مكتملة"
              description="تم تحميل جزء من المصدر فقط؛ لا يعامل المحتوى كبيانات كاملة."
            />
          </DashboardSummaryBlock>
          <DashboardSummaryBlock title="حالة بيانات قديمة" description="تظهر فقط عندما تؤثر الحداثة على القرار.">
            <DashboardDataState
              state="stale"
              description="آخر تحديث أقدم من السياق المتوقع لهذا العرض."
            />
          </DashboardSummaryBlock>
          <DashboardEmptyState
            compact
            title="لا توجد بيانات ذات معنى بعد"
            description="يشرح النظام سبب الفراغ والخطوة التالية بدل عرض 0 — 0 — 0%."
            context="الصفر التجاري الصحيح يظل قيمة صحيحة داخل بطاقة المؤشر (MetricCard)؛ هذه الحالة مخصصة لغياب البيانات ذات المعنى."
            action={<Button size="sm">الخطوة التالية</Button>}
          />
          <DashboardLoadingState label="جارٍ تحميل المثال" cards={2} />
        </div>
      </ShowcaseGroup>

      <ShowcaseGroup
        title="المرشحات والفترة الزمنية (Filters & Date Range)"
        description="المرشحات العامة والمحلية (Global / Local) لها نطاق ظاهر، والمرشحات النشطة لا تختفي عن المستخدم."
      >
        <div className="grid gap-4">
          <DashboardFilterBar
            scope="global"
            label="سياق النظرة العامة"
            description="هذه المرشحات تمثل السياق المشترك للمحتوى ذي الصلة."
            clearHref="#dashboard-filters"
            activeFilters={
              <>
                <ActiveFilterChip label="النطاق" value="مثال عام" scope="global" removeHref="#dashboard-filters" />
                <ActiveFilterChip label="الفترة" value="آخر ٧ أيام" scope="global" />
              </>
            }
          >
            <DateRangeControl
              presets={[
                { label: "اليوم", href: "#today" },
                { label: "آخر ٧ أيام", href: "#week", active: true },
                { label: "آخر ٣٠ يومًا", href: "#month" },
              ]}
              from="2026-08-11"
              to="2026-08-17"
              action="#dashboard-filters"
            />
          </DashboardFilterBar>
          <DashboardFilterBar
            scope="local"
            label="سياق هذا القسم فقط"
            description="لا يوحي هذا النمط بأنه يغيّر بقية النظرة العامة."
          >
            <ActiveFilterChip label="مرشح محلي" value="قيمة توضيحية" scope="local" />
          </DashboardFilterBar>
        </div>
      </ShowcaseGroup>

      <ShowcaseGroup
        title="حاوية التصور والمعلومات المساندة (Visualization Shell & Supporting Information)"
        description="الحاوية تنظم العنوان والحالة والثقة فقط؛ نوع الرسم وقواعده مؤجلة إلى Phase 3.0."
      >
        <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
          <DashboardVisualizationShell
            title="حاوية تصور بلا نوع رسم مفروض"
            description="يمكن تركيب أي تمثيل يختاره نظام التصور لاحقًا."
            state="empty"
            trust={<DataTrustIndicator state="unknown" compact />}
          />
          <DashboardSupportingInfo
            title="سياق مساند"
            description="أقل وزنًا من الإشارة الأساسية ولا ينافسها بصريًا."
          >
            <p>محتوى تشغيلي أو تفسيري قصير يمكن تركيبه حسب حاجة النظرة العامة (Overview).</p>
          </DashboardSupportingInfo>
        </div>
      </ShowcaseGroup>
    </div>
  );
}
