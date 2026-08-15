'use client';

import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Button,IconButton,cx} from '@/components/ui/Enterprise';
import {Icon,type IconName} from '@/components/ui/Icons';

const focusableSelector='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Menu({label,trigger,children,className=''}:{label:string;trigger:ReactNode;children:ReactNode;className?:string}){
 const[open,setOpen]=useState(false),rootRef=useRef<HTMLDivElement>(null),buttonRef=useRef<HTMLButtonElement>(null),panelRef=useRef<HTMLDivElement>(null),panelId=useId();
 const focusPanel=(edge:'first'|'last'='first')=>requestAnimationFrame(()=>{const elements=Array.from(panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector)||[]);const target=edge==='last'?elements.at(-1):elements[0];target?.focus();});
 useEffect(()=>{
  if(!open)return;
  const closeOutside=(event:PointerEvent)=>{if(!rootRef.current?.contains(event.target as Node))setOpen(false)};
  const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);buttonRef.current?.focus()}};
  document.addEventListener('pointerdown',closeOutside);
  document.addEventListener('keydown',keyboard);
  return()=>{document.removeEventListener('pointerdown',closeOutside);document.removeEventListener('keydown',keyboard)};
 },[open]);
 return <div ref={rootRef} className={cx('md-menu-root',className)}><button ref={buttonRef} type="button" className="md-menu-trigger" aria-label={label} aria-haspopup="true" aria-expanded={open} aria-controls={panelId} onClick={()=>setOpen(value=>!value)} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!open)setOpen(true);focusPanel(event.key==='ArrowUp'?'last':'first')}}}>{trigger}</button>{open?<div ref={panelRef} id={panelId} className="md-menu-panel" aria-label={label} onClick={event=>{if((event.target as HTMLElement).closest('a,button'))setOpen(false)}}>{children}</div>:null}</div>;
}

export function Sheet({open,title,description,children,onClose}:{open:boolean;title:string;description?:string;children:ReactNode;onClose:()=>void}){
 const titleId=useId(),descriptionId=useId(),panelRef=useRef<HTMLElement>(null),returnFocusRef=useRef<HTMLElement|null>(null),[mounted,setMounted]=useState(false);
 useEffect(()=>setMounted(true),[]);
 useEffect(()=>{
  if(!open)return;
  returnFocusRef.current=document.activeElement as HTMLElement|null;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const panel=panelRef.current;
  const frame=requestAnimationFrame(()=>{const first=panel?.querySelector(focusableSelector) as HTMLElement|null;if(first)first.focus();else panel?.focus()});
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();onClose();return}
   if(event.key!=='Tab'||!panel)return;
   const elements=Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
   if(!elements.length){event.preventDefault();return}
   const first=elements[0],last=elements[elements.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  };
  document.addEventListener('keydown',keyboard);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',keyboard);document.body.style.overflow=previousOverflow;returnFocusRef.current?.focus()};
 },[open,onClose]);
 if(!open||!mounted)return null;
 return createPortal(<><button type="button" className="md-sheet-backdrop" aria-label="إغلاق اللوحة" onClick={onClose}/><aside ref={panelRef} className="md-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description?descriptionId:undefined} tabIndex={-1}><header className="md-sheet-header"><div><h2 id={titleId} className="md-type-h3">{title}</h2>{description?<p id={descriptionId} className="md-type-caption md-muted">{description}</p>:null}</div><IconButton label="إغلاق" onClick={onClose}><Icon name="close"/></IconButton></header><div className="md-sheet-body">{children}</div></aside></>,document.body);
}

export function Modal({open,title,description,children,onClose,footer}:{open:boolean;title:string;description?:string;children:ReactNode;onClose:()=>void;footer?:ReactNode}){
 const titleId=useId(),descriptionId=useId(),dialogRef=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;if(open&&!dialog.open)dialog.showModal();if(!open&&dialog.open)dialog.close()},[open]);
 return <dialog ref={dialogRef} onCancel={event=>{event.preventDefault();onClose()}} onClose={onClose} aria-labelledby={titleId} aria-describedby={description?descriptionId:undefined} className="md-dialog"><header className="md-dialog-header"><div><h2 id={titleId} className="md-type-h2">{title}</h2>{description?<p id={descriptionId} className="md-type-body-sm md-muted mt-2">{description}</p>:null}</div><IconButton label="إغلاق النافذة" onClick={onClose}><Icon name="close"/></IconButton></header><div className="md-dialog-body">{children}</div>{footer?<footer className="md-dialog-footer">{footer}</footer>:null}</dialog>;
}

const toastStyles={default:'md-notice-info',success:'md-notice-success',warning:'md-notice-warning',danger:'md-notice-danger'} as const;
const toastIcons:Record<keyof typeof toastStyles,IconName>={default:'info',success:'check',warning:'warning',danger:'warning'};
export function Toast({title,message,variant='default',icon,duration=5000,onClose}:{title:string;message?:string;variant?:keyof typeof toastStyles;icon?:IconName;duration?:number;onClose?:()=>void}){
 const[visible,setVisible]=useState(true);
 useEffect(()=>{if(duration<=0)return;const timer=setTimeout(()=>{setVisible(false);onClose?.()},duration);return()=>clearTimeout(timer)},[duration,onClose]);
 if(!visible)return null;
 return <div role={variant==='danger'?'alert':'status'} aria-live={variant==='danger'?'assertive':'polite'} className={cx('md-notice md-toast',toastStyles[variant])}><span className="md-notice-icon"><Icon name={icon||toastIcons[variant]}/></span><div className="min-w-0 flex-1"><strong className="block">{title}</strong>{message?<p className="md-help mt-1">{message}</p>:null}</div><IconButton label="إغلاق الإشعار" onClick={()=>{setVisible(false);onClose?.()}}><Icon name="close" className="h-4 w-4"/></IconButton></div>;
}

export function ConfirmDialog({open,title,description,confirmLabel='تأكيد',danger=false,busy=false,onConfirm,onClose}:{open:boolean;title:string;description:string;confirmLabel?:string;danger?:boolean;busy?:boolean;onConfirm:()=>void|Promise<void>;onClose:()=>void}){const confirm=async()=>{try{await onConfirm();onClose();}catch{}};return <Modal open={open} title={title} description={description} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>إلغاء</Button><Button variant={danger?'danger':'primary'} loading={busy} onClick={()=>void confirm()}>{confirmLabel}</Button></>}>{danger?<div className="md-notice md-notice-danger"><Icon name="warning"/><p className="md-type-body-sm">راجع أثر هذا الإجراء قبل المتابعة؛ قد يتطلب التراجع تدخل الإدارة.</p></div>:null}</Modal>}
