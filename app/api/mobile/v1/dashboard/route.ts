import { NextResponse } from "next/server";
import {
  currentUser,
  profileForUser,
  supabaseFetch,
} from "@/src/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Organization = {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  currency: "YER" | "SAR" | "USD";
  operating_mode?: "MADAR_NATIVE" | "CONNECTED_EXTERNAL";
  source_of_truth?: "MADAR" | "EXTERNAL";
  setup_status?: string;
};

type Membership = {
  role: string;
  organizations: Organization | Organization[] | null;
};
type Product = {
  id: string;
  name: string;
  stock_quantity: number | string;
  low_stock_threshold: number | string;
  is_active: boolean;
};
type Sale = { id: string; total: number | string; sold_at: string };
type Expense = { id: string; amount: number | string; incurred_at: string };
type Task = {
  id: string;
  title: string;
  priority: string;
  due_at: string | null;
};
type Insight = {
  id: string;
  severity: string;
  title: string;
  body: string;
  generated_at: string;
};
type SubscriptionStatus =
  "trialing" | "active" | "past_due" | "expired" | "cancelled" | "missing";

const scalar = <T>(value: unknown) =>
  Array.isArray(value) ? (value[0] as T) : (value as T);
const rows = <T>(value: unknown) =>
  Array.isArray(value) ? (value as T[]) : [];
const tokenFrom = (request: Request) => {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
};
const organizationOf = (membership: Membership | undefined) => {
  const value = membership?.organizations;
  return (Array.isArray(value) ? value[0] : value) || null;
};
const number = (value: number | string | null | undefined) =>
  Number(value || 0);
