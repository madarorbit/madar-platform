'use client';

import Image from 'next/image';
import Link from 'next/link';
import {useCallback,useState,type ReactNode} from 'react';
import {ButtonLink,IconButton,IconLink,StatusBadge} from '@/components/ui/Enterprise';
import {Menu,Sheet} from '@/components/ui/EnterpriseClient';
import {Icon} from '@/components/ui/Icons';

export default function OrbyShell({children,sidebar,plus,newChatHref,authenticated,contextLabel,returnHref}:{children:ReactNode;sidebar?:ReactNode;plus:boolean;newChatHref:string;authenticated:boolean;contextLabel:string;returnHref:string}){
 const[open,setOpen]=useState(false),closeSidebar=useCallback(()=>setOpen(false),[setOpen]);
 return <main className="md-orby-shell">
  <div className="md-orby-layout">
   <header className="md-orby-header">
    <div className="md-orby-header-main">
     <IconLink href={returnHref} label="العودة إلى مَدار"><Icon name="back" className="md-icon-directional"/></IconLink>
     {authenticated&&sidebar?<IconButton label="فتح قائمة ORBY" className="md-orby-mobile-sidebar-button" onClick={()=>setOpen(true)} aria-expanded={open}><Icon name="menu"/></IconButton>:null}
     <Image src="/brand/orby-assistant.svg" width={36} height={36} alt="ORBY" className="md-orby-header-avatar"/>
     <div className="md-orby-header-copy"><div><strong>ORBY</strong>{plus?<StatusBadge status="approved">Plus</StatusBadge>:null}</div><span>{contextLabel}</span></div>
    </div>
    <div className="md-orby-header-actions">
     <ButtonLink href={newChatHref} variant="secondary" size="sm"><Icon name="plus"/><span className="hidden sm:inline">محادثة جديدة</span></ButtonLink>
     <Menu label="خيارات ORBY" trigger={<span className="md-icon-button"><Icon name="more"/></span>}>
      <Link href="/orby/plus"><Icon name="sparkles"/>ORBY Plus</Link>
      {authenticated?<><Link href="/account/privacy"><Icon name="shield"/>الخصوصية والبيانات</Link><Link href="/account"><Icon name="user"/>حساب مَدار</Link></>:<Link href="/login?next=/orby"><Icon name="user"/>تسجيل الدخول</Link>}
     </Menu>
    </div>
   </header>
   <div className={authenticated&&sidebar?'md-orby-frame has-sidebar':'md-orby-frame'}>
    {authenticated&&sidebar?<aside className="md-orby-desktop-sidebar">{sidebar}</aside>:null}
    <section className="md-orby-content">{children}</section>
   </div>
  </div>
  {authenticated&&sidebar?<Sheet open={open} onClose={closeSidebar} title="ORBY" description={contextLabel}>{sidebar}</Sheet>:null}
 </main>;
}
