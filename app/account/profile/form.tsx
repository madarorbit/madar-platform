'use client';
import { useActionState } from 'react';
import Image from 'next/image';
import { updateProfile } from '@/app/actions/auth';

export default function ProfileForm({fullName,phone,hasAvatar}:{fullName:string;phone:string;hasAvatar:boolean}) {
 const [state,action,pending]=useActionState<{success?:string;error?:string},FormData>(updateProfile,{});
 return <form action={action} encType="multipart/form-data" className="space-y-5 rounded-3xl border border-white/10 bg-white/[.04] p-6">
  <h1 className="text-3xl font-bold">الملف الشخصي</h1>
  <div className="flex items-center gap-4">{hasAvatar?<Image src="/account/avatar" alt="صورة حسابك" width={80} height={80} unoptimized className="h-20 w-20 rounded-full border-2 border-[#70E4D4] object-cover"/>:<div className="grid h-20 w-20 place-items-center rounded-full bg-white/10 text-3xl">👤</div>}<div><strong>صورة الحساب</strong><p className="text-sm text-slate-400">JPEG أو PNG أو WebP — حتى 5MB</p></div></div>
  <label className="block">تغيير صورة الحساب<input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full rounded-xl border border-white/10 p-3 text-white"/></label>
  <label className="block">الاسم الكامل<input required minLength={2} name="full_name" defaultValue={fullName} className="field mt-1 w-full rounded-xl p-3"/></label>
  <label className="block">رقم الهاتف<input name="phone" defaultValue={phone} className="field mt-1 w-full rounded-xl p-3"/></label>
  <button disabled={pending} className="rounded-xl bg-[#00C292] px-5 py-3 font-bold text-black">{pending?'جارٍ الحفظ…':'حفظ'}</button>
  {state.error&&<p role="alert" className="text-red-300">{state.error}</p>}
  {state.success&&<p className="text-emerald-300">{state.success}</p>}
 </form>;
}
