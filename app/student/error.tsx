"use client";
import Link from "next/link";
export default function StudentError({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="md-route-error"><section><h1>تعذّر عرض أداة الطالب</h1><p>ملفاتك وملاحظاتك لم تتغير. أعد تحميل الأداة أو ارجع إلى لوحة الطالب.</p><div><button type="button" onClick={reset} className="md-button md-button-primary">إعادة المحاولة</button><Link href="/student" className="md-button md-button-secondary">لوحة الطالب</Link></div></section></main>}
