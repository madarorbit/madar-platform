"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import CartStatusLink from "@/components/platform/CartStatusLink";
import GlobalUserActions from "@/components/platform/GlobalUserActions";
import MadarLayerNavigation from "@/components/shell/MadarLayerNavigation";
import { ButtonLink, IconButton, IconLink, StatusBadge } from "@/components/ui/Enterprise";
import { Menu, Sheet } from "@/components/ui/EnterpriseClient";
import { Icon } from "@/components/ui/Icons";
import type { ShellContextDefinition, ShellIdentity } from "@/src/lib/ux/shell";

export default function OrbyShell({
  children,
  sidebar,
  plus,
  newChatHref,
  authenticated,
  contextLabel,
  returnHref,
  identity,
  shellContext,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  plus: boolean;
  newChatHref: string;
  authenticated: boolean;
  contextLabel: string;
  returnHref: string;
  identity?: ShellIdentity;
  shellContext?: ShellContextDefinition;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const closeLayers = useCallback(() => setLayersOpen(false), []);
  return (
    <main className="md-orby-shell">
      <a href="#orby-content" className="md-skip-link">تجاوز إلى المحادثة</a>
      <div className="md-orby-layout">
        <header className="md-orby-header md-no-print">
          <div className="md-orby-header-main">
            <IconButton
              label="فتح طبقات مَدار"
              onClick={() => setLayersOpen(true)}
              aria-expanded={layersOpen}
              aria-controls="orby-layer-navigation"
            ><Icon name="layers" /></IconButton>
            <IconLink href={returnHref} label="العودة إلى السياق السابق">
              <Icon name="back" className="md-icon-directional" />
            </IconLink>
            {authenticated && sidebar ? (
              <IconButton
                label="فتح محادثات ORBY"
                className="md-orby-mobile-sidebar-button"
                onClick={() => setSidebarOpen(true)}
                aria-expanded={sidebarOpen}
              ><Icon name="menu" /></IconButton>
            ) : null}
            <Image src="/brand/orby-assistant.svg" width={36} height={36} alt="ORBY" className="md-orby-header-avatar" />
            <div className="md-orby-header-copy">
              <div><strong>ORBY</strong>{plus ? <StatusBadge status="approved">Plus</StatusBadge> : null}</div>
              <span>{contextLabel}</span>
            </div>
          </div>
          <div className="md-orby-header-actions">
            <ButtonLink href={newChatHref} variant="secondary" size="sm"><Icon name="plus" /><span>محادثة جديدة</span></ButtonLink>
            {authenticated && identity ? (
              <GlobalUserActions
                displayName={identity.displayName}
                hasAvatar={identity.hasAvatar}
                isAdmin={identity.isAdmin}
                unread={identity.unread}
                notifications={identity.notifications}
                showOrby={false}
              />
            ) : (
              <><CartStatusLink /><ButtonLink href="/login?next=/orby" variant="ghost" size="sm">تسجيل الدخول</ButtonLink></>
            )}
            <Menu label="خيارات ORBY" trigger={<span className="md-icon-button"><Icon name="more" /></span>}>
              <Link href="/orby/plus"><Icon name="sparkles" />ORBY Plus</Link>
              {authenticated ? (
                <><Link href="/account/privacy"><Icon name="shield" />الخصوصية والبيانات</Link><Link href="/account"><Icon name="user" />حساب مَدار</Link></>
              ) : null}
            </Menu>
          </div>
        </header>
        <div className={authenticated && sidebar ? "md-orby-frame has-sidebar" : "md-orby-frame"}>
          {authenticated && sidebar ? <aside className="md-orby-desktop-sidebar">{sidebar}</aside> : null}
          <section id="orby-content" tabIndex={-1} className="md-orby-content">{children}</section>
        </div>
      </div>
      {authenticated && sidebar ? (
        <Sheet open={sidebarOpen} onClose={closeSidebar} title="محادثات ORBY" description={contextLabel}>{sidebar}</Sheet>
      ) : null}
      <Sheet open={layersOpen} onClose={closeLayers} title="طبقات مَدار" description={contextLabel}>
        <div id="orby-layer-navigation">
          <MadarLayerNavigation authenticated={authenticated} context={shellContext} onNavigate={closeLayers} />
        </div>
      </Sheet>
    </main>
  );
}
