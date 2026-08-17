"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { saveWorkspaceNavigationState } from "@/app/actions/navigation";
import GlobalUserActions from "@/components/platform/GlobalUserActions";
import NavigationControls from "@/components/navigation/NavigationControls";
import ShellModuleContext from "@/components/navigation/ShellModuleContext";
import MadarLayerNavigation from "@/components/shell/MadarLayerNavigation";
import { Avatar, IconButton, cx } from "@/components/ui/Enterprise";
import { Menu, Sheet } from "@/components/ui/EnterpriseClient";
import { Icon } from "@/components/ui/Icons";
import { siteConfig } from "@/src/config/site";
import { platformRouteMatches } from "@/src/lib/ux/platform-navigation";
import type { ProductNavigationGroup, ProductNavigationItem } from "@/src/lib/ux/navigation";
import type { ShellContextDefinition, ShellIdentity } from "@/src/lib/ux/shell";

const WorkspaceCommandPalette = dynamic(() => import("@/components/workspace/WorkspaceCommandPalette"));

type Props = {
  children: ReactNode;
  identity: ShellIdentity;
  context: ShellContextDefinition;
  navigationGroups: ProductNavigationGroup[];
  mobileItems: ProductNavigationItem[];
  orbyHref: string;
  initialCompact?: boolean;
  persistCompact?: boolean;
  commandPalette?: boolean;
  nativeHeaderRoutes?: string[];
  moduleContext?: boolean;
  alert?: ReactNode;
  footerNote?: string;
};

const contextKindLabels = { account: "حساب مَدار", workspace: "مساحة أعمال", retail: "MADAR Retail" } as const;

