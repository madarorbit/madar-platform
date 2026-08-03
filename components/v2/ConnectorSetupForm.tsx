"use client";

import { useState } from "react";
import { createWorkspaceConnection } from "@/app/actions/v2-operations";
import V2ActionForm from "@/components/v2/V2ActionForm";

type AuthScheme =
  "none" | "api_key" | "bearer" | "basic" | "oauth2" | "database" | "custom";
type SetupField = {
  key: string;
  type: string;
  required?: boolean;
  options?: string[];
  label_ar?: string;
};
export type ConnectorCatalogItem = {
  connector_key: string;
  display_name: string;
  description: string;
  auth_schemes: AuthScheme[];
  capabilities: Record<string, boolean>;
  setup_schema: { fields?: SetupField[] } | null;
  channels: string[];
};

const fieldClass = "field w-full rounded-xl p-3";
const labels: Record<string, string> = {
  base_url: "رابط API الأساسي",
  health_path: "مسار اختبار الصحة",
  streams: "مسارات البيانات",
  format: "صيغة الملف",
  encoding: "ترميز الملف",
  signature_header: "اسم ترويسة التوقيع",
  signature_algorithm: "خوارزمية التوقيع",
  bridge_name: "اسم الجسر المحلي",
  allowed_streams: "البيانات المسموح للجسر بإرسالها",
};
const defaultStreams = JSON.stringify(
  [{ key: "products", path: "/products", records_path: "data" }],
  null,
  2,
);
const initialValues = (connector: ConnectorCatalogItem) =>
  Object.fromEntries(
    (connector.setup_schema?.fields || []).map((field) => [
      field.key,
      field.key === "health_path"
        ? "/health"
        : field.key === "streams"
          ? defaultStreams
          : field.options?.[0] || "",
    ]),
  );

function configPayload(
  fields: SetupField[],
  values: Record<string, string | string[]>,
) {
  return Object.fromEntries(
    fields.map((field) => {
      const value = values[field.key] ?? "";
      if (field.type === "json") {
        try {
          return [field.key, JSON.parse(String(value))];
        } catch {
          return [field.key, String(value)];
        }
      }
      if (field.type === "number") return [field.key, Number(value)];
      if (field.type === "multiselect" && !Array.isArray(value))
        return [
          field.key,
          String(value)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        ];
      return [field.key, value];
    }),
  );
}
function authPayload(scheme: AuthScheme, values: Record<string, string>) {
  if (scheme === "none") return {};
  if (scheme === "api_key")
    return {
      name: values.name || "X-API-Key",
      value: values.value || "",
      placement: values.placement || "header",
    };
  if (scheme === "bearer") return { token: values.token || "" };
  if (scheme === "basic")
    return { username: values.username || "", password: values.password || "" };
  if (scheme === "oauth2")
    return {
      accessToken: values.accessToken || "",
      refreshToken: values.refreshToken || "",
      scope: values.scope || "",
      tokenType: "Bearer",
    };
  if (scheme === "database")
    return {
      engine: values.engine || "postgres",
      host: values.host || "",
      port: Number(values.port || 5432),
      database: values.database || "",
      username: values.username || "",
      password: values.password || "",
      ssl: true,
    };
  return { secret: values.secret || "" };
}

