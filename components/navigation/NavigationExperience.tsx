'use client';

import {usePathname} from 'next/navigation';
import {useEffect,useRef} from 'react';

const internalPath=/^\/(account|dashboard|admin|workspace|student|onboarding|workspace-payment|retail\/(onboarding|workspace))(\/|$)/;
const storageKey=(path:string)=>`madar-scroll:${path}`;

export default function NavigationExperience(){
 const pathname=usePathname()||'/';
 const historyNavigation=useRef(false);
 useEffect(()=>{
  const root=document.documentElement;
  const save=()=>{try{sessionStorage.setItem(storageKey(location.pathname+location.search),String(scrollY))}catch{}};
  const click=(event:MouseEvent)=>{
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const target=event.target as Element|null,anchor=target?.closest('a[href]') as HTMLAnchorElement|null;
   if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
   const url=new URL(anchor.href,location.href);
   if(url.origin!==location.origin||url.pathname===location.pathname&&url.search===location.search)return;
   save();root.classList.add('md-route-pending');
  };
  const pop=()=>{historyNavigation.current=true;save();root.classList.add('md-route-pending')};
  addEventListener('pagehide',save);addEventListener('beforeunload',save);addEventListener('popstate',pop);document.addEventListener('click',click,true);
  return()=>{removeEventListener('pagehide',save);removeEventListener('beforeunload',save);removeEventListener('popstate',pop);document.removeEventListener('click',click,true)};
 },[]);
 useEffect(()=>{
  const root=document.documentElement;
  const fullPath=location.pathname+location.search;
  if(internalPath.test(pathname)){
   try{localStorage.setItem('madar-last-path',fullPath)}catch{}
   document.cookie=`madar-last-path=${encodeURIComponent(fullPath)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
  }
  if(historyNavigation.current){
   historyNavigation.current=false;
   const value=sessionStorage.getItem(storageKey(fullPath));
   if(value!==null)requestAnimationFrame(()=>requestAnimationFrame(()=>scrollTo({top:Number(value)||0,behavior:'auto'})));
  }
  requestAnimationFrame(()=>root.classList.remove('md-route-pending'));
 },[pathname]);
 return <div className="md-route-progress md-no-print" aria-hidden="true"><span/></div>;
}
