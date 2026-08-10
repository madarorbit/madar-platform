import type {SourceOfTruth,VerticalExtension} from '@/types';

export function money(value:number,currency:string){
 try{return new Intl.NumberFormat('ar-SA',{style:'currency',currency,maximumFractionDigits:0}).format(value);}
 catch{return `${Math.round(value).toLocaleString('ar-SA')} ${currency}`;}
}

export function dateTime(value:string|null|undefined){
 if(!value)return 'غير متاح';
 try{return new Date(value).toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'});}catch{return value;}
}

export function shortDate(value:string|null|undefined){
 if(!value)return 'غير محدد';
 try{return new Date(value).toLocaleDateString('ar-SA',{month:'short',day:'numeric'});}catch{return value;}
}

export function freshness(value:string|null|undefined){
 if(!value)return 'لم تتم مزامنة ناجحة بعد';
 const diff=Math.max(0,Date.now()-Date.parse(value)),minutes=Math.floor(diff/60_000);
 if(minutes<1)return 'الآن';
 if(minutes<60)return `منذ ${minutes.toLocaleString('ar-SA')} د`;
 const hours=Math.floor(minutes/60);if(hours<24)return `منذ ${hours.toLocaleString('ar-SA')} س`;
 return `منذ ${Math.floor(hours/24).toLocaleString('ar-SA')} ي`;
}

export const sourceLabel=(source:SourceOfTruth)=>source==='EXTERNAL'?'نظام العميل':'مَدار';
export const verticalLabel=(vertical:VerticalExtension)=>vertical==='food_service'?'المطعم':vertical==='hospitality'?'الفندق':'التجارة';

export const statusLabel=(status:string)=>({
 todo:'قيد الانتظار',in_progress:'قيد التنفيذ',done:'مكتملة',cancelled:'ملغاة',NEW:'جديدة',PREPARING:'قيد التحضير',READY:'جاهزة',SERVED:'تم التقديم',CANCELLED:'ملغاة',PENDING:'معلّقة',ASSIGNED:'مسندة',IN_PROGRESS:'قيد التنفيذ',INSPECTION:'بانتظار الفحص',COMPLETED:'مكتملة',BLOCKED:'متوقفة',PREVIEWED:'بانتظار التأكيد',QUEUED:'في صف التنفيذ',EXECUTED:'نُفذت',REJECTED:'مرفوضة',EXPIRED:'انتهت المعاينة',CONFLICT:'تعارض',FAILED:'فشلت',SUCCEEDED:'نُفذت وتحققت',EXECUTING:'قيد التنفيذ',VERIFYING:'قيد التحقق',CONFIRMED:'مؤكدة',
} as Record<string,string>)[status]||status;

export const planLabel=(level:string)=>level==='FULL'?'الكامل':level==='PREMIUM'?'المميز':'العادي';
