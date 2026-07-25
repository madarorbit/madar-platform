'use client';

import {FormEvent,useState} from 'react';

const whatsappNumber='967735509366';

export default function ContactForm(){
 const[error,setError]=useState('');
 const submit=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();
  const form=new FormData(event.currentTarget),name=String(form.get('name')||'').trim(),email=String(form.get('email')||'').trim(),message=String(form.get('message')||'').trim();
  if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||message.length<10){setError('أكمل الاسم والبريد واكتب رسالة من عشرة أحرف على الأقل.');return;}
  setError('');
  const text=`طلب تواصل عبر موقع مَدار | ORBIT\n\nالاسم: ${name}\nالبريد: ${email}\n\nالرسالة:\n${message}`;
  window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');
 };
 return <form onSubmit={submit} className="space-y-4 rounded-3xl border border-white/10 bg-white/[.04] p-6"><label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">الاسم</span><input required name="name" autoComplete="name" className="w-full rounded-xl p-3 text-slate-900" placeholder="الاسم الكامل"/></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">البريد الإلكتروني</span><input required name="email" type="email" autoComplete="email" className="w-full rounded-xl p-3 text-slate-900" placeholder="name@example.com"/></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">الرسالة</span><textarea required minLength={10} name="message" className="min-h-36 w-full rounded-xl p-3 text-slate-900" placeholder="اكتب تفاصيل طلبك أو استفسارك"/></label>{error&&<p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<button type="submit" className="rounded-xl bg-white px-6 py-3 font-bold text-[#111827]">إرسال الطلب عبر واتساب</button></form>;
}
