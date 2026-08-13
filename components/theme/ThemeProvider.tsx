'use client';

import {createContext,useCallback,useContext,useEffect,useMemo,useSyncExternalStore,type ReactNode} from 'react';

export type MadarTheme='light'|'dark'|'system';
type ResolvedTheme='light'|'dark';

type ThemeContextValue={
 preference:MadarTheme;
 resolvedTheme:ResolvedTheme;
 setTheme:(theme:MadarTheme)=>void;
 toggleTheme:()=>void;
};

const STORAGE_KEY='madar-theme';
const TRANSITION_CLASS='md-theme-transition';
const TRANSITION_DURATION=360;
const ThemeContext=createContext<ThemeContextValue|null>(null);

function isTheme(value:string|null|undefined):value is MadarTheme{return value==='light'||value==='dark'||value==='system'}

function systemTheme():ResolvedTheme{
 return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
}

function savedTheme():MadarTheme{
 try{const value=window.localStorage.getItem(STORAGE_KEY);return isTheme(value)?value:'system'}catch{return'system'}
}

function resolvedTheme(preference:MadarTheme):ResolvedTheme{
 return preference==='system'?systemTheme():preference;
}

function updateThemeColor(theme:ResolvedTheme){
 const color=theme==='dark'?'#070a12':'#f7f8fc';
 document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta=>meta.content=color);
}

function applyTheme(preference:MadarTheme,{animate,persist}:{animate:boolean;persist:boolean}){
 const root=document.documentElement;
 const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(animate&&!reduceMotion){root.classList.add(TRANSITION_CLASS);void root.offsetWidth}
 const theme=resolvedTheme(preference);
 root.dataset.theme=theme;
 root.dataset.themePreference=preference;
 root.style.colorScheme=theme;
 updateThemeColor(theme);
 if(persist){try{window.localStorage.setItem(STORAGE_KEY,preference)}catch{}}
 window.dispatchEvent(new CustomEvent('madar:theme-change',{detail:{preference,theme}}));
 if(animate&&!reduceMotion){window.setTimeout(()=>root.classList.remove(TRANSITION_CLASS),TRANSITION_DURATION)}
 return theme;
}

function subscribeTheme(onStoreChange:()=>void){
 window.addEventListener('madar:theme-change',onStoreChange);
 return()=>window.removeEventListener('madar:theme-change',onStoreChange);
}

function themeSnapshot(){
 const preference=isTheme(document.documentElement.dataset.themePreference)?document.documentElement.dataset.themePreference:savedTheme();
 const theme=document.documentElement.dataset.theme==='light'?'light':'dark';
 return `${preference}|${theme}`;
}

export default function ThemeProvider({children}:{children:ReactNode}){
 const snapshot=useSyncExternalStore(subscribeTheme,themeSnapshot,()=> 'system|dark');
 const[preferenceValue,resolvedValue]=snapshot.split('|');
 const preference=isTheme(preferenceValue)?preferenceValue:'system';
 const resolved:ResolvedTheme=resolvedValue==='light'?'light':'dark';
 useEffect(()=>{
  applyTheme(savedTheme(),{animate:false,persist:false});
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange=()=>{if(savedTheme()==='system')applyTheme('system',{animate:true,persist:false})};
  const onStorage=(event:StorageEvent)=>{if(event.key!==STORAGE_KEY)return;const next=isTheme(event.newValue)?event.newValue:'system';applyTheme(next,{animate:true,persist:false})};
  media.addEventListener('change',onSystemChange);
  window.addEventListener('storage',onStorage);
 return()=>{media.removeEventListener('change',onSystemChange);window.removeEventListener('storage',onStorage)};
 },[]);
 const setTheme=useCallback((theme:MadarTheme)=>{applyTheme(theme,{animate:true,persist:true})},[]);
 const toggleTheme=useCallback(()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'),[setTheme]);
 const value=useMemo(()=>({preference,resolvedTheme:resolved,setTheme,toggleTheme}),[preference,resolved,setTheme,toggleTheme]);
 return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(){
 const value=useContext(ThemeContext);
 if(!value)throw new Error('useTheme must be used inside ThemeProvider');
 return value;
}
