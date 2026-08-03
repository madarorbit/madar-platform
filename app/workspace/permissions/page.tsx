import { requireBusinessWorkspace } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";
import V2ActionForm from "@/components/v2/V2ActionForm";
import {
  confirmIntegrationWrite,
  grantIntegrationPermission,
  previewIntegrationWrite,
  revokeConnectionPermissions,
} from "@/app/actions/v2-operations";

export const dynamic = "force-dynamic";
export const metadata = { title: "الصلاحيات والكتابة | مَدار" };
const input = "field w-full rounded-xl p-3";
const resources = [
  "PRODUCT_UPDATE",
  "INVENTORY_ADJUSTMENT",
  "PRICE_UPDATE",
  "ORDER_STATUS_UPDATE",
  "CUSTOMER_UPDATE",
  "TASK_UPDATE",
  "RESTAURANT_ORDER_STATUS",
  "HOTEL_RESERVATION_STATUS",
  "HOUSEKEEPING_STATUS",
];

export default async function PermissionsPage() {
  const { workspace } = await requireBusinessWorkspace(),
    id = encodeURIComponent(workspace.id),
    [connections, grants, commands, consents, subscription] = await Promise.all(
      [
        supabaseFetch(
          `/rest/v1/integration_connections?organization_id=eq.${id}&connection_mode=eq.WRITE_LIMITED&deleted_at=is.null&select=id,name,status,connector_key`,
        ).catch(() => []),
        supabaseFetch(
          `/rest/v1/integration_permission_grants?organization_id=eq.${id}&select=id,connection_id,resource_key,permission,constraints,granted_at,revoked_at&order=granted_at.desc`,
        ).catch(() => []),
        supabaseFetch(
          `/rest/v1/integration_write_commands?organization_id=eq.${id}&select=id,connection_id,command_type,resource_key,entity_type,entity_id,preview,status,requested_at,error_message&order=requested_at.desc&limit=50`,
        ).catch(() => []),
        supabaseFetch(
          `/rest/v1/integration_consent_log?organization_id=eq.${id}&select=id,connection_id,action,resource_key,details,created_at&order=created_at.desc&limit=50`,
        ).catch(() => []),
        supabaseFetch(
          `/rest/v1/pricing_subscription_snapshots?organization_id=eq.${id}&status=in.(trialing,active)&select=locked_entitlements&order=created_at.desc&limit=1`,
        ).catch(() => []),
      ],
    ),
    entitlements = subscription?.[0]?.locked_entitlements || {},
    writeEnabled = Boolean(entitlements.reverse_write);
  return (
    <main className="mx-auto max-w-7xl p-5 py-8">
      <header>
        <p className="font-bold text-emerald-300">مركز الموافقات</p>
        <h1 className="mt-2 text-4xl font-black">قراءة وكتابة بموافقة صريحة</h1>
        <p className="mt-3 max-w-3xl leading-8 text-slate-300">
          لا يُرسل أي تعديل إلى نظامك قبل معاينته وتأكيده. كل أمر يملك مفتاح عدم
          تكرار، وفحص تعارض، وتحققًا لاحقًا ومسار تعويض.
        </p>
      </header>
      {!writeEnabled && (
        <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-amber-100">
          الكتابة العكسية تتطلب الاشتراك الكامل في وضع ربط نشاط قائم. تظل
          القراءة وسجل الموافقات متاحين.
        </div>
      )}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <V2ActionForm
          action={grantIntegrationPermission}
          title="منح صلاحية محددة"
          submitLabel="تسجيل الموافقة"
        >
          <select name="connection_id" required className={input}>
            {connections.map((connection: { id: string; name: string }) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
              </option>
            ))}
          </select>
          <select name="resource_key" className={input}>
            {resources.map((resource) => (
              <option key={resource}>{resource}</option>
            ))}
          </select>
          <select name="permission" className={input}>
            <option value="READ">قراءة</option>
            <option value="WRITE">كتابة</option>
          </select>
          <textarea
            name="constraints"
            rows={4}
            dir="ltr"
            className={input}
            defaultValue={'{"fields":[],"approval":"EACH_COMMAND"}'}
          />
        </V2ActionForm>
        <V2ActionForm
          action={previewIntegrationWrite}
          title="معاينة أمر كتابة"
          description="المعاينة لا تنفذ شيئًا. بعد إنشائها سيظهر زر التأكيد المنفصل أدناه."
          submitLabel="إنشاء المعاينة"
        >
          <select name="connection_id" required className={input}>
            {connections.map((connection: { id: string; name: string }) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
              </option>
            ))}
          </select>
          <div className="grid gap-3 sm:grid-cols-2">
            <select name="resource_key" className={input}>
              {resources.map((resource) => (
                <option key={resource}>{resource}</option>
              ))}
            </select>
            <input
              name="command_type"
              className={input}
              defaultValue="update"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="entity_type"
              required
              className={input}
              placeholder="product"
            />
            <input
              name="entity_id"
              required
              className={input}
              placeholder="معرّف الكيان الخارجي"
            />
          </div>
          <textarea
            name="desired_change"
            required
            rows={5}
            dir="ltr"
            className={input}
            defaultValue={'{"price":25}'}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="expected_source_version"
              className={input}
              placeholder="ETag أو إصدار المصدر"
            />
            <input
              name="idempotency_key"
              required
              className={input}
              defaultValue={crypto.randomUUID()}
            />
          </div>
        </V2ActionForm>
      </section>
      <section className="mt-8">
        <h2 className="text-2xl font-black">الأوامر والمعاينات</h2>
        <div className="mt-4 grid gap-3">
          {commands.map(
            (command: {
              id: string;
              resource_key: string;
              entity_type: string;
              entity_id: string;
              preview: unknown;
              status: string;
              requested_at: string;
              error_message: string | null;
            }) => (
              <article
                key={command.id}
                className="md-card grid gap-4 p-5 lg:grid-cols-[1fr_160px]"
              >
                <div>
                  <div className="flex flex-wrap gap-2">
                    <strong>{command.resource_key}</strong>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-xs">
                      {command.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {command.entity_type} · {command.entity_id}
                  </p>
                  <pre
                    className="mt-3 max-h-52 overflow-auto rounded-xl bg-black/30 p-3 text-xs"
                    dir="ltr"
                  >
                    {JSON.stringify(command.preview, null, 2)}
                  </pre>
                  {command.error_message && (
                    <p className="mt-2 text-sm text-red-200">
                      {command.error_message}
                    </p>
                  )}
                </div>
                {command.status === "PREVIEWED" && (
                  <V2ActionForm
                    action={confirmIntegrationWrite}
                    title="تأكيد مستقل"
                    submitLabel="تأكيد التنفيذ"
                  >
                    <input type="hidden" name="command_id" value={command.id} />
                    <p className="text-xs leading-6 text-amber-100">
                      سيُرسل الأمر إلى النظام الخارجي بعد الضغط.
                    </p>
                  </V2ActionForm>
                )}
              </article>
            ),
          )}
        </div>
      </section>
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-black">الصلاحيات</h2>
          <div className="mt-4 grid gap-3">
            {grants.map(
              (grant: {
                id: string;
                connection_id: string;
                resource_key: string;
                permission: string;
                revoked_at: string | null;
              }) => (
                <article
                  key={grant.id}
                  className="md-card flex items-center justify-between gap-4 p-4"
                >
                  <div>
                    <strong>{grant.resource_key}</strong>
                    <p className="text-xs text-slate-500">{grant.permission}</p>
                  </div>
                  <span>{grant.revoked_at ? "ملغاة" : "نشطة"}</span>
                </article>
              ),
            )}
          </div>
          {connections.map((connection: { id: string; name: string }) => (
            <V2ActionForm
              key={connection.id}
              action={revokeConnectionPermissions}
              title={`إلغاء صلاحيات ${connection.name}`}
              submitLabel="إلغاء كل الصلاحيات"
            >
              <input type="hidden" name="connection_id" value={connection.id} />
            </V2ActionForm>
          ))}
        </div>
        <div>
          <h2 className="text-2xl font-black">سجل الموافقات</h2>
          <div className="mt-4 grid gap-3">
            {consents.map(
              (consent: {
                id: number;
                action: string;
                resource_key: string | null;
                created_at: string;
              }) => (
                <article
                  key={consent.id}
                  className="md-card flex items-center justify-between gap-4 p-4"
                >
                  <div>
                    <strong>{consent.action}</strong>
                    <p className="text-xs text-slate-500">
                      {consent.resource_key || "الاتصال كاملًا"}
                    </p>
                  </div>
                  <time className="text-xs text-slate-500">
                    {new Date(consent.created_at).toLocaleString("ar-YE")}
                  </time>
                </article>
              ),
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
