import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceRequest } from "@/app/actions/services";
import { Badge, ButtonLink, Card, Field, Input, Notice, Select } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { businessMoney } from "@/src/lib/business";
import { isServiceCode, serviceStateLabels } from "@/src/lib/services/catalog";
import { getServiceSetupContext } from "@/src/lib/services/server";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

const retailSubtypes = [
  ["GENERAL_RETAIL", "تجارة عامة بالتجزئة"], ["GROCERY", "بقالة"],
  ["CLOTHING", "ملابس"], ["PERFUME", "عطور"],
  ["ELECTRONICS", "إلكترونيات"], ["ACCESSORIES", "إكسسوارات"],
  ["SPARE_PARTS", "قطع غيار"], ["OTHER", "أخرى"],
] as const;

export default async function ServiceSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ code: rawCode }, query] = await Promise.all([params, searchParams]);
  const code = rawCode.toUpperCase();
  if (!isServiceCode(code)) notFound();
  const { profile, service } = await getServiceSetupContext(code);
  if (service.state === "ACTIVE") redirect(service.definition.openHref);
  const specializations = code === "BUILD_ON_MADAR"
    ? await supabaseFetch(
      "/rest/v1/activity_specializations?status=eq.approved&is_visible=eq.true&launch_enabled=eq.true&select=code,name_ar&order=sort_order",
    ).catch(() => [])
    : [];
  const canSubmit = Boolean(service.plan?.is_active && service.plan?.is_available);

  return (
    <AccountPage>
      <AccountPageHeader
        eyebrow="إعداد خدمة مستقلة"
        title={service.definition.name}
        description={service.definition.detail}
      />
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-300/10 text-violet-100">
                  <Icon name={service.definition.icon} />
                </span>
                <div>
                  <p className="text-sm text-slate-400">حساب واحد · اشتراك مستقل</p>
                  <h2 className="text-xl font-black">بيانات التفعيل</h2>
                </div>
              </div>
              <Badge variant={service.state === "REJECTED" ? "danger" : "warning"}>
                {serviceStateLabels[service.state]}
              </Badge>
            </div>

            {query.error ? (
              <div className="mt-5"><Notice title="تعذر حفظ الطلب" variant="danger">{query.error}</Notice></div>
            ) : null}
            {service.request?.rejection_reason ? (
              <div className="mt-5"><Notice title="سبب الرفض السابق" variant="danger">{service.request.rejection_reason}</Notice></div>
            ) : null}
            {service.state === "PENDING_APPROVAL" ? (
              <div className="mt-6">
                <Notice title="الطلب بانتظار الإدارة" variant="warning">
                  وصل إثبات الدفع، ولن تُفتح الخدمة أو مساحة Retail قبل الاعتماد.
                </Notice>
                <ButtonLink href="/account" variant="secondary" className="mt-5">العودة إلى الحساب</ButtonLink>
              </div>
            ) : (
              <form action={createServiceRequest} className="mt-7 grid gap-5" encType="multipart/form-data">
                <input type="hidden" name="service_code" value={code} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="اسم التجارة" className="sm:col-span-2">
                    <Input name="trade_name" required minLength={2} maxLength={120} autoFocus />
                  </Field>
                  <Field label="اسم المالك">
                    <Input name="owner_name" defaultValue={profile?.full_name || ""} maxLength={100} />
                  </Field>
                  <Field label="رقم الهاتف">
                    <Input name="phone" defaultValue={profile?.phone || ""} maxLength={40} inputMode="tel" />
                  </Field>
                  <Field label="المدينة"><Input name="city" maxLength={80} /></Field>
                  <Field label="الدولة">
                    <Select name="country" defaultValue="YE"><option value="YE">اليمن</option></Select>
                  </Field>
                  <Field label="العملة">
                    <Select name="currency" defaultValue={service.plan?.currency || "YER"}>
                      <option value="YER">ريال يمني YER</option>
                      <option value="SAR">ريال سعودي SAR</option>
                      <option value="USD">دولار أمريكي USD</option>
                    </Select>
                  </Field>
                  <Field label="الشعار" help="اختياري · JPG أو PNG أو WebP حتى 5MB">
                    <Input name="logo" type="file" accept="image/jpeg,image/png,image/webp" />
                  </Field>
                </div>

                {code === "MADAR_RETAIL" ? (
                  <div className="grid gap-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.035] p-4 sm:grid-cols-2">
                    <Field label="نوع نشاط التجزئة" className="sm:col-span-2">
                      <Select name="subtype" defaultValue="GENERAL_RETAIL">
                        {retailSubtypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </Select>
                    </Field>
                    <Field label="عرض الأسعار">
                      <Select name="price_display" defaultValue="simple">
                        <option value="simple">سعر بسيط</option>
                        <option value="tax_inclusive">شامل الضريبة مستقبلًا</option>
                      </Select>
                    </Field>
                    <Field label="بادئة الفواتير"><Input name="invoice_prefix" defaultValue="MR" maxLength={8} dir="ltr" /></Field>
                    <label className="flex items-start gap-3 rounded-xl border border-white/10 p-4 sm:col-span-2">
                      <input type="checkbox" name="allow_credit_sales" defaultChecked className="mt-1" />
                      <span><strong className="block">السماح بالبيع الآجل</strong><small className="text-slate-400">ينشئ رصيدًا موثقًا على العميل عند البيع.</small></span>
                    </label>
                  </div>
                ) : null}

                {code === "CONNECT_EXISTING" ? (
                  <div className="grid gap-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.035] p-4 sm:grid-cols-2">
                    <Field label="اسم النظام الحالي"><Input name="external_system_name" minLength={2} maxLength={120} required /></Field>
                    <Field label="الشركة الموردة"><Input name="vendor_name" maxLength={120} /></Field>
                    <Field label="رابط النظام أو API" className="sm:col-span-2"><Input name="website" type="url" dir="ltr" maxLength={300} /></Field>
                    <Field label="نطاق الاتصال" className="sm:col-span-2">
                      <Select name="connection_scope" defaultValue="READ_ONLY">
                        <option value="READ_ONLY">قراءة فقط</option>
                        <option value="WRITE_LIMITED">كتابة محددة بموافقة</option>
                      </Select>
                    </Field>
                  </div>
                ) : null}

                {code === "BUILD_ON_MADAR" ? (
                  <Field label="نوع النشاط">
                    <Select name="specialization_code" required defaultValue={specializations?.[0]?.code}>
                      {(specializations || []).map((item: { code: string; name_ar: string }) => (
                        <option key={item.code} value={item.code}>{item.name_ar}</option>
                      ))}
                    </Select>
                  </Field>
                ) : null}

                <div className="flex flex-wrap gap-3 border-t border-white/10 pt-5">
                  <button disabled={!canSubmit} className="md-button md-button-primary md-button-lg">
                    متابعة إلى الدفع
                  </button>
                  <Link href="/account" className="md-button md-button-secondary md-button-lg">إلغاء</Link>
                </div>
              </form>
            )}
          </Card>

          <aside className="space-y-4">
            <Card className="p-5">
              <p className="text-sm text-slate-400">الباقة الوحيدة لهذه الخدمة</p>
              <h2 className="mt-2 text-xl font-black">{service.plan?.name || "السعر غير مهيأ"}</h2>
              {service.plan ? (
                <>
                  <strong className="mt-4 block text-3xl text-emerald-200">
                    {businessMoney(service.plan.price, service.plan.currency)}
                  </strong>
                  <p className="mt-2 text-sm text-slate-400">لمدة {service.plan.billing_months} شهر</p>
                  {service.plan.description ? <p className="mt-4 text-sm leading-7 text-slate-300">{service.plan.description}</p> : null}
                </>
              ) : null}
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3"><Icon name="shield" className="text-emerald-200" /><strong>تفعيل مضبوط</strong></div>
              <ol className="mt-4 grid gap-3 text-sm text-slate-300">
                <li>1. إعداد الخدمة</li><li>2. اختيار طريقة الدفع</li><li>3. رفع الإثبات</li><li>4. موافقة الإدارة</li><li>5. فتح الخدمة</li>
              </ol>
            </Card>
            {code === "MADAR_RETAIL" ? (
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <Image src="/brand/symbol-512x512.png" alt="MADAR Retail" width={42} height={42} />
                  <div><strong>MADAR Retail App</strong><p className="text-xs text-slate-400">Android قريبًا</p></div>
                </div>
                <button type="button" disabled className="md-button md-button-secondary mt-4 w-full">تحميل التطبيق قريبًا</button>
              </Card>
            ) : null}
          </aside>
      </div>
    </AccountPage>
  );
}
