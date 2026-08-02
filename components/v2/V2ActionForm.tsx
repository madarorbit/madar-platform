'use client';

import type{ReactNode}from'react';
import{useActionState}from'react';
import type{V2ActionState}from'@/app/actions/v2-operations';
import{Button,Notice}from'@/components/ui/Enterprise';

export default function V2ActionForm({action,title,description,submitLabel,children,className=''}:{action:(previous:V2ActionState,formData:FormData)=>Promise<V2ActionState>;title:string;description?:string;submitLabel:string;children:ReactNode;className?:string}){
 const[state,formAction,pending]=useActionState(action,{});
 return <form action={formAction} className={`md-panel grid gap-4 ${className}`}><div><h3 className="text-lg font-black">{title}</h3>{description&&<p className="mt-2 text-sm leading-7 text-slate-400">{description}</p>}</div>{children}{state.error&&<Notice title="تعذر التنفيذ" variant="danger">{state.error}</Notice>}{state.success&&<Notice title="تمت العملية" variant="success"><p>{state.success}</p>{state.endpoint&&<p className="mt-2 break-all font-mono text-xs">{state.endpoint}</p>}{state.secret&&<p className="mt-2 break-all rounded-lg bg-black/30 p-3 font-mono text-xs" dir="ltr">{state.secret}</p>}</Notice>}<Button disabled={pending} type="submit">{pending?'جارٍ التنفيذ…':submitLabel}</Button></form>;
}
