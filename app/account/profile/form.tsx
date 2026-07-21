'use client';
import { useActionState } from 'react';
import { updateProfile } from '@/app/actions/auth';

export default function ProfileForm({fullName,phone}:{fullName:string;phone:string}) {
 const [state,action,pending]=useActionState<{success?:string;error?:string},FormData>(updateProfile,{});
 return <form action={action} className="space-y-4">
  <h1 className="text-3xl font-bold">الملف الشخصي</h1>
  <label className="block">الاسم الكامل<input required minLength={2} name="full_name" defaultValue={fullName} className="mt-1 w-full rounded-xl p-3 text-slate-900"/></label>
  <label className="block">رقم الهاتف<input name="phone" defaultValue={phone} className="mt-1 w-full rounded-xl p-3 text-slate-900"/></label>
  <button disabled={pending} className="rounded-xl bg-[#00C292] px-5 py-3 font-bold text-black">{pending?'جارٍ الحفظ…':'حفظ'}</button>
  {state.error&&<p role="alert" className="text-red-300">{state.error}</p>}
  {state.success&&<p className="text-emerald-300">{state.success}</p>}
 </form>;
}