const adenDateKey = (value: Date | string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Aden",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const arabicDay = (date: Date) =>
  new Intl.DateTimeFormat("ar-YE", {
    timeZone: "Asia/Aden",
    weekday: "short",
  }).format(date);
const safe = async <T>(work: Promise<T>, fallback: T) =>
  work.catch(() => fallback);

export async function GET(request: Request) {
  const accessToken = tokenFrom(request);
  if (!accessToken)
    return NextResponse.json(
      { error: "يجب تسجيل الدخول أولًا." },
      { status: 401 },
    );

  const user = await currentUser(accessToken);
  if (!user)
    return NextResponse.json(
      { error: "انتهت جلسة تسجيل الدخول." },
      { status: 401 },
    );

  try {
    const profile = await profileForUser(user.id, accessToken);
    if (profile?.account_type !== "BUSINESS")
      return NextResponse.json(
        { error: "تطبيق لوحة القيادة مخصص لحسابات الأعمال." },
        { status: 403 },
      );
    const memberships = rows<Membership>(
      await supabaseFetch(
        `/rest/v1/organization_members?user_id=eq.${encodeURIComponent(user.id)}&select=role,organizations(id,name,slug,type,status,currency,operating_mode,source_of_truth,setup_status)`,
        {},
        accessToken,
      ),
    );
    const requestedWorkspace =
      request.headers.get("x-madar-workspace-id") ||
      new URL(request.url).searchParams.get("workspaceId");
    const membership = requestedWorkspace
      ? memberships.find(
          (item) =>
            organizationOf(item)?.id === requestedWorkspace &&
            organizationOf(item)?.type !== "STUDENT",
        )
      : memberships.find(
          (item) =>
            organizationOf(item)?.id ===
              profile.default_commercial_organization_id &&
            organizationOf(item)?.type !== "STUDENT",
        ) ||
        memberships.find((item) => organizationOf(item)?.type !== "STUDENT");
    const workspace = organizationOf(membership);

    if (requestedWorkspace && !membership)
      return NextResponse.json(
        { error: "مساحة العمل المطلوبة غير مرتبطة بهذا الحساب." },
        { status: 403 },
      );
    if (!membership || !workspace)
      return NextResponse.json(
        { error: "لا توجد مساحة عمل تجارية مرتبطة بهذا الحساب." },
        { status: 403 },
      );
    if (workspace.status !== "active")
      return NextResponse.json(
        { error: "مساحة العمل غير نشطة حاليًا." },
        { status: 403 },
      );

    const v2Subscriptions = rows<{
      status: SubscriptionStatus;
      trial_ends_at: string | null;
      ends_at: string | null;
    }>(
      await safe(
        supabaseFetch(
          `/rest/v1/pricing_subscription_snapshots?organization_id=eq.${encodeURIComponent(workspace.id)}&status=in.(trialing,active,past_due)&select=status,trial_ends_at,ends_at&order=created_at.desc&limit=1`,
          {},
          accessToken,
        ),
        [],
      ),
    );
    let subscriptionStatus: SubscriptionStatus = "missing";
    const v2Subscription = v2Subscriptions[0];
    if (v2Subscription) {
      const deadline =
        v2Subscription.status === "trialing"
          ? v2Subscription.trial_ends_at
          : v2Subscription.ends_at;
      subscriptionStatus =
        deadline && Date.parse(deadline) <= Date.now()
          ? "expired"
          : v2Subscription.status;
    } else
      subscriptionStatus = scalar<SubscriptionStatus>(
        await supabaseFetch(
          "/rest/v1/rpc/refresh_workspace_subscription",
          {
            method: "POST",
            body: JSON.stringify({ target_organization: workspace.id }),
          },
          accessToken,
        ),
      );
    if (
      subscriptionStatus === "missing" ||
      subscriptionStatus === "expired" ||
      subscriptionStatus === "cancelled"
    ) {
      return NextResponse.json(
        { error: "الاشتراك غير نشط. افتح منصة الويب لمراجعة حالة الاشتراك." },
        { status: 403 },
      );
    }

    const now = new Date();
    const from30 = new Date(now);
    from30.setUTCDate(from30.getUTCDate() - 29);
    from30.setUTCHours(0, 0, 0, 0);
    const from30Iso = from30.toISOString();
    const from30Date = adenDateKey(from30);
    const organizationId = encodeURIComponent(workspace.id);

    const [
      productData,
      customerData,
      salesData,
      expenseData,
      taskData,
      insightData,
      recentData,
      activityData,
    ] = await Promise.all([
      safe(
        supabaseFetch(
          `/rest/v1/business_products?organization_id=eq.${organizationId}&select=id,name,stock_quantity,low_stock_threshold,is_active`,
          {},
          accessToken,
        ),
        [],
      ),
      safe(
        supabaseFetch(
          `/rest/v1/business_customers?organization_id=eq.${organizationId}&select=id,status`,
          {},
          accessToken,
        ),
        [],
      ),
      safe(
        supabaseFetch(
          `/rest/v1/business_sales?organization_id=eq.${organizationId}&status=eq.completed&sold_at=gte.${encodeURIComponent(from30Iso)}&select=id,total,sold_at&order=sold_at.asc&limit=2000`,
          {},
          accessToken,
        ),
        [],
      ),
      safe(
        supabaseFetch(
          `/rest/v1/business_expenses?organization_id=eq.${organizationId}&incurred_at=gte.${encodeURIComponent(from30Date)}&select=id,amount,incurred_at&order=incurred_at.asc&limit=2000`,
          {},
          accessToken,
        ),
        [],
      ),
      safe(
        supabaseFetch(
          `/rest/v1/business_tasks?organization_id=eq.${organizationId}&status=in.(todo,in_progress)&select=id,title,priority,due_at&order=due_at.asc.nullslast&limit=12`,
          {},
          accessToken,
        ),
        [],
      ),
      safe(
        supabaseFetch(
          `/rest/v1/orby_insights?organization_id=eq.${organizationId}&status=eq.active&select=id,severity,title,body,generated_at&order=generated_at.desc&limit=12`,
          {},
          accessToken,
        ),
        [],
      ),
      safe(
        supabaseFetch(
          `/rest/v1/business_sales?organization_id=eq.${organizationId}&status=eq.completed&select=id,total,sold_at&order=sold_at.desc&limit=8`,
          {},
          accessToken,
        ),
        [],
      ),
      safe(
        supabaseFetch(
          `/rest/v1/activity_profiles?organization_id=eq.${organizationId}&status=eq.active&select=activity_specializations(code,name_ar)&limit=1`,
          {},
          accessToken,
        ),
        [],
      ),
    ]);

    const activity = rows<{
        activity_specializations:
          | { code: string; name_ar: string }
          | Array<{ code: string; name_ar: string }>;
      }>(activityData)[0],
      specialization = scalar<{ code: string; name_ar: string }>(
        activity?.activity_specializations,
      ) || { code: "GENERAL_COMMERCE", name_ar: "تجارة عامة" },
      extension =
        specialization.code === "RESTAURANT"
          ? "food_service"
          : specialization.code === "HOTEL"
            ? "hospitality"
            : "commerce";
    const sectorReport =
      extension === "food_service"
        ? rows(
            await safe(
              supabaseFetch(
                `/rest/v1/restaurant_profit_report?organization_id=eq.${organizationId}&select=*`,
                {},
                accessToken,
              ),
              [],
            ),
          )[0]
        : extension === "hospitality"
          ? rows(
              await safe(
                supabaseFetch(
                  `/rest/v1/hotel_daily_report?organization_id=eq.${organizationId}&select=*`,
                  {},
                  accessToken,
                ),
                [],
              ),
            )[0]
          : rows(
              await safe(
                supabaseFetch(
                  `/rest/v1/commerce_profit_report?organization_id=eq.${organizationId}&select=*`,
                  {},
                  accessToken,
                ),
                [],
              ),
            )[0];

    const products = rows<Product>(productData);
    const customers = rows<{ id: string; status: string }>(customerData);
    const sales = rows<Sale>(salesData);
    const expenses = rows<Expense>(expenseData);
    const tasks = rows<Task>(taskData);
    const insights = rows<Insight>(insightData);
    const recentSales = rows<Sale>(recentData);
    const lowStock = products.filter(
      (product) =>
        product.is_active &&
        number(product.stock_quantity) <= number(product.low_stock_threshold),
    );
    const revenue30d = sales.reduce((sum, sale) => sum + number(sale.total), 0);
    const expenses30d = expenses.reduce(
      (sum, expense) => sum + number(expense.amount),
      0,
    );
    const today = adenDateKey(now);
    const todayRevenue = sales
      .filter((sale) => adenDateKey(sale.sold_at) === today)
      .reduce((sum, sale) => sum + number(sale.total), 0);
    const overdue = tasks.filter(
      (task) => task.due_at && new Date(task.due_at).getTime() < now.getTime(),
    );

    const dailySeries = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - (6 - index));
      const key = adenDateKey(date);
      return {
        date: key,
        label: arabicDay(date),
        revenue: sales
          .filter((sale) => adenDateKey(sale.sold_at) === key)
          .reduce((sum, sale) => sum + number(sale.total), 0),
        expenses: expenses
          .filter((expense) => adenDateKey(expense.incurred_at) === key)
          .reduce((sum, expense) => sum + number(expense.amount), 0),
      };
    });

    const alerts = insights.map((insight) => ({
      id: `orby-${insight.id}`,
      severity: ["critical", "warning", "info"].includes(insight.severity)
        ? insight.severity
        : "info",
      title: insight.title,
      body: insight.body,
      generatedAt: insight.generated_at,
    }));

    if (lowStock.length)
      alerts.push({
        id: "inventory-low-stock",
        severity: lowStock.some(
          (product) => number(product.stock_quantity) <= 0,
        )
          ? "critical"
          : "warning",
        title: "مخزون يحتاج متابعة",
        body: `${lowStock.length} ${lowStock.length === 1 ? "منتج وصل" : "منتجات وصلت"} إلى حد التنبيه أو أقل.`,
        generatedAt: now.toISOString(),
      });
    if (overdue.length)
      alerts.push({
        id: "tasks-overdue",
        severity: "warning",
        title: "مهام تجاوزت موعدها",
        body: `${overdue.length} ${overdue.length === 1 ? "مهمة تحتاج" : "مهام تحتاج"} مراجعة الموعد أو الإغلاق.`,
        generatedAt: now.toISOString(),
      });
    if (subscriptionStatus === "past_due")
      alerts.push({
        id: "subscription-past-due",
        severity: "warning",
        title: "الاشتراك يحتاج مراجعة",
        body: "الاشتراك مسجل كمتأخر. راجع صفحة الاشتراك في منصة الويب.",
        generatedAt: now.toISOString(),
      });
    if (!alerts.length)
      alerts.push({
        id: "workspace-stable",
        severity: "success",
        title: "لا توجد أمور حرجة الآن",
        body: "المؤشرات المتاحة لا تعرض مخاطر عاجلة في هذه اللحظة.",
        generatedAt: now.toISOString(),
      });

    const severityOrder: Record<string, number> = {
      critical: 0,
      warning: 1,
      info: 2,
      success: 3,
    };
    alerts.sort(
      (a, b) =>
        (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9),
    );

    return NextResponse.json(
      {
        profile: {
          id: user.id,
          fullName: profile?.full_name || null,
          email: profile?.email || user.email || null,
          avatarUrl: profile?.avatar_url || null,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
          type: workspace.type,
          status: workspace.status,
          currency: workspace.currency || "YER",
          role: membership.role,
          operatingMode: workspace.operating_mode || "MADAR_NATIVE",
          sourceOfTruth: workspace.source_of_truth || "MADAR",
          setupStatus: workspace.setup_status || "ready",
        },
        availableWorkspaces: memberships.flatMap((item) => {
          const organization = organizationOf(item);
          return organization && organization.type !== "STUDENT"
            ? [
                {
                  id: organization.id,
                  name: organization.name,
                  role: item.role,
                },
              ]
            : [];
        }),
        vertical: {
          code: specialization.code,
          name: specialization.name_ar,
          extension,
        },
        subscriptionStatus,
        status: alerts.some(
          (alert) =>
            alert.severity === "critical" || alert.severity === "warning",
        )
          ? "attention"
          : "ok",
        summary: {
          products: products.length,
          customers: customers.length,
          revenue30d,
          expenses30d,
          profit30d: revenue30d - expenses30d,
          todayRevenue,
          openTasks: tasks.length,
          lowStock: lowStock.length,
          sector: sectorReport || {},
        },
        alerts,
        tasks: tasks
          .slice(0, 6)
          .map((task) => ({
            id: task.id,
            title: task.title,
            priority: task.priority,
            dueAt: task.due_at,
          })),
        recentSales: recentSales.map((sale) => ({
          id: sale.id,
          total: number(sale.total),
          soldAt: sale.sold_at,
        })),
        dailySeries,
        fetchedAt: now.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "MADAR mobile dashboard failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "تعذر تجهيز لوحة العمل الآن." },
      { status: 503 },
    );
  }
}
