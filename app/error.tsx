'use client';

import Link from 'next/link';
import {useEffect,useId} from 'react';

export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 const localId=useId().replace(/:/g,'');
 const errorId=error.digest||`ui-${localId}`;
 useEffect(()=>{console.error('MADAR route boundary',{errorId,name:error.name,message:error.message});},[error,errorId]);
 return <main className="grid min-h-[70vh] place-items-center px-4 py-12"><section className="w-full max-w-xl rounded-3xl border border-rose-300/15 bg-white/[.025] p-7 text-center shadow-2xl"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-300/10 text-2xl text-rose-200">!</div><h1 className="mt-5 text-3xl font-black">تعذّر عرض الصفحة</h1><p className="mt-3 leading-7 text-slate-400">لم تتغير بياناتك. يمكنك إعادة المحاولة، الرجوع للخلف، أو العودة إلى الرئيسية.</p><p className="mt-3 text-[11px] text-slate-600">Error ID: <span dir="ltr">{errorId}</span></p><div className="mt-6 flex flex-wrap justify-center gap-2"><button type="button" onClick={reset} className="md-button md-button-primary">إعادة المحاولة</button><button type="button" onClick={()=>history.back()} className="md-button md-button-secondary">رجوع</button><Link href="/" className="md-button md-button-secondary">الرئيسية</Link></div></section></main>;
}
