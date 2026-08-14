'use client';

import Link from 'next/link';
import {useEffect,useId} from 'react';
import {Icon} from '@/components/ui/Icons';

export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 const localId=useId().replace(/:/g,'');
 const errorId=error.digest||`ui-${localId}`;
 useEffect(()=>{console.error('MADAR route boundary',{errorId,name:error.name,message:error.message});},[error,errorId]);
 return <main className="md-page-container grid min-h-[70vh] place-items-center py-12"><section className="md-panel w-full max-w-xl text-center" role="alert" aria-labelledby="global-error-title"><span className="md-error-state-icon" aria-hidden="true"><Icon name="warning"/></span><h1 id="global-error-title" className="md-type-h1 mt-5">تعذّر عرض الصفحة</h1><p className="md-type-body md-muted mx-auto mt-3 max-w-lg">لم تتغير بياناتك. أعد المحاولة، ارجع للصفحة السابقة، أو انتقل إلى الرئيسية.</p><p className="md-help mt-3">معرّف الخطأ: <span className="md-ltr-data">{errorId}</span></p><div className="md-cluster mt-6 justify-center"><button type="button" onClick={reset} className="md-button md-button-primary">إعادة المحاولة</button><button type="button" onClick={()=>history.back()} className="md-button md-button-secondary">رجوع</button><Link href="/" className="md-button md-button-secondary">الرئيسية</Link></div></section></main>;
}