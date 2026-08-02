import { requireBusinessWorkspace } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";
import V2ActionForm from "@/components/v2/V2ActionForm";
import ConnectorSetupForm, {
  type ConnectorCatalogItem,
} from "@/components/v2/ConnectorSetupForm";
import {
  approveMappingPreview,
  createInboundEndpoint,
  enqueueConnectionSync,
  requestConnector,
  setConnectionPaused,
} from "@/app/actions/v2-operations";

export const dynamic = "force-dynamic";
export const metadata = { title: "مركز الربط | مَدار Connect" };
const input = "field w-full rounded-xl p-3";

export default async function ConnectPage() {
  const { workspace } = await requireBusinessWorkspace(),
    id = encodeURIComponent(workspace.id);
  const [
    catalog,
    connections,
    mappings,
    previews,
    health,
    requests,
    endpoints,
  ] = await Promise.all([
    supabaseFetch(
      "/rest/v1/integration_connectors?is_public=eq.true&certification_status=eq.certified&enabled=eq.true&select=connector_key,version,display_name,description,auth_schemes,capabilities,setup_schema,channels&order=display_name",
    ).catch(() => []),
    supabaseFetch(
      `/rest/v1/integration_connections?organization_id=eq.${id}&deleted_at=is.null&select=id,connector_key,name,status,connection_mode,auth_scheme,last_tested_at,last_success_at,last_error_message&order=created_at.desc`,
    ).catch(() => []),
    supabaseFetch(
      `/rest/v1/integration_mapping_previews?organization_id=eq.${id}&status=eq.preview&select=id,connection_id,entity_key,confidence,proposed_mapping,sample_output&order=created_at.desc`,
    ).catch(() => []),
    supabaseFetch(
      `/rest/v1/integration_sync_previews?organization_id=eq.${id}&status=in.(ready,approved)&select=id,connection_id,entity_counts,warnings,status,expires_at&order=created_at.desc`,
    ).catch(() => []),
    supabaseFetch(
      `/rest/v1/integration_health_snapshots?organization_id=eq.${id}&select=id,connection_id,status,freshness_seconds,success_rate,quality_score,queue_depth,open_issues,captured_at&order=captured_at.desc&limit=20`,
    ).catch(() => []),
    supabaseFetch(
      `/rest/v1/integration_connector_requests?organization_id=eq.${id}&select=id,vendor_name,system_name,status,created_at&order=created_at.desc`,
    ).catch(() => []),
    supabaseFetch(
      `/rest/v1/integration_inbound_endpoints?organization_id=eq.${id}&is_active=eq.true&select=id,endpoint_key,connection_id,channel,auth_mode,last_received_at,created_at&order=created_at.desc`,
    ).catch(() => []),
  ]);
  return (
    <main className="mx-auto max-w-7xl p-5 py-8">
      <header>
        <p className="font-bold text-emerald-300">MADAR Connect</p>
        <h1 className="mt-2 text-4xl font-black">
          اربط نظامك خلال خطوات واضحة
        </h1>
        <p className="mt-3 max-w-3xl leading-8 text-slate-300">
          اختيار الموصل ← إدخال بياناته المشفرة ← اختبار الاتصال ← اكتشاف المخطط
          ← معاينة المطابقة ← الموافقة ← المزامنة الأولى ← مراقبة الصحة.
        </p>
      </header>
      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {catalog.map(
          (item: {
            connector_key: string;
            display_name: string;
            description: string;
            channels: string[];
            capabilities: Record<string, boolean>;
          }) => (
            <article key={item.connector_key} className="md-card p-5">
              <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">
                معتمد
              </span>
              <h2 className="mt-4 text-xl font-black">{item.display_name}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                {item.description}
              </p>
              <p className="mt-3 text-xs text-violet-200">
                {(item.channels || []).join(" · ")}
              </p>
            </article>
          ),
        )}
      </section>
      <section className="mt-8">
        <h2 className="text-2xl font-black">تشغيل الاتصال</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {connections.map(
            (connection: { id: string; name: string; status: string }) => (
              <div key={connection.id} className="grid gap-3">
                <V2ActionForm
                  action={enqueueConnectionSync}
                  title={connection.name}
                  description="المزامنة الأولى تتطلب اعتماد كل المطابقات؛ وبعدها استخدم المزامنة التزايدية."
                  submitLabel="وضع المزامنة في الطابور"
                >
                  <input
                    type="hidden"
                    name="connection_id"
                    value={connection.id}
                  />
                  <select name="mode" className={input}>
                    <option value="initial">مزامنة أولى</option>
                    <option value="incremental">مزامنة تزايدية</option>
                  </select>
                </V2ActionForm>
                <V2ActionForm
                  action={setConnectionPaused}
                  title="حالة الاتصال"
                  submitLabel={
                    connection.status === "paused"
                      ? "إعادة التنشيط"
                      : "إيقاف مؤقت"
                  }
                >
                  <input
                    type="hidden"
                    name="connection_id"
                    value={connection.id}
                  />
                  <input
                    type="hidden"
                    name="paused"
                    value={String(connection.status !== "paused")}
                  />
                </V2ActionForm>
              </div>
            ),
          )}
        </div>
      </section>
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <ConnectorSetupForm catalog={catalog as ConnectorCatalogItem[]} />
        <V2ActionForm
          action={requestConnector}
          title="طلب موصل جديد"
          description="إذا لم تجد نظامك، أرسل اسمه ورابط توثيق API وسنحتفظ بالطلب داخل مركز الربط."
          submitLabel="إرسال الطلب"
        >
          <input
            name="vendor_name"
            required
            className={input}
            placeholder="اسم المورّد"
          />
          <input
            name="system_name"
            required
            className={input}
            placeholder="اسم النظام"
          />
          <input
            name="website"
            type="url"
            className={input}
            placeholder="https://vendor.example"
          />
          <input
            name="api_documentation_url"
            type="url"
            className={input}
            placeholder="رابط توثيق API"
          />
          <textarea
            name="use_case"
            required
            minLength={5}
            rows={4}
            className={input}
            placeholder="ما البيانات والعمليات التي تريد ربطها؟"
          />
        </V2ActionForm>
      </section>
      <section className="mt-8">
        <h2 className="text-2xl font-black">الاتصالات وصحتها</h2>
        <div className="mt-4 grid gap-3">
          {connections.length ? (
            connections.map(
              (connection: {
                id: string;
                name: string;
                connector_key: string;
                status: string;
                connection_mode: string;
                last_success_at: string | null;
                last_error_message: string | null;
              }) => {
                const snapshot = health.find(
                  (item: { connection_id: string }) =>
                    item.connection_id === connection.id,
                ) as
                  | {
                      status: string;
                      success_rate: number;
                      quality_score: number;
                      queue_depth: number;
                      open_issues: number;
                    }
                  | undefined;
                return (
                  <article
                    key={connection.id}
                    className="md-card grid gap-4 p-5 md:grid-cols-4 md:items-center"
                  >
                    <div>
                      <h3 className="font-black">{connection.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {connection.connector_key}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">الحالة</span>
                      <strong className="block">
                        {connection.status} · {connection.connection_mode}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">
                        الصحة والجودة
                      </span>
                      <strong className="block">
                        {snapshot?.status || "unknown"} ·{" "}
                        {snapshot?.quality_score || 0}%
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">
                        الطابور والمشكلات
                      </span>
                      <strong className="block">
                        {snapshot?.queue_depth || 0} /{" "}
                        {snapshot?.open_issues || 0}
                      </strong>
                    </div>
                    {connection.last_error_message && (
                      <p className="md:col-span-4 text-sm text-red-200">
                        {connection.last_error_message}
                      </p>
                    )}
                  </article>
                );
              },
            )
          ) : (
            <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-500">
              لم يُنشأ اتصال بعد.
            </p>
          )}
        </div>
      </section>
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-black">معاينات المطابقة</h2>
          <div className="mt-4 grid gap-3">
            {mappings.map(
              (mapping: {
                id: string;
                entity_key: string;
                confidence: number;
                proposed_mapping: unknown;
              }) => (
                <V2ActionForm
                  key={mapping.id}
                  action={approveMappingPreview}
                  title={`${mapping.entity_key} · ثقة ${Math.round(mapping.confidence * 100)}%`}
                  submitLabel="اعتماد المطابقة"
                >
                  <input type="hidden" name="preview_id" value={mapping.id} />
                  <pre
                    className="max-h-48 overflow-auto rounded-xl bg-black/30 p-3 text-xs"
                    dir="ltr"
                  >
                    {JSON.stringify(mapping.proposed_mapping, null, 2)}
                  </pre>
                </V2ActionForm>
              ),
            )}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black">نقاط الاستقبال</h2>
          <div className="mt-4 grid gap-3">
            {connections.length > 0 && (
              <V2ActionForm
                action={createInboundEndpoint}
                title="نقطة Webhook أو Bridge"
                description="يظهر المفتاح مرة واحدة فقط. استخدم توقيع HMAC للـWebhook أو رمز Bearer للقنوات الداخلية."
                submitLabel="إنشاء نقطة استقبال"
              >
                <select name="connection_id" className={input}>
                  {connections.map(
                    (connection: { id: string; name: string }) => (
                      <option key={connection.id} value={connection.id}>
                        {connection.name}
                      </option>
                    ),
                  )}
                </select>
                <select name="channel" className={input}>
                  <option value="WEBHOOK">Webhook</option>
                  <option value="LOCAL_BRIDGE">Local Bridge</option>
                  <option value="FILE">File</option>
                </select>
                <select name="auth_mode" className={input}>
                  <option value="HMAC_SHA256">
                    توقيع HMAC-SHA256 (موصى به للـWebhook)
                  </option>
                  <option value="TOKEN">Bearer / Endpoint Token</option>
                </select>
              </V2ActionForm>
            )}
            {endpoints.map(
              (endpoint: {
                id: string;
                endpoint_key: string;
                channel: string;
                auth_mode: string;
                last_received_at: string | null;
              }) => (
                <article key={endpoint.id} className="md-card p-4">
                  <strong>
                    {endpoint.channel} · {endpoint.auth_mode}
                  </strong>
                  <p className="mt-2 break-all font-mono text-xs" dir="ltr">
                    /api/integrations/inbound/{endpoint.endpoint_key}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    آخر استقبال:{" "}
                    {endpoint.last_received_at
                      ? new Date(endpoint.last_received_at).toLocaleString(
                          "ar-YE",
                        )
                      : "لم يصل شيء"}
                  </p>
                </article>
              ),
            )}
          </div>
        </div>
      </section>
      {previews.length > 0 && (
        <section className="mt-8">
          <h2 className="text-2xl font-black">معاينة المزامنة الأولى</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {previews.map(
              (preview: {
                id: string;
                entity_counts: unknown;
                warnings: unknown;
                expires_at: string;
              }) => (
                <article key={preview.id} className="md-card p-5">
                  <pre className="overflow-auto text-xs" dir="ltr">
                    {JSON.stringify(preview.entity_counts, null, 2)}
                  </pre>
                  <p className="mt-3 text-xs text-slate-500">
                    صالح حتى{" "}
                    {new Date(preview.expires_at).toLocaleString("ar-YE")}
                  </p>
                </article>
              ),
            )}
          </div>
        </section>
      )}
      {requests.length > 0 && (
        <section className="mt-8">
          <h2 className="text-2xl font-black">طلبات الموصلات</h2>
          <div className="mt-4 grid gap-3">
            {requests.map(
              (request: {
                id: string;
                vendor_name: string;
                system_name: string;
                status: string;
              }) => (
                <article
                  key={request.id}
                  className="md-card flex justify-between gap-4 p-4"
                >
                  <strong>
                    {request.vendor_name} · {request.system_name}
                  </strong>
                  <span>{request.status}</span>
                </article>
              ),
            )}
          </div>
        </section>
      )}
    </main>
  );
}
