'use client';

import {useEffect,useState} from 'react';

type Theme='light'|'dark';

const STORAGE_KEY='madar-theme';

function readTheme():Theme{
 if(typeof document==='undefined')return 'dark';
 return document.documentElement.dataset.theme==='light'?'light':'dark';
}

function applyTheme(theme:Theme){
 const root=document.documentElement;
 root.dataset.theme=theme;
 root.style.colorScheme=theme;
 const meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
 meta?.setAttribute('content',theme==='light'?'#f5f7fb':'#070a12');
 localStorage.setItem(STORAGE_KEY,theme);
 window.dispatchEvent(new CustomEvent('madar-theme-change',{detail:theme}));
}

export default function ThemeToggle({compact=false}:{compact?:boolean}){
 const[theme,setTheme]=useState<Theme>('dark');

 useEffect(()=>{
  setTheme(readTheme());
  const sync=()=>setTheme(readTheme());
  window.addEventListener('madar-theme-change',sync);
  window.addEventListener('storage',sync);
  return()=>{window.removeEventListener('madar-theme-change',sync);window.removeEventListener('storage',sync)};
 },[]);

 const toggle=()=>{
  const next:Theme=readTheme()==='light'?'dark':'light';
  const root=document.documentElement;
  root.classList.add('md-theme-transitioning');
  applyTheme(next);
  setTheme(next);
  window.setTimeout(()=>root.classList.remove('md-theme-transitioning'),340);
 };

 const isLight=theme==='light';
 const label=isLight?'تفعيل الوضع الداكن':'تفعيل الوضع الفاتح';

 return <button type="button" onClick={toggle} className={`md-theme-toggle${compact?' md-theme-toggle-compact':''}`} aria-label={label} title={label} aria-pressed={!isLight}>
  <span className="md-theme-toggle-track" aria-hidden="true">
   <span className="md-theme-toggle-thumb">
    <svg viewBox="0 0 24 24" className="md-theme-icon md-theme-icon-sun" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
    <svg viewBox="0 0 24 24" className="md-theme-icon md-theme-icon-moon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/></svg>
   </span>
  </span>
  {!compact&&<span className="md-theme-toggle-label">{isLight?'الوضع الفاتح':'الوضع الداكن'}</span>}
 </button>;
}
