import { cache } from "react";
import { assertRetailWorkspaceAccess } from "@/src/lib/retail/server/auth/context";
import { executeRetailRpc } from "@/src/lib/retail/server/rpc";
import type { AnalyticsSnapshot } from "@/src/lib/retail/types";

export const getAnalyticsSnapshot = cache(
  async (workspaceId: string, dateFrom: string, dateTo: string) => {
    const { user } = await assertRetailWorkspaceAccess(workspaceId);
    return executeRetailRpc<AnalyticsSnapshot>(user.id, "retail_analytics_snapshot", {
      target_workspace: workspaceId,
      date_from: dateFrom,
      date_to: dateTo,
    });
  },
);

export function localDate(timeZone = "Asia/Aden", date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function dateDaysAgo(days: number, timeZone = "Asia/Aden") {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - days);
  return localDate(timeZone, value);
}
