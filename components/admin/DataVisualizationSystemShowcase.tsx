'use client';

import { DashboardMetricCard, DashboardMetricGrid, DashboardSummaryBlock, DashboardVisualizationShell, DataTrustIndicator } from "@/components/dashboard/Dashboard";
import {
  CategoryBarChart,
  CompositionDonut,
  Sparkline,
  StackedBarChart,
  TargetProgress,
  TrendChart,
} from "@/components/dashboard/visualization";

function VisualizationExample({
  title,
  question,
  useWhen,
  avoidWhen,
  children,
}: {
  title: string;
  question: string;
  useWhen: string;
  avoidWhen: string;
  children: React.ReactNode;
}) {
  return (
    <section className="md-ds-section">
      <header>
        <h3 className="md-type-h2">{title}</h3>
        <div className="md-viz-showcase-choice">
          <p><strong>السؤال:</strong> {question}</p>
          <p><strong>استخدمه عندما:</strong> {useWhen}</p>
          <p><strong>لا تستخدمه عندما:</strong> {avoidWhen}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

const trendData = [
  { label: "١ أغسطس", current: 44 },
  { label: "٢ أغسطس", current: 52 },
  { label: "٣ أغسطس", current: null, tooltipContext: "هذه النقطة مفقودة عمدًا لإثبات أن Missing لا تتحول إلى صفر." },
  { label: "٤ أغسطس", current: 61 },
  { label: "٥ أغسطس", current: 58 },
  { label: "٦ أغسطس", current: 69 },
  { label: "٧ أغسطس", current: 73 },
];

const comparisonData = [
  { label: "الأسبوع ١", current: 62, previous: 55 },
  { label: "الأسبوع ٢", current: 68, previous: 58 },
  { label: "الأسبوع ٣", current: 64, previous: 61 },
  { label: "الأسبوع ٤", current: 75, previous: 66 },
];

const categoryData = [
  { label: "قناة البيع المباشر داخل المتجر الرئيسي", value: 76 },
  { label: "الطلبات القادمة من واجهة التجارة الإلكترونية", value: 59 },
  { label: "المبيعات الناتجة عن التواصل المباشر مع العميل", value: 43 },
  { label: "قناة إضافية ذات تسمية عربية طويلة للاختبار", value: 31 },
];

const stackedData = [
  { label: "يناير", first: 42, second: 31, third: 18 },
  { label: "فبراير", first: 48, second: 27, third: 21 },
  { label: "مارس", first: 45, second: 35, third: 24 },
  { label: "أبريل", first: 54, second: 32, third: 19 },
];

export default function DataVisualizationSystemShowcase() {
  return (
    <div className="md-viz-showcase-grid">
      <div className="md-notice md-notice-info">
        <div>
          <strong>بيانات توضيحية للواجهة فقط</strong>
          <p className="md-help mt-1">هذه الأمثلة لا تمثل Retail أو Connected أو Native ولا تستورد أي بيانات أعمال؛ الغرض منها تعليم اختيار التمثيل واختبار الحالات بالعربية وRTL.</p>
        </div>
      </div>

      <VisualizationExample
        title="الاتجاه عبر الزمن (Trend)"
        question="كيف تغير الشيء بمرور الوقت؟"
        useWhen="تحتاج رؤية شكل الحركة والتوقيت والاستمرارية."
        avoidWhen="السؤال مجرد مقارنة فئات مستقلة أو رقم واحد يكفي لاتخاذ القرار."
      >
        <DashboardVisualizationShell
          title="اتجاه أحادي السلسلة مع فجوة بيانات"
          description="الخط ينقطع عند النقطة المفقودة ولا يحولها إلى صفر ولا يصل عبرها افتراضيًا."
          trust={<DataTrustIndicator state="partial" compact detail="جزء من الفترة غير مكتمل" />}
        >
          <TrendChart
            data={trendData}
            series={[{ key: "current", label: "القيمة الحالية", color: "series-1", format: { style: "number", maximumFractionDigits: 0 } }]}
            ariaLabel="رسم اتجاه أحادي السلسلة يحتوي نقطة مفقودة"
            summary="ترتفع القيم عمومًا خلال الفترة، مع غياب قياس يوم ٣ أغسطس؛ لا يعامل الغياب على أنه صفر."
            partialRange={{ fromLabel: "٣ أغسطس", toLabel: "٣ أغسطس", label: "بيانات ناقصة" }}
          />
        </DashboardVisualizationShell>
      </VisualizationExample>

      <VisualizationExample
        title="المقارنة المرجعية داخل الاتجاه"
        question="كيف تتحرك القيمة الحالية مقارنة بمرجع ذي معنى؟"
        useWhen="للمرجع وظيفة واضحة مثل فترة سابقة أو Benchmark، وليس لمجرد توفر سلسلة ثانية."
        avoidWhen="المقارنة لا تضيف قرارًا أو تجعل الرسم مزدحمًا."
      >
        <DashboardVisualizationShell
          title="حالي مقابل فترة مرجعية"
          description="السلسلة المرجعية متقطعة وأهدأ؛ الهدف يظهر كمرجع مستقل لا كسلسلة فعلية."
          trust={<DataTrustIndicator state="stale" compact updatedAt="مثال توضيحي" />}
        >
          <TrendChart
            data={comparisonData}
            series={[
              { key: "current", label: "الفترة الحالية", color: "series-1", format: { maximumFractionDigits: 0 } },
              { key: "previous", label: "الفترة المرجعية", color: "series-2", role: "reference", format: { maximumFractionDigits: 0 } },
            ]}
            reference={{ value: 70, label: "هدف توضيحي", kind: "target" }}
            ariaLabel="مقارنة اتجاه الفترة الحالية بفترة مرجعية وهدف"
            summary="السلسلة الحالية أعلى من المرجعية في النقاط الأربع، ويوجد خط هدف توضيحي عند 70. حالة البيانات موضحة كقديمة في الـShell."
          />
        </DashboardVisualizationShell>
      </VisualizationExample>

      <VisualizationExample
        title="مقارنة الفئات (Category Bar)"
        question="كيف نقارن بين فئات؟"
        useWhen="الفئات مستقلة والفرق بينها هو السؤال الأساسي، خصوصًا عندما تكون التسميات العربية طويلة."
        avoidWhen="السؤال زمني مستمر أو جزء من إجمالي بسيط."
      >
        <DashboardVisualizationShell title="أعمدة أفقية لتسميات عربية طويلة" description="الوضع Auto يتحول إلى أفقي على الهاتف أو عند طول التسميات بدل تدوير النص العربي.">
          <CategoryBarChart
            data={categoryData}
            valueKey="value"
            valueLabel="قيمة توضيحية"
            orientation="auto"
            ariaLabel="مقارنة أفقية بين أربع فئات ذات أسماء عربية طويلة"
            summary="الفئة الأولى هي الأعلى ثم الثانية ثم الثالثة ثم الرابعة. التسميات تظهر أفقيًا وقابلة للالتفاف بدل تدويرها."
            format={{ maximumFractionDigits: 0 }}
          />
        </DashboardVisualizationShell>
      </VisualizationExample>

      <VisualizationExample
        title="تركيب الإجمالي عبر فترات (Stacked Bar)"
        question="كيف يتكون الإجمالي من أجزاء عبر فئات أو فترات؟"
        useWhen="الأجزاء غير سالبة ومحدودة وعددها يسمح بفهم التركيب."
        avoidWhen="المطلوب مقارنة عشرات الأجزاء الصغيرة بدقة أو توجد قيم موجبة وسالبة مختلطة."
      >
        <DashboardVisualizationShell title="تركيب من ثلاثة أجزاء" description="الألوان تعرّف السلاسل فقط، والـLegend النصية تشرحها.">
          <StackedBarChart
            data={stackedData}
            segments={[
              { key: "first", label: "الجزء الأول", color: "series-1" },
              { key: "second", label: "الجزء الثاني", color: "series-2" },
              { key: "third", label: "الجزء الثالث", color: "series-3" },
            ]}
            ariaLabel="أعمدة مكدسة توضح تركيب إجمالي من ثلاثة أجزاء عبر أربعة أشهر"
            summary="يعرض المثال ثلاثة أجزاء غير سالبة عبر أربعة أشهر، مع بقاء هوية كل جزء ثابتة بين الفترات."
          />
        </DashboardVisualizationShell>
      </VisualizationExample>

      <VisualizationExample
        title="أجزاء قليلة من إجمالي (Composition Donut)"
        question="كيف يتكون إجمالي بسيط من عدد قليل من الأجزاء؟"
        useWhen="السؤال Part-to-whole وعدد الفئات قليل والقراءة التقريبية كافية."
        avoidWhen="المقارنة الدقيقة بين الفئات أهم أو عدد الشرائح كبير؛ عندها استخدم Bar."
      >
        <DashboardVisualizationShell title="Donut صالح بأربع فئات" description="النظام يرفض تلقائيًا Gallery-style Donut عند تجاوز الحد المشترك المناسب.">
          <CompositionDonut
            data={[
              { label: "الفئة الأولى", value: 46, color: "series-1" },
              { label: "الفئة الثانية", value: 29, color: "series-2" },
              { label: "الفئة الثالثة", value: 17, color: "series-3" },
              { label: "الفئة الرابعة", value: 8, color: "series-4" },
            ]}
            center={{ label: "الإجمالي", value: "100" }}
            ariaLabel="Donut يوضح إجماليًا مكونًا من أربع فئات"
            summary="يتكون الإجمالي التوضيحي من أربع فئات: 46 و29 و17 و8."
            format={{ maximumFractionDigits: 0 }}
          />
        </DashboardVisualizationShell>
      </VisualizationExample>

      <VisualizationExample
        title="التقدم نحو هدف (Progress / Target)"
        question="أين نحن بالنسبة إلى هدف أو حد معروف؟"
        useWhen="يوجد مرجع حقيقي ومعلن يفهم المستخدم معنى الوصول إليه."
        avoidWhen="لا يوجد Target صالح أو عندما تكفي قيمة نصية بسيطة دون شريط تقدم."
      >
        <DashboardSummaryBlock title="تقدم توضيحي" description="Outcome هنا مُدخل صراحةً؛ لا يستنتجه المكوّن من كون الرقم صاعدًا أو هابطًا.">
          <TargetProgress
            label="التقدم نحو المرجع"
            value={72}
            target={100}
            outcome="neutral"
            ariaLabel="التقدم الحالي 72 من هدف 100"
            summary="القيمة الحالية 72 من هدف 100، أي 72 بالمئة من المرجع. النتيجة الدلالية محايدة لأنها أعطيت صراحة للمكوّن."
            format={{ maximumFractionDigits: 0 }}
          />
        </DashboardSummaryBlock>
      </VisualizationExample>

      <VisualizationExample
        title="اتجاه صغير داخل سياق KPI (Sparkline)"
        question="ما شكل الحركة بسرعة دون فتح Trend كاملة؟"
        useWhen="السياق الأساسي موجود أصلًا في KPI وتحتاج إشارة شكلية خفيفة للحركة."
        avoidWhen="يحتاج المستخدم محاور أو تواريخ أو Tooltip أو تحقيقًا تفصيليًا."
      >
        <DashboardMetricGrid>
          <DashboardMetricCard
            label="مؤشر توضيحي مع حركة صغيرة"
            value="74"
            supportingContext="Sparkline لا تقرر أن الصعود جيد أو أن الهبوط سيئ."
            comparison={<Sparkline values={[42, 47, null, 51, 49, 58, 61]} ariaLabel="حركة صغيرة متذبذبة مع نقطة مفقودة" />}
          />
        </DashboardMetricGrid>
      </VisualizationExample>
    </div>
  );
}
