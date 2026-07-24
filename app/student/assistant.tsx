'use client';

import Image from 'next/image';
import {useState} from 'react';
import {Button,Field,Notice,Select,Textarea} from '@/components/ui/Enterprise';
import {siteConfig} from '@/src/config/site';

export default function StudentAssistant({organizationId}:{organizationId:string}){
 const[mode,setMode]=useState('PLAN'),[prompt,setPrompt]=useState(''),[answer,setAnswer]=useState(''),[error,setError]=useState(''),[pending,setPending]=useState(false);
 async function submit(event:React.FormEvent){event.preventDefault();setPending(true);setError('');setAnswer('');try{const response=await fetch('/api/student/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId,mode,prompt})});const data=await response.json();if(!response.ok)throw new Error(data.error);setAnswer(data.text)}catch(cause){setError(cause instanceof Error?cause.message:'تعذر تشغيل أوربي.')}finally{setPending(false)}}
 return <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><form onSubmit={submit} className="grid gap-3"><div className="mb-2 flex items-center gap-3"><Image src={siteConfig.assets.orby} alt="صورة أوربي" width={52} height={52} unoptimized className="h-13 w-13 rounded-2xl object-cover"/><div><strong className="block">أوربي</strong><span className="text-sm text-slate-400">مساعدك الدراسي داخل مَدار</span></div></div><Field label="نوع المساعدة"><Select value={mode} onChange={event=>setMode(event.target.value)}><option value="PLAN">خطة مذاكرة ذكية</option><option value="SUMMARY">تلخيص أكاديمي</option><option value="QUIZ">أسئلة مراجعة</option><option value="EXPLAIN">شرح مفهوم</option></Select></Field><Field label="المحتوى أو المطلوب" help="لا تضع معلومات شخصية حساسة. لا تُرسل ملفاتك تلقائيًا؛ أنت تختار النص الذي تريد تحليله."><Textarea value={prompt} onChange={event=>setPrompt(event.target.value)} required minLength={10} maxLength={12000} rows={8} placeholder="ألصق النص أو اكتب المواد والمهام والوقت المتاح…"/></Field><Button disabled={pending}>{pending?'يعمل أوربي الآن…':'إنشاء النتيجة'}</Button>{error&&<Notice title="تعذر تشغيل أوربي" variant="danger">{error}</Notice>}</form><article aria-live="polite" className="md-card min-h-72 whitespace-pre-wrap border-violet-300/20 bg-slate-950/60 p-5 leading-8 text-slate-100">{answer||<span className="text-slate-500">ستظهر الخطة أو الملخص أو أسئلة المراجعة هنا.</span>}</article></div>
}
