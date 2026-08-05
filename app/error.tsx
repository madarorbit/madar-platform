"use client";
import Link from "next/link";
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="md-route-error"><section><h1>تعذّر عرض الصفحة</h1><p>لم تتغير بياناتك. أعد المحاولة أو ارجع إلى الصفحة الرئيسية.</p><div><button type="button" onClick={reset} className="md-button md-button-primary">إعادة المحاولة</button><Link href="/" className="md-button md-button-secondary">الرئيسية</Link></div></section></main>}
