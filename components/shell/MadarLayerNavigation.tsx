"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icons";
import { cx } from "@/components/ui/Enterprise";
import {
  guestLayerNavigation,
  platformLayerNavigation,
  platformRouteMatches,
} from "@/src/lib/ux/platform-navigation";
import type { ProductNavigationGroup } from "@/src/lib/ux/navigation";
import type { ShellContextDefinition } from "@/src/lib/ux/shell";

export default function MadarLayerNavigation({
  authenticated,
  context,
  contextGroups = [],
  onNavigate,
}: {
  authenticated: boolean;
  context?: ShellContextDefinition;
  contextGroups?: ProductNavigationGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname() || "/";
  const globalGroups = authenticated
    ? platformLayerNavigation
    : guestLayerNavigation;
  const groups =
    context?.kind === "account"
      ? globalGroups
      : [...globalGroups, ...contextGroups];

  return (
    <div className="md-layer-navigation">
      {context?.options?.length ? (
        <section className="md-layer-services" aria-labelledby="md-layer-services-title">
          <div className="md-layer-section-heading">
            <div>
              <span>الخدمات والمساحات</span>
              <strong id="md-layer-services-title">انتقال مباشر</strong>
            </div>
            <Link href="/account/services" onClick={onNavigate}>إدارة</Link>
          </div>
          <div className="md-layer-service-list">
            {context.options.map((option) => {
              const current =
                option.organizationId === context.currentOrganizationId;
              return (
                <Link
                  key={`${option.serviceCode}:${option.organizationId}`}
                  href={option.href}
                  onClick={onNavigate}
                  aria-current={current ? "page" : undefined}
                  className={cx("md-layer-service", current && "is-current")}
                >
                  <span className="md-layer-service-icon">
                    <Icon
                      name={
                        option.kind === "retail"
                          ? "store"
                          : option.kind === "connected"
                            ? "automation"
                            : "layers"
                      }
                    />
                  </span>
                  <span>
                    <strong>{option.workspaceName}</strong>
                    <small>{option.serviceName}</small>
                  </span>
                  {current ? <Icon name="check" className="h-4 w-4" /> : null}
                </Link>
              );
            })}
          </div>
        </section>
      ) : authenticated ? (
        <Link href="/account/services" onClick={onNavigate} className="md-layer-empty-service">
          <Icon name="layers" />
          <span><strong>لا توجد خدمة نشطة</strong><small>افتح خدماتي لمعرفة الحالة أو بدء التفعيل.</small></span>
        </Link>
      ) : null}

      {groups.map((group, index) => (
        <section
          key={`${group.key}-${index}`}
          className="md-layer-nav-group"
          aria-labelledby={`md-layer-${group.key}-${index}`}
        >
          <h2 id={`md-layer-${group.key}-${index}`}>{contextGroups.includes(group) ? `داخل ${context?.name} · ${group.label}` : group.label}</h2>
          <div>
            {group.items.map((item) => {
              const active = platformRouteMatches(pathname, item.href);
              return (
                <Link
                  key={`${group.key}:${item.href}`}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cx("md-layer-nav-link", active && "is-active", item.orby && "is-orby")}
                >
                  <span className="md-layer-nav-icon">
                    {item.orby ? (
                      <Image src="/brand/orby-assistant.svg" alt="" width={26} height={26} unoptimized />
                    ) : (
                      <Icon name={item.icon} />
                    )}
                  </span>
                  <span><strong>{item.label}</strong><small>{item.description}</small></span>
                  {active ? <Icon name="check" className="h-4 w-4" /> : null}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