export default function MadarGlobalShell({ children, identity, context, navigationGroups, mobileItems, orbyHref, initialCompact=false, persistCompact=false, commandPalette=false, nativeHeaderRoutes=[], moduleContext=false, alert, footerNote }:Props) {
  const pathname=usePathname()||context.homeHref;
  const[persistedCompact,setPersistedCompact]=useState(initialCompact);
  const[layersOpen,setLayersOpen]=useState(false);
  const[paletteOpen,setPaletteOpen]=useState(false);
  const[,startTransition]=useTransition();
  const closeLayers=useCallback(()=>setLayersOpen(false),[]);
  const items=useMemo(()=>navigationGroups.flatMap((group)=>group.items),[navigationGroups]);
  const current=useMemo(()=>[...items].sort((a,b)=>b.href.length-a.href.length).find((item)=>platformRouteMatches(pathname,item.href))||items[0],[items,pathname]);
  const currentGroup=navigationGroups.find((group)=>group.items.some((item)=>item.key===current?.key));
  const hasNativeHeader=nativeHeaderRoutes.some((route)=>route===context.homeHref?pathname===route:pathname===route||pathname.startsWith(`${route}/`));
  const isActive=(href:string)=>platformRouteMatches(pathname,href);
  const compactStorageKey=`madar:shell:${context.kind}:compact`;
  const subscribeCompact=useCallback((notify:()=>void)=>{const storage=(event:StorageEvent)=>{if(event.key===compactStorageKey)notify();};window.addEventListener("storage",storage);window.addEventListener("madar-shell-compact",notify);return()=>{window.removeEventListener("storage",storage);window.removeEventListener("madar-shell-compact",notify);};},[compactStorageKey]);
  const localCompact=useSyncExternalStore(subscribeCompact,()=>{try{const saved=JSON.parse(localStorage.getItem(compactStorageKey)||"null");return saved?.version===1&&typeof saved.compact==="boolean"?saved.compact:initialCompact;}catch{return initialCompact;}},()=>initialCompact);
  const compact=persistCompact?persistedCompact:localCompact;

  const changeCompact=()=>{const next=!compact;if(persistCompact)setPersistedCompact(next);try{localStorage.setItem(compactStorageKey,JSON.stringify({version:1,compact:next}));window.dispatchEvent(new Event("madar-shell-compact"));}catch{}if(persistCompact){startTransition(async()=>{try{await saveWorkspaceNavigationState(next);}catch{}});}};

  const navigation=(mobile=false)=><nav className={mobile?"md-mobile-drawer-nav":"md-ux-sidebar-nav"} aria-label={`تنقل ${context.name}`}>{navigationGroups.map((group)=><details key={group.key} open={group.key!=="account"||group.items.some((item)=>isActive(item.href))} className="md-nav-group"><summary><span>{group.label}</span><Icon name="arrow" className="h-3.5 w-3.5" /></summary><div>{group.items.map((item)=><Link key={item.href} href={item.href} onClick={closeLayers} aria-current={isActive(item.href)?"page":undefined} className={cx("md-ux-nav-link",isActive(item.href)&&"is-active",item.orby&&"is-orby")}><span className="md-ux-nav-icon">{item.orby?<Image src={siteConfig.assets.orby} alt="" width={28} height={28} unoptimized/>:<Icon name={item.icon} className="h-4 w-4"/>}</span><span className="md-ux-nav-copy"><strong>{item.label}</strong><small>{item.description}</small></span></Link>)}</div></details>)}</nav>;

  const contextTrigger=<span className="md-shell-context-trigger">{context.kind==="account"?<Avatar src={identity.hasAvatar?"/account/avatar":null} size="sm"/>:<span className="md-workspace-avatar" aria-hidden="true">{context.name.slice(0,1)}</span>}<span className="md-workspace-switcher-copy"><strong>{context.name}</strong><small>{context.detail}</small></span><Icon name="arrow" className="h-3.5 w-3.5"/></span>;

  return <div className={cx("md-ux-shell md-global-shell",compact&&"is-compact")}>
    <a href="#main-content" className="md-skip-link">تجاوز إلى المحتوى</a>
    <aside className="md-ux-sidebar md-no-print">
      <div className="md-workspace-switcher md-shell-context">
        <Link href="/account" className="md-brand-mark" aria-label="العودة إلى مَدار"><Image src={siteConfig.assets.logo} alt="مَدار | ORBIT" width={150} height={36} className="h-7 w-auto" priority/></Link>
        <Menu label={`تبديل ${contextKindLabels[context.kind]}`} className="md-context-menu" trigger={contextTrigger}><div className="md-context-menu-panel"><div className="md-workspace-meta"><strong>{contextKindLabels[context.kind]}</strong><span>{context.meta||context.detail}</span></div><Link href={context.homeHref}><Icon name="home"/>الصفحة الرئيسية للسياق</Link>{context.options?.map((option)=><Link key={`${option.serviceCode}:${option.organizationId}`} href={option.href} aria-current={option.organizationId===context.currentOrganizationId?"page":undefined}><Icon name={option.kind==="retail"?"store":option.kind==="connected"?"automation":"layers"}/><span><strong>{option.workspaceName}</strong><small>{option.serviceName}</small></span></Link>)}{context.links?.map((link)=><Link key={link.href} href={link.href}><Icon name={link.icon}/>{link.label}</Link>)}<Link href="/account/services"><Icon name="layers"/>كل الخدمات والمساحات</Link></div></Menu>
      </div>
      {navigation()}
      <div className="md-ux-sidebar-footer"><button type="button" onClick={changeCompact} className="md-sidebar-control" aria-pressed={compact}><Icon name="layers"/><span>{compact?"توسيع التنقل":"تنقل مدمج"}</span></button>{footerNote?<span className="md-sidebar-footnote">{footerNote}</span>:null}</div>
    </aside>

    <div className="md-ux-main">
      <header className="md-ux-topbar md-no-print" data-madar-guide-occluder="top">
        <div className="md-topbar-context"><IconButton className="md-layers-trigger" onClick={()=>setLayersOpen(true)} label="فتح طبقات مَدار" aria-expanded={layersOpen} aria-controls="madar-layer-navigation"><Icon name="layers"/></IconButton><NavigationControls showBreadcrumbs={false} fallbackHref={context.homeHref}/><div className="md-current-route"><span>{currentGroup?.label||context.detail}</span><strong>{current?.label||context.name}</strong></div></div>
        {commandPalette?<button type="button" className="md-global-search" onClick={()=>setPaletteOpen(true)} aria-label={`البحث داخل ${context.name}`}><Icon name="search" className="h-4 w-4"/><span>بحث داخل {context.name}</span><kbd>⌘ K</kbd></button>:<Link href="/search" className="md-global-search" aria-label="البحث في متجر مَدار"><Icon name="search" className="h-4 w-4"/><span>بحث في مَدار</span></Link>}
        <GlobalUserActions displayName={identity.displayName} hasAvatar={identity.hasAvatar} isAdmin={identity.isAdmin} unread={identity.unread} notifications={identity.notifications} orbyHref={orbyHref}/>
      </header>
      {alert}
      <div id="main-content" tabIndex={-1} className={cx("md-ux-content",moduleContext&&!hasNativeHeader&&"md-adaptive-module-surface")}>{moduleContext&&!hasNativeHeader&&current&&currentGroup?<ShellModuleContext groupLabel={currentGroup.label} current={current} siblings={currentGroup.items} currentHref={current.href}/>:null}{children}</div>
    </div>

    <nav className="md-mobile-bottom-nav md-no-print" data-madar-guide-occluder="bottom" aria-label={`التنقل السريع في ${context.name}`}>{mobileItems.slice(0,4).map((item)=><Link key={item.href} href={item.href} aria-current={isActive(item.href)?"page":undefined} className={cx(isActive(item.href)&&"is-active",item.orby&&"is-orby")}>{item.orby?<Image src={siteConfig.assets.orby} alt="" width={34} height={34} unoptimized/>:<Icon name={item.icon} className="h-5 w-5"/>}<span>{item.label.replace(" والتقارير","")}</span></Link>)}<button type="button" onClick={()=>setLayersOpen(true)} aria-expanded={layersOpen} aria-controls="madar-layer-navigation"><Icon name="layers" className="h-5 w-5"/><span>المزيد</span></button></nav>

    <Sheet open={layersOpen} onClose={closeLayers} title="طبقات مَدار" description={`${context.name} · ${current?.label||context.detail}`}><div id="madar-layer-navigation"><MadarLayerNavigation authenticated context={context} contextGroups={navigationGroups} onNavigate={closeLayers}/></div></Sheet>
    {commandPalette?<WorkspaceCommandPalette groups={navigationGroups} open={paletteOpen} onOpenChange={setPaletteOpen}/>:null}
  </div>;
}
