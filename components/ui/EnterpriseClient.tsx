'use client';

import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Button,cx} from '@/components/ui/Enterprise';
import {Icon,type IconName} from '@/components/ui/Icons';

export function Modal({open,title,description,children,onClose,footer}:{open:boolean;title:string;description?:string;children:ReactNode;onClose:()=>void;footer?:ReactNode}){
 const dialogRef=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;if(open&&!dialog.open)dialog.showModal();if(!open&&dialog.open)dialog.close()},[open]);
 return <dialog ref={dialogRef} onCancel={event=>{event.preventDefault();onClose()}} onClose={onClose} className="m-auto w-[min(100%-1.25rem,42rem)] rounded-3xl border border-white/10 bg-[#101625] p-0 text-white shadow-2xl backdrop:bg-black/70"><div className="border-b border-white/10 p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-black">{title}</h2>{description&&<p className="mt-2 leading-7 text-slate-400">{description}</p>}</div><button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-slate-300" aria-label="إغلاق النافذة">×</button></div></div><div className="max-h-[65vh] overflow-y-auto p-5 sm:p-6">{children}</div>{footer&&<div className="flex flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:justify-end sm:p-6">{footer}</div>}</dialog>;
}

const toastStyles={default:'',success:'md-notice-success',warning:'md-notice-warning',danger:'md-notice-danger'} as const;
export function Toast({title,message,variant='default',icon='help',duration=5000,onClose}:{title:string;message?:string;variant?:keyof typeof toastStyles;icon?:IconName;duration?:number;onClose?:()=>void}){
 const[visible,setVisible]=useState(true);
 useEffect(()=>{if(duration<=0)return;const timer=setTimeout(()=>{setVisible(false);onClose?.()},duration);return()=>clearTimeout(timer)},[duration,onClose]);
 if(!visible)return null;
 return <div role={variant==='danger'?'alert':'status'} aria-live={variant==='danger'?'assertive':'polite'} className={cx('md-notice fixed bottom-5 left-5 z-[70] w-[min(calc(100%-2.5rem),24rem)] shadow-2xl',toastStyles[variant])}><span className="mt-0.5 text-emerald-300"><Icon name={icon}/></span><div className="min-w-0 flex-1"><strong className="block">{title}</strong>{message&&<p className="mt-1 text-sm leading-6 text-slate-300">{message}</p>}</div><button type="button" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/5" aria-label="إغلاق الإشعار" onClick={()=>{setVisible(false);onClose?.()}}>×</button></div>;
}

export function ConfirmDialog({open,title,description,confirmLabel='تأكيد',danger=false,onConfirm,onClose}:{open:boolean;title:string;description:string;confirmLabel?:string;danger?:boolean;onConfirm:()=>void;onClose:()=>void}){return <Modal open={open} title={title} description={description} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button variant={danger?'danger':'primary'} onClick={()=>{onConfirm();onClose()}}>{confirmLabel}</Button></>}>{danger&&<div className="md-notice md-notice-danger"><Icon name="shield"/><p className="text-sm leading-7">راجع أثر هذا الإجراء قبل المتابعة؛ قد يتطلب التراجع تدخل الإدارة.</p></div>}</Modal>}