export default function ConnectorSetupForm({
  catalog,
}: {
  catalog: ConnectorCatalogItem[];
}) {
  const [selectedKey, setSelectedKey] = useState(
      catalog[0]?.connector_key || "",
    ),
    selected =
      catalog.find((item) => item.connector_key === selectedKey) || catalog[0];
  const [scheme, setScheme] = useState<AuthScheme>(
    selected?.auth_schemes?.[0] || "none",
  );
  const [config, setConfig] = useState<Record<string, string | string[]>>(
      selected ? initialValues(selected) : {},
    ),
    [auth, setAuth] = useState<Record<string, string>>({ placement: "header" });
  const fields = selected?.setup_schema?.fields || [],
    serializedConfig = JSON.stringify(configPayload(fields, config)),
    serializedAuth = JSON.stringify(authPayload(scheme, auth));
  if (!selected)
    return (
      <div className="md-panel">
        <p>لا يوجد موصل معتمد متاح حاليًا.</p>
      </div>
    );
  const choose = (key: string) => {
    const next = catalog.find((item) => item.connector_key === key);
    if (!next) return;
    setSelectedKey(key);
    setScheme(next.auth_schemes[0] || "none");
    setConfig(initialValues(next));
    setAuth({ placement: "header" });
  };
  const updateConfig = (key: string, value: string | string[]) =>
    setConfig((current) => ({ ...current, [key]: value }));
  const updateAuth = (key: string, value: string) =>
    setAuth((current) => ({ ...current, [key]: value }));
  const authInput = (
    key: string,
    label: string,
    type = "text",
    required = true,
  ) => (
    <label className="grid gap-2 text-sm font-bold">
      <span>{label}</span>
      <input
        className={fieldClass}
        type={type}
        required={required}
        autoComplete="off"
        value={auth[key] || ""}
        onChange={(event) => updateAuth(key, event.target.value)}
      />
    </label>
  );
  return (
    <V2ActionForm
      action={createWorkspaceConnection}
      title="إنشاء اتصال"
      description="يبني مَدار النموذج من Manifest الموصل. تُشفّر الأسرار بـAES-256-GCM، ثم يبدأ اختبار الاتصال واكتشاف المخطط."
      submitLabel="إنشاء واختبار الاتصال"
    >
      <label className="grid gap-2 text-sm font-bold">
        <span>الموصل المعتمد</span>
        <select
          name="connector_key"
          required
          className={fieldClass}
          value={selectedKey}
          onChange={(event) => choose(event.target.value)}
        >
          {catalog.map((item) => (
            <option key={item.connector_key} value={item.connector_key}>
              {item.display_name}
            </option>
          ))}
        </select>
      </label>
      <input
        name="name"
        required
        minLength={2}
        className={fieldClass}
        placeholder="اسم الاتصال داخل مَدار"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">
          <span>طريقة المصادقة</span>
          <select
            name="auth_scheme"
            className={fieldClass}
            value={scheme}
            onChange={(event) => setScheme(event.target.value as AuthScheme)}
          >
            {selected.auth_schemes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold">
          <span>نطاق الاتصال</span>
          <select
            name="connection_mode"
            className={fieldClass}
            defaultValue="READ_ONLY"
          >
            <option value="READ_ONLY">قراءة فقط</option>
            {selected.capabilities.write && (
              <option value="WRITE_LIMITED">كتابة محددة بموافقة</option>
            )}
          </select>
        </label>
      </div>
      <div className="grid gap-4 rounded-2xl border border-white/10 p-4">
        <h4 className="font-black">بيانات النظام</h4>
        {fields.map((field) => (
          <label key={field.key} className="grid gap-2 text-sm font-bold">
            <span>
              {field.label_ar || labels[field.key] || field.key}
              {field.required && " *"}
            </span>
            {field.type === "select" ? (
              <select
                className={fieldClass}
                required={field.required}
                value={String(config[field.key] || "")}
                onChange={(event) =>
                  updateConfig(field.key, event.target.value)
                }
              >
                {(field.options || []).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : field.type === "multiselect" && field.options?.length ? (
              <select
                multiple
                className={fieldClass}
                required={field.required}
                value={
                  Array.isArray(config[field.key])
                    ? (config[field.key] as string[])
                    : []
                }
                onChange={(event) =>
                  updateConfig(
                    field.key,
                    [...event.target.selectedOptions].map(
                      (option) => option.value,
                    ),
                  )
                }
              >
                {field.options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : field.type === "json" ? (
              <textarea
                dir="ltr"
                rows={7}
                className={fieldClass}
                required={field.required}
                value={String(config[field.key] || "")}
                onChange={(event) =>
                  updateConfig(field.key, event.target.value)
                }
              />
            ) : (
              <input
                dir={field.type === "url" ? "ltr" : undefined}
                type={
                  field.type === "url"
                    ? "url"
                    : field.type === "number"
                      ? "number"
                      : "text"
                }
                className={fieldClass}
                required={field.required}
                value={String(config[field.key] || "")}
                onChange={(event) =>
                  updateConfig(field.key, event.target.value)
                }
                placeholder={
                  field.type === "multiselect"
                    ? "products, inventory, sales"
                    : undefined
                }
              />
            )}
          </label>
        ))}
      </div>
      {scheme !== "none" && (
        <div className="grid gap-4 rounded-2xl border border-white/10 p-4">
          <h4 className="font-black">بيانات المصادقة المشفّرة</h4>
          {scheme === "api_key" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {authInput("name", "اسم المفتاح")}
                {authInput("value", "قيمة المفتاح", "password")}
              </div>
              <label className="grid gap-2 text-sm font-bold">
                <span>موضع المفتاح</span>
                <select
                  className={fieldClass}
                  value={auth.placement || "header"}
                  onChange={(event) =>
                    updateAuth("placement", event.target.value)
                  }
                >
                  <option value="header">Header</option>
                  <option value="query">Query parameter</option>
                </select>
              </label>
            </>
          )}
          {scheme === "bearer" &&
            authInput("token", "Bearer Token", "password")}
          {scheme === "basic" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {authInput("username", "اسم المستخدم")}
              {authInput("password", "كلمة المرور", "password")}
            </div>
          )}
          {scheme === "oauth2" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {authInput("accessToken", "Access Token", "password")}
                {authInput("refreshToken", "Refresh Token", "password", false)}
              </div>
              {authInput("scope", "Scopes", "text", false)}
            </>
          )}
          {scheme === "database" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {authInput("host", "المضيف")}
                {authInput("port", "المنفذ", "number")}
                {authInput("database", "قاعدة البيانات")}
                {authInput("username", "اسم المستخدم")}
                {authInput("password", "كلمة المرور", "password")}
              </div>
            </>
          )}
          {scheme === "custom" &&
            authInput("secret", "السر المشترك", "password")}
        </div>
      )}
      <input type="hidden" name="config" value={serializedConfig} />
      <input type="hidden" name="auth" value={serializedAuth} />
    </V2ActionForm>
  );
}
