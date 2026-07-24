'use client';

import {createContext,useCallback,useContext,useEffect,useMemo,type ReactNode} from 'react';

export type MadarTheme='light'|'dark';

type ThemeContextValue={
 setTheme:(theme:MadarTheme)=>void;
 toggleTheme:()=>void;
};

const STORAGE_KEY='madar-theme';
const TRANSITION_CLASS='md-theme-transition';
const TRANSITION_DURATION=360;
const ThemeContext=createContext<ThemeContextValue|null>(null);

function isTheme(value:string|null|undefined):value is MadarTheme{return value==='light'||value==='dark'}

function systemTheme():MadarTheme{
 return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
}

function savedTheme():MadarTheme|null{
 try{const value=window.localStorage.getItem(STORAGE_KEY);return isTheme(value)?value:null}catch{return null}
}

function currentTheme():MadarTheme{
 const value=document.documentElement.dataset.theme;
 return isTheme(value)?value:(savedTheme()||systemTheme());
}

function updateThemeColor(theme:MadarTheme){
 const color=theme==='dark'?'#070a12':'#f7f8fc';
 document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta=>meta.content=color);
}

function applyTheme(theme:MadarTheme,{animate,persist}:{animate:boolean;persist:boolean}){
 const root=document.documentElement;
 const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(animate&&!reduceMotion){root.classList.add(TRANSITION_CLASS);void root.offsetWidth}
 root.dataset.theme=theme;
 root.style.colorScheme=theme;
 updateThemeColor(theme);
 if(persist){try{window.localStorage.setItem(STORAGE_KEY,theme)}catch{}}
 window.dispatchEvent(new CustomEvent('madar:theme-change',{detail:{theme}}));
 if(animate&&!reduceMotion){window.setTimeout(()=>root.classList.remove(TRANSITION_CLASS),TRANSITION_DURATION)}
}

export default function ThemeProvider({children}:{children:ReactNode}){
 useEffect(()=>{
  applyTheme(currentTheme(),{animate:false,persist:false});
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange=()=>{if(!savedTheme())applyTheme(systemTheme(),{animate:true,persist:false})};
  const onStorage=(event:StorageEvent)=>{if(event.key===STORAGE_KEY&&isTheme(event.newValue))applyTheme(event.newValue,{animate:true,persist:false})};
  media.addEventListener('change',onSystemChange);
  window.addEventListener('storage',onStorage);
  return()=>{media.removeEventListener('change',onSystemChange);window.removeEventListener('storage',onStorage)};
 },[]);
 const setTheme=useCallback((theme:MadarTheme)=>applyTheme(theme,{animate:true,persist:true}),[]);
 const toggleTheme=useCallback(()=>setTheme(currentTheme()==='dark'?'light':'dark'),[setTheme]);
 const value=useMemo(()=>({setTheme,toggleTheme}),[setTheme,toggleTheme]);
 return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(){
 const value=useContext(ThemeContext);
 if(!value)throw new Error('useTheme must be used inside ThemeProvider');
 return value;
}
