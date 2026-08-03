"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icons";
import { cx } from "@/components/ui/Enterprise";
import { siteConfig } from "@/src/config/site";
import ThemeToggle from "@/components/theme/ThemeToggle";
import NavigationControls from "@/components/navigation/NavigationControls";
import { workspaceNavigation } from "@/src/lib/v2/navigation";
import type { OperatingMode } from "@/src/lib/v2/account";
import type { VerticalExtension } from "@/src/lib/v2/verticals";
import { saveWorkspaceNavigationState } from "@/app/actions/navigation";

const roleNames: Record<string, string> = {
  OWNER: "المالك",
  ADMIN: "مدير",
  EDITOR: "محرر",
  VIEWER: "مشاهد",
  MEMBER: "عضو",
};
const subscriptionNames: Record<string, string> = {
  active: "نشط",
  trialing: "تجريبي",
  past_due: "متأخر",
  expired: "منتهي",
  cancelled: "ملغى",
  grace: "مهلة سماح",
};
const currencyNames: Record<string, string> = {
  YER: "ريال يمني",
  SAR: "ريال سعودي",
  USD: "دولار أمريكي",
};
const NAV_STATE_KEY = "madar:v2:workspace-nav";

export default function EnterpriseWorkspaceShell({
  children,
  workspaceName,
  role,
  currency,
  subscriptionStatus,
  extension,
  specializationName,
  enabledModules,
  operatingMode,
  initialCompact,
}: {
  children: ReactNode;
  workspaceName: string;
  role: string;
  currency: string;
  subscriptionStatus: string;
  extension: VerticalExtension;
  specializationName: string;
  enabledModules: string[];
  operatingMode: OperatingMode;
  initialCompact: boolean;
}) {
  const pathname = usePathname(),
    [compact, setCompact] = useState(initialCompact),
    [, startTransition] = useTransition(),
    navigation = workspaceNavigation(extension, enabledModules);
  const changeCompact = () =>
    setCompact((current) => {
      const next = !current;
      localStorage.setItem(
        NAV_STATE_KEY,
        JSON.stringify({ version: 1, compact: next }),
      );
      startTransition(() => {
        void saveWorkspaceNavigationState(next);
      });
      return next;
    });
  const isActive = (href: string) =>
    href === "/workspace"
      ? pathname === "/workspace"
      : pathname?.startsWith(href);
  return (
    <div
      className={cx(
        "md-sidebar-layout md-shell print:block",
        compact && "md-sidebar-compact",
      )}
    >
      <aside className="md-sidebar md-no-print" aria-label="تنقل مساحة العمل">
        <div className="border-b border-white/10 pb-4">
          <Link href="/dashboard" className="flex items-center text-white">
            <Image
              src={siteConfig.assets.logo}
              alt="شعار مَدار | ORBIT"
              width={164}
              height={38}
              className="h-8 w-auto"
            />
          </Link>
          <div className="mt-3 min-w-0">
            <p className="text-xs font-bold text-emerald-300">
              {specializationName}
            </p>
            <h1 className="truncate text-sm font-black">{workspaceName}</h1>
            <p className="mt-1 text-[11px] text-slate-500">
              {operatingMode === "MADAR_NATIVE"
                ? "مَدار هو النظام الأساسي"
                : "مرتبط بنظام خارجي"}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/10 bg-white/[.03] p-2">
            <span className="block text-[11px] text-slate-500">الصلاحية</span>
            <strong className="text-xs">{roleNames[role] || "عضو"}</strong>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[.03] p-2">
            <span className="block text-[11px] text-slate-500">الاشتراك</span>
            <strong className="text-xs">
              {subscriptionNames[subscriptionStatus] || "غير محدد"}
            </strong>
          </div>
        </div>
        <nav className="md-sidebar-nav mt-5">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cx(
                "md-sidebar-link",
                isActive(item.href) && "md-sidebar-link-active",
                item.orby &&
                  "border border-violet-300/10 bg-gradient-to-l from-violet-400/10 to-emerald-400/5",
              )}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/[.04]">
                {item.orby ? (
                  <Image
                    src={siteConfig.assets.orby}
                    alt="صورة أوربي"
                    width={28}
                    height={28}
                    unoptimized
                    className="md-orby-alive h-7 w-7 rounded-md object-cover"
                  />
                ) : (
                  <Icon name={item.icon} className="h-4 w-4" />
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-5 grid gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={changeCompact}
            className="md-button md-button-ghost md-button-sm"
          >
            <Icon name="layers" />
            {compact ? "توسيع التنقل" : "تنقل مدمج"}
          </button>
          <Link
            href="/dashboard-app"
            className="md-button md-button-secondary md-button-sm"
          >
            <Icon name="automation" />
            تحميل تطبيق لوحة القيادة
          </Link>
          <p className="text-xs leading-6 text-slate-500">
            العملة: {currencyNames[currency] || currency}
            <br />
            بيانات هذه المساحة معزولة عن جميع المساحات الأخرى.
          </p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="md-topbar md-no-print">
          <div className="flex min-h-14 items-center justify-between gap-4 px-4 sm:px-6">
            <NavigationControls />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link href="/workspace/orby" className="hidden sm:inline-flex">
                <span className="md-orby-chip">
                  <Image
                    src={siteConfig.assets.orby}
                    alt="صورة أوربي"
                    width={28}
                    height={28}
                    unoptimized
                    className="md-orby-avatar md-orby-alive"
                  />
                  <span>اسأل أوربي</span>
                </span>
              </Link>
              <Link
                href="/account"
                className="md-button md-button-secondary md-button-sm"
              >
                <Icon name="user" />
                حسابي
              </Link>
            </div>
          </div>
        </header>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
