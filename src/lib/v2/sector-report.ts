import "server-only";
import { businessMoney } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";
import type { VerticalExtension } from "./verticals";

export type SectorMetric = {
  key: string;
  label: string;
  value: string;
  href: string;
};
const rows = <T>(value: unknown) =>
  Array.isArray(value) ? (value as T[]) : [];
export async function sectorMetrics(
  organizationId: string,
  currency: string,
  extension: VerticalExtension,
): Promise<SectorMetric[]> {
  const id = encodeURIComponent(organizationId);
  if (extension === "food_service") {
    const report = rows<{
      completed_orders: number;
      revenue: number;
      ingredient_cost: number;
      gross_profit: number;
      avg_ticket_minutes: number;
    }>(
      await supabaseFetch(
        `/rest/v1/restaurant_profit_report?organization_id=eq.${id}&select=*`,
      ).catch(() => []),
    )[0];
    return [
      {
        key: "orders",
        label: "طلبات المطعم",
        value: String(report?.completed_orders || 0),
        href: "/workspace/restaurant",
      },
      {
        key: "revenue",
        label: "إيراد الوجبات",
        value: businessMoney(report?.revenue || 0, currency),
        href: "/workspace/restaurant",
      },
      {
        key: "food_cost",
        label: "تكلفة المكونات",
        value: businessMoney(report?.ingredient_cost || 0, currency),
        href: "/workspace/inventory",
      },
      {
        key: "profit",
        label: "هامش الوجبات",
        value: businessMoney(report?.gross_profit || 0, currency),
        href: "/workspace/analytics",
      },
    ];
  }
  if (extension === "hospitality") {
    const report = rows<{
      total_rooms: number;
      occupied_rooms: number;
      occupancy: number;
      room_revenue: number;
    }>(
      await supabaseFetch(
        `/rest/v1/hotel_daily_report?organization_id=eq.${id}&select=*`,
      ).catch(() => []),
    )[0];
    return [
      {
        key: "rooms",
        label: "إجمالي الغرف",
        value: String(report?.total_rooms || 0),
        href: "/workspace/hotel",
      },
      {
        key: "occupied",
        label: "الغرف المشغولة",
        value: String(report?.occupied_rooms || 0),
        href: "/workspace/hotel",
      },
      {
        key: "occupancy",
        label: "نسبة الإشغال",
        value: `${Number(report?.occupancy || 0).toLocaleString("ar-SA")}%`,
        href: "/workspace/analytics",
      },
      {
        key: "room_revenue",
        label: "إيراد الغرف اليوم",
        value: businessMoney(report?.room_revenue || 0, currency),
        href: "/workspace/analytics",
      },
    ];
  }
  const report = rows<{
    revenue: number;
    cost_of_goods: number;
    expenses: number;
    returns: number;
    net_profit: number;
  }>(
    await supabaseFetch(
      `/rest/v1/commerce_profit_report?organization_id=eq.${id}&select=*`,
    ).catch(() => []),
  )[0];
  return [
    {
      key: "revenue",
      label: "إجمالي المبيعات",
      value: businessMoney(report?.revenue || 0, currency),
      href: "/workspace/sales",
    },
    {
      key: "cogs",
      label: "تكلفة البضاعة",
      value: businessMoney(report?.cost_of_goods || 0, currency),
      href: "/workspace/procurement",
    },
    {
      key: "returns",
      label: "المرتجعات",
      value: businessMoney(report?.returns || 0, currency),
      href: "/workspace/sales",
    },
    {
      key: "profit",
      label: "صافي الربح",
      value: businessMoney(report?.net_profit || 0, currency),
      href: "/workspace/analytics",
    },
  ];
}
