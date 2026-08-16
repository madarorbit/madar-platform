import {
  DashboardAlertBlock,
  DashboardCriticalException,
  DashboardDataState,
  DashboardDrillDownLink,
  DashboardEmptyState,
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardSection,
  DashboardStatusBlock,
  DashboardSupportingInfo,
  DataTrustIndicator,
  MetricContext,
} from "@/components/dashboard";
import { ButtonLink, Panel, StatusBadge } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import { WorkspaceModule, WorkspaceModuleHeader } from "@/components/workspace/WorkspaceModule";
import type { BusinessWorkspace, WorkspaceSector } from "@/src/lib/business";
import type { NormalizedMetricResult } from "@/src/lib/dashboard/metrics";
import { formatDateTime } from "@/src/lib/format";
import {
  buildConnectedOverviewModel,
  type ConnectedReadiness,
  type ConnectedSourceOverview,
  type ConnectedSourceState,
} from "@/src/lib/connected/dashboard/domain";
import { getConnectedDashboardData } from "@/src/lib/connected/dashboard/server";

const number = new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 0 });

function metricNumber(result: NormalizedMetricResult) {
  return result.value === null ? "—" : number.format(result.value);
}

function durationLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (value < 60) return "أقل من دقيقة";
  const minutes = Math.floor(value / 60);
  if (minutes < 60) return `${number.format(minutes)} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${number.format(hours)} ساعة`;
  const days = Math.floor(hours / 24);
  return `${number.format(days)} يوم`;
}

function readinessTone(state: ConnectedReadiness): "neutral" | "info" | "success" | "warning" | "danger" {
  if (state === "ready") return "success";
  if (state === "repair") return "danger";
  if (state === "attention" || state === "incomplete") return "warning";
  if (state === "setup") return "info";
  return "neutral";
}

function sourceTone(state: ConnectedSourceState): "active" | "pending" | "error" | "suspended" | "draft" {
  if (state === "ready") return "active";
  if (state === "repair") return "error";
  if (state === "attention" || state === "setup" || state === "incomplete") return "pending";
  if (state === "paused") return "suspended";
  return "draft";
}

function sourceLabel(state: ConnectedSourceState) {
  return ({
    ready: "جاهز",
    attention: "يحتاج متابعة",
    repair: "يحتاج إصلاحًا",
    incomplete: "غير مكتمل",
    unknown: "غير معروف",
    setup: "إعداد أولي",
    paused: "متوقف مؤقتًا",
  } as const)[state];
}

function trustState(result: NormalizedMetricResult): "fresh" | "stale" | "partial" | "unknown" | "error" {
  if (result.availability.state === "error") return "error";
  if (result.availability.state === "unavailable" || result.coverage.state === "partial") return "partial";
  if (result.freshness.state === "fresh") return "fresh";
  if (result.freshness.state === "stale") return "stale";
  return "unknown";
}

function sourceNames(sources: readonly ConnectedSourceOverview[]) {
  const names = sources.slice(0, 5).map((source) => source.name).join("، ");
  return `${names}${sources.length > 5 ? "…" : ""}`;
}

function sourceStatusDescription(source: ConnectedSourceOverview) {
  const pieces = [source.reason];
  if (source.lastSuccessAt) pieces.push(`آخر نجاح ${formatDateTime(source.lastSuccessAt)}`);
  if (source.latestRunStatus === "failed") pieces.push("آخر مزامنة فشلت");
  return pieces.join(" ");
}

export async function ConnectedDecisionOverview({
  workspace,
  sector,
}: {
  workspace: BusinessWorkspace;
  sector: WorkspaceSector;
}) {
  const data = await getConnectedDashboardData(workspace.id);
  const model = buildConnectedOverviewModel(data, new Date().toISOString());

  return (
    <WorkspaceModule>
      <WorkspaceModuleHeader
        eyebrow="نظرة Connected"
        title={workspace.name}
        description="راقب سلامة المصادر المتصلة، وثوق البيانات، وما يحتاج تدخلك الآن؛ التحقيق والإصلاح يبقيان في مركز الربط والبيانات الواصلة."
        icon="layers"
        actions={<>
          <ButtonLink href="/workspace/data" variant="secondary"><Icon name="document" />البيانات الواصلة</ButtonLink>
          <ButtonLink href="/workspace/connect"><Icon name="layers" />فحص وإصلاح الربط</ButtonLink>
        </>}
      />

      {model.criticalSources.length ? (
        <DashboardCriticalException
          title={`${number.format(model.criticalSources.length)} ${model.criticalSources.length === 1 ? "مصدر يحتاج إصلاحًا" : "مصادر تحتاج إصلاحًا"}`}
          description={sourceNames(model.criticalSources)}
          impact="حالة اتصال أو Health أو incident موثقة تمنع اعتبار هذه المصادر سليمة حتى يتم فحصها."
          action={<DashboardDrillDownLink href="/workspace/connect">فتح مركز الربط</DashboardDrillDownLink>}
        />
      ) : null}

      {model.isPartial ? (
        <DashboardDataState
          state="partial"
          title="الصورة الحالية جزئية"
          description={`تعذر أو نقص التحقق من: ${model.failedSources.length ? model.failedSources.join("، ") : "Health لبعض المصادر"}. لا تُحوّل القيم الغائبة إلى أصفار أو حالة سليمة.`}
          action={<DashboardDrillDownLink href="/workspace/connect">فحص المصادر</DashboardDrillDownLink>}
        />
      ) : null}

      <DashboardSection
        eyebrow="الجاهزية"
        title="هل يمكن الوثوق بالمصادر المتصلة الآن؟"
        description="القرار يجمع حالة الاتصال مع أحدث Health موثقة والمشكلات المفتوحة وآخر Sync، ولا يعتمد على connection.status وحده."
        priority="primary"
      >
        <DashboardStatusBlock
          title={model.readinessLabel}
          description={model.readinessDescription}
          tone={readinessTone(model.readiness)}
          action={<DashboardDrillDownLink href="/workspace/connect">فحص الربط</DashboardDrillDownLink>}
        />
      </DashboardSection>

      {model.isFirstUse ? (
        <DashboardSection
          eyebrow="البدء"
          title="ابدأ بأول مصدر متصل"
          description="لا توجد اتصالات بعد، لذلك لا تعرض مَدار أصفارًا على أنها مؤشرات صحة أو بيانات."
          priority="primary"
        >
          <DashboardEmptyState
            title="لا يوجد اتصال بعد"
            description="اختر موصلًا معتمدًا أو أرسل طلب موصل لنظامك الحالي، ثم اختبر الاتصال واعتمد المطابقة."
            icon="layers"
            action={<ButtonLink href="/workspace/connect">إعداد أول اتصال</ButtonLink>}
          />
        </DashboardSection>
      ) : <>
        <DashboardSection
          eyebrow="الثقة"
          title="مؤشرات الثقة الأساسية"
          description="Current-state indicators فقط؛ لا يوجد Global Date Range ولا Business KPIs غير موثقة."
          priority="primary"
        >
          <DashboardMetricGrid>
            <DashboardMetricCard
              label="المصادر الجاهزة"
              value={metricNumber(model.primary.readySources)}
              supportingContext={<MetricContext label="من إجمالي" value={metricNumber(model.primary.totalSources)} kind="reference" />}
              trust={<DataTrustIndicator state={trustState(model.primary.readySources)} label="تغطية أحدث Health" detail="غياب Health لا يُعامل كسلامة." compact />}
              action={<DashboardDrillDownLink href="/workspace/connect">المصادر</DashboardDrillDownLink>}
              valueDirection="ltr"
            />
            <DashboardMetricCard
              label="المشكلات المفتوحة"
              value={metricNumber(model.primary.openIssues)}
              supportingContext={<span>Exact count من incident status الحالي، وليس طول قائمة محدودة.</span>}
              trust={<DataTrustIndicator state={trustState(model.primary.openIssues)} label="عداد موثوق" detail="لا توجد دلالة stale عامة لهذا العداد." compact />}
              action={<DashboardDrillDownLink href="/workspace/connect">الفحص والإصلاح</DashboardDrillDownLink>}
              valueDirection="ltr"
            />
            <DashboardMetricCard
              label="مصادر تحتاج تدخلاً"
              value={metricNumber(model.primary.sourcesNeedingAction)}
              supportingContext={<span>إصلاح أو متابعة مبنية على facts موثقة فقط.</span>}
              trust={<DataTrustIndicator state={trustState(model.primary.sourcesNeedingAction)} label="حالة مركبة" detail="لا يوجد Health Score رقمي عام." compact />}
              action={<DashboardDrillDownLink href="/workspace/connect">فحص المصادر</DashboardDrillDownLink>}
              valueDirection="ltr"
            />
            <DashboardMetricCard
              label="منذ آخر مزامنة ناجحة"
              value={durationLabel(model.primary.secondsSinceLastSuccess.value)}
              supportingContext={<span>{model.latestSuccessAt ? formatDateTime(model.latestSuccessAt) : "لم تُسجل مزامنة ناجحة بعد"}</span>}
              trust={<DataTrustIndicator state={trustState(model.primary.secondsSinceLastSuccess)} label="آخر نجاح موثق" detail="لا توجد policy عامة لتحويل العمر إلى تحذير تلقائي." compact />}
              action={<DashboardDrillDownLink href="/workspace/connect">تفاصيل المزامنة</DashboardDrillDownLink>}
              valueDirection="auto"
            />
          </DashboardMetricGrid>
        </DashboardSection>

        {model.attentionSources.length || model.incompleteSources.length ? (
          <DashboardSection
            eyebrow="الانتباه"
            title="ما الذي يحتاج تدخلك الآن؟"
            description="يظهر هنا فقط ما تدعمه Health أو incidents أو آخر Sync أو نقص الثقة؛ الإيقاف المؤقت وحده ليس Alert."
            actions={<DashboardDrillDownLink href="/workspace/connect">فتح مركز الربط</DashboardDrillDownLink>}
          >
            <div className="grid gap-3">
              {model.attentionSources.length ? (
                <DashboardAlertBlock
                  title={`${number.format(model.attentionSources.length)} ${model.attentionSources.length === 1 ? "مصدر يحتاج متابعة" : "مصادر تحتاج متابعة"}`}
                  description={sourceNames(model.attentionSources)}
                  severity="attention"
                  meta="Degraded Health أو warning مفتوح أو آخر Sync فاشل؛ لا يعتمد التصنيف على إشارة رقمية مجردة."
                  action={<DashboardDrillDownLink href="/workspace/connect">المتابعة</DashboardDrillDownLink>}
                />
              ) : null}
              {model.incompleteSources.length ? (
                <DashboardStatusBlock
                  title={`${number.format(model.incompleteSources.length)} ${model.incompleteSources.length === 1 ? "مصدر لا يمكن تأكيد صحته" : "مصادر لا يمكن تأكيد صحتها"}`}
                  description={`${sourceNames(model.incompleteSources)}. غياب Health أو كونها unknown يبقى Unknown/Incomplete، وليس Healthy.`}
                  tone="warning"
                  action={<DashboardDrillDownLink href="/workspace/connect">استكمال الفحص</DashboardDrillDownLink>}
                />
              ) : null}
            </div>
          </DashboardSection>
        ) : null}

        <DashboardSection
          eyebrow="المصادر"
          title="المصادر المتصلة"
          description="مرتبة بحيث تظهر المصادر التي تحتاج إصلاحًا أو متابعة أولًا. لا تعرض الصفحة تفاصيل mapping أو auth أو webhook configuration."
          actions={<DashboardDrillDownLink href="/workspace/connect">كل تفاصيل الربط</DashboardDrillDownLink>}
        >
          <Panel className="p-4 sm:p-5">
            <div className="md-service-list">
              {model.sources.map((source) => (
                <article key={source.id} className="md-service-list-row">
                  <span className="md-service-list-icon"><Icon name={source.state === "repair" || source.state === "attention" ? "warning" : "layers"} /></span>
                  <div className="min-w-0">
                    <strong>{source.name}</strong>
                    <small className="md-ltr-data">{source.connectorKey}</small>
                    <small>{sourceStatusDescription(source)}</small>
                    {source.freshness.value !== null ? (
                      <small>حداثة المصدر المبلّغة: {durationLabel(source.freshness.value)} — دون حكم stale لغياب policy موثقة.</small>
                    ) : null}
                  </div>
                  <div className="md-service-row-meta">
                    <StatusBadge status={sourceTone(source.state)}>{sourceLabel(source.state)}</StatusBadge>
                    <small>{source.latestHealthStatus ? `Health: ${source.latestHealthStatus}` : "Health غير متاحة"}</small>
                    {source.openIssues.value !== null && source.openIssues.value > 0 ? <small>{number.format(source.openIssues.value)} مشكلة مفتوحة</small> : null}
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </DashboardSection>

        <DashboardSection
          eyebrow="التحقيق"
          title="إلى أين تذهب للفحص؟"
          description="النظرة العامة تراقب وتقرر؛ التفاصيل التقنية والتحقيق تبقى في الصفحات المتخصصة."
        >
          <DashboardSupportingInfo>
            <div className="grid gap-3 sm:grid-cols-2">
              <ButtonLink href="/workspace/connect" variant="secondary"><Icon name="layers" />مركز الربط والإصلاح</ButtonLink>
              <ButtonLink href="/workspace/data" variant="secondary"><Icon name="document" />فحص البيانات الواصلة</ButtonLink>
            </div>
          </DashboardSupportingInfo>
        </DashboardSection>

        <DashboardSection
          eyebrow="إجراءات"
          title="إجراءات سريعة"
          description="إجراءات مساندة بعد فهم الحالة؛ لا يوجد اختصار رئيسي إلى Analytics القديمة لأنها ليست مصدر Connected موثوقًا بعد."
          priority="supporting"
        >
          <DashboardSupportingInfo>
            <div className="grid gap-3 sm:grid-cols-3">
              <ButtonLink href="/workspace/connect"><Icon name="layers" />فحص أو مزامنة</ButtonLink>
              <ButtonLink href="/workspace/data" variant="secondary"><Icon name="document" />استعراض البيانات</ButtonLink>
              <ButtonLink href="/workspace/orby" variant="secondary"><Icon name="sparkles" />اسأل ORBY عن {sector.specializationName}</ButtonLink>
            </div>
          </DashboardSupportingInfo>
        </DashboardSection>
      </>}
    </WorkspaceModule>
  );
}
