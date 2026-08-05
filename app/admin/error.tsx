"use client";
import Link from "next/link";
export default function AdminError({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="md-route-error"><section><h1>تعذّر عرض مركز الإدارة</h1><p>لم يُنفّذ أي إجراء إداري بسبب هذا الخطأ. أعد المحاولة أو افتح صفحة صحة المنصة.</p><div><button type="button" onClick={reset} className="md-button md-button-primary">إعادة المحاولة</button><Link href="/admin/system-health" className="md-button md-button-secondary">صحة المنصة</Link></div></section></main>}
