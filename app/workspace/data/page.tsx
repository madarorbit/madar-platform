import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Badge,
  ButtonLink,
  EmptyState,
  ErrorState,
  StatusBadge,
  Table,
  TableWrap,
} from "@/components/ui/Enterprise";
import { WorkspaceModule, WorkspaceModuleHeader, WorkspaceToolbar } from "@/components/workspace/WorkspaceModule";
import { requireBusinessWorkspace } from "@/src/lib/business";
import { formatDateTime } from "@/src/lib/format";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "البيانات الواصلة | مَدار Connect" };

type UnifiedRecord = {
  id: string;
  entity_type: string;
  natural_key: string | null;
  external_id: string | null;
  canonical_data: Record<string, unknown>;
  lifecycle_status: string;
  quality_score: number;
  currency_code: string | null;
  quantity: number | null;
  source_updated_at: string | null;
  last_seen_at: string;
  updated_at: string;
};

const entityLabels: Record<string, string> = {
  product: "المنتجات",
  category: "التصنيفات",
  customer: "العملاء",
  supplier: "الموردون",
  sale: "المبيعات",
  order: "الطلبات",
  payment: "المدفوعات",
  inventory: "المخزون",
  inventory_movement: "حركات المخزون",
  expense: "المصروفات",
  employee: "الموظفون",
  operational_event: "الأحداث التشغيلية",
  organization: "المنشآت",
  workspace: "المساحات",
  branch: "الفروع",
};

export default async function ConnectedDataPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const [{ workspace }, params] = await Promise.all([requireBusinessWorkspace(), searchParams]);
  if (workspace.operating_mode !== "CONNECTED_EXTERNAL") redirect("/workspace");
  const raw = await supabaseFetch(
    `/rest/v1/integration_udm_records?organization_id=eq.${encodeURIComponent(workspace.id)}&select=id,entity_type,natural_key,external_id,canonical_data,lifecycle_status,quality_score,currency_code,quantity,source_updated_at,last_seen_at,updated_at&duplicate_of=is.null&order=updated_at.desc&limit=500`,
  ).catch(() => null) as UnifiedRecord[] | null;

  if (!raw) {
    return <WorkspaceModule><WorkspaceModuleHeader eyebrow="البيانات" title="البيانات الواصلة" description="قراءة موحّدة لما استلمته مَدار من النظام المرتبط." icon="layers" /><ErrorState title="تعذر تحميل البيانات الواصلة" description="لم تتأثر الاتصالات أو البيانات. راجع حالة الربط ثم حاول مجددًا." action={<ButtonLink href="/workspace/connect" variant="secondary">فتح مركز الربط</ButtonLink>} /></WorkspaceModule>;
  }

  const query = String(params.q || "").trim().toLocaleLowerCase("ar");
  const requestedType = String(params.type || "").trim();
  const filtered = raw.filter((record) => {
    if (requestedType && record.entity_type !== requestedType) return false;
    if (!query) return true;
    return [recordLabel(record), record.natural_key, record.external_id, entityLabels[record.entity_type], record.entity_type]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("ar").includes(query));
  });
  const counts = new Map<string, number>();
  for (const record of raw) counts.set(record.entity_type, (counts.get(record.entity_type) || 0) + 1);
  const latest = raw[0]?.source_updated_at || raw[0]?.updated_at || null;

  return <WorkspaceModule>
    <WorkspaceModuleHeader
      eyebrow="قراءة فقط · مصدر الحقيقة خارجي"
      title="البيانات الواصلة"
      description="السجلات التي وصلت من النظام المرتبط بعد التحقق والتوحيد. لا توجد نماذج كتابة يدوية هنا حتى لا تتعارض مع مصدر الحقيقة."
      icon="layers"
      actions={<><ButtonLink href="/workspace/connect" variant="secondary">حالة الربط</ButtonLink><ButtonLink href="/workspace/orby">اسأل ORBY عن البيانات</ButtonLink></>}
    />

    <section className="md-service-summary-strip" aria-label="ملخص البيانات الواصلة">
      <div><span>السجلات المحملة</span><strong>{raw.length.toLocaleString("ar-YE")}</strong></div>
      <div><span>أنواع البيانات</span><strong>{counts.size.toLocaleString("ar-YE")}</strong></div>
      <div><span>آخر تحديث من المصدر</span><strong>{latest ? formatDateTime(latest) : "لم تصل بيانات"}</strong></div>
      <div><span>النطاق</span><strong>هذه المساحة فقط</strong></div>
    </section>

    {counts.size ? <nav className="md-service-filter-chips" aria-label="تصفية نوع البيانات">
      <Link href="/workspace/data" aria-current={!requestedType ? "page" : undefined}>الكل <Badge>{raw.length.toLocaleString("ar-YE")}</Badge></Link>
      {[...counts.entries()].map(([type, count]) => <Link key={type} href={`/workspace/data?type=${encodeURIComponent(type)}`} aria-current={requestedType === type ? "page" : undefined}>{entityLabels[type] || type}<Badge>{count.toLocaleString("ar-YE")}</Badge></Link>)}
    </nav> : null}

    <WorkspaceToolbar action="/workspace/data" query={params.q} placeholder="ابحث في البيانات الواصلة" count={filtered.length} hidden={requestedType ? <input type="hidden" name="type" value={requestedType} /> : null} />

    {raw.length ? <TableWrap className="mt-4"><Table mobile="list">
      <caption>آخر السجلات الموحدة من النظام المرتبط</caption>
      <thead><tr><th>النوع</th><th>السجل</th><th>معرّف المصدر</th><th>الجودة</th><th>الحالة</th><th>آخر ظهور</th></tr></thead>
      <tbody>{filtered.map((record) => <tr key={record.id}>
        <td data-label="النوع"><Badge>{entityLabels[record.entity_type] || record.entity_type}</Badge></td>
        <td data-label="السجل"><strong>{recordLabel(record)}</strong>{record.natural_key ? <small className="md-help block md-ltr-data">{record.natural_key}</small> : null}</td>
        <td data-label="معرّف المصدر"><span className="md-ltr-data">{record.external_id || "—"}</span></td>
        <td data-label="الجودة">{Number(record.quality_score).toLocaleString("ar-YE")}%</td>
        <td data-label="الحالة"><StatusBadge status={record.lifecycle_status === "active" ? "active" : "draft"}>{record.lifecycle_status === "active" ? "نشط" : "غير نشط"}</StatusBadge></td>
        <td data-label="آخر ظهور">{formatDateTime(record.source_updated_at || record.last_seen_at || record.updated_at)}</td>
      </tr>)}</tbody>
    </Table></TableWrap> : <EmptyState title="لم تصل بيانات بعد" description="أنشئ اتصالًا، اختبره، ثم نفّذ أول مزامنة. ستظهر السجلات هنا دون بيانات تجريبية." icon="layers" action={<ButtonLink href="/workspace/connect">إعداد الربط</ButtonLink>} />}
    {raw.length && !filtered.length ? <EmptyState compact title="لا توجد نتائج مطابقة" description="غيّر عبارة البحث أو نوع البيانات دون التأثير على سجلات المصدر." icon="search" /> : null}
  </WorkspaceModule>;
}

function recordLabel(record: UnifiedRecord) {
  const data = record.canonical_data || {};
  const value = data.name ?? data.title ?? data.label ?? data.number ?? data.code;
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : record.natural_key || record.external_id || "سجل دون اسم";
}
