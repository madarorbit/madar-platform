import type { IconName } from "@/components/ui/Icons";

export const serviceCodes = ["CONNECT_EXISTING","BUILD_ON_MADAR","MADAR_RETAIL"] as const;
export type ServiceCode = (typeof serviceCodes)[number];
export type ServiceState = "NOT_SUBSCRIBED"|"SETUP_REQUIRED"|"PENDING_APPROVAL"|"ACTIVE"|"EXPIRED"|"SUSPENDED"|"REJECTED";
export type ServiceDefinition = {code:ServiceCode;name:string;shortName:string;description:string;detail:string;icon:IconName;coverImage:string;openHref:string;runtimeHref:string;accent:"mint"|"violet"|"mixed";};

export const services: readonly ServiceDefinition[] = [
 {code:"CONNECT_EXISTING",name:"ربط تجارة قائمة بمَدار",shortName:"ربط تجارة قائمة",description:"اربط نظامك الحالي بمحرك الموصلات والتحليلات في مَدار.",detail:"يبقى نظامك القائم مصدر الحقيقة، وتعمل طبقات الربط وفق الصلاحيات التي تعتمدها.",icon:"automation",coverImage:"/assets/services/connected-business-master.webp",openHref:"/account/services/CONNECT_EXISTING/open",runtimeHref:"/workspace/connect",accent:"mint"},
 {code:"BUILD_ON_MADAR",name:"بناء تجارة جديدة على مَدار",shortName:"بناء تجارة جديدة",description:"ابدأ تجارة جديدة باستخدام المساحات والقطاعات الموجودة في مَدار.",detail:"يبدأ إعداد القطاع والمساحة بعد اعتماد الخدمة، وليس أثناء إنشاء الحساب.",icon:"layers",coverImage:"/assets/services/native-business-master.webp",openHref:"/account/services/BUILD_ON_MADAR/open",runtimeHref:"/workspace",accent:"violet"},
 {code:"MADAR_RETAIL",name:"MADAR Retail",shortName:"مَدار للتجزئة",description:"تشغيل خفيف وآمن للمبيعات والمخزون والصندوق والديون.",detail:"بيانات Retail معزولة حسب مساحة التجارة، مع دخول موحّد وتحليلات وORBY ضمن صلاحيات حساب مَدار.",icon:"store",coverImage:"/assets/services/madar-retail-master.webp",openHref:"/account/services/MADAR_RETAIL/open",runtimeHref:"/retail/workspace",accent:"mixed"},
] as const;

export const serviceStateLabels: Record<ServiceState,string>={NOT_SUBSCRIBED:"غير مفعّلة",SETUP_REQUIRED:"بانتظار الدفع",PENDING_APPROVAL:"قيد المراجعة",ACTIVE:"فعّالة",EXPIRED:"منتهية",SUSPENDED:"موقوفة",REJECTED:"مرفوضة"};
export const serviceStateCtas: Record<ServiceState,string>={NOT_SUBSCRIBED:"بدء التفعيل",SETUP_REQUIRED:"إكمال الدفع",PENDING_APPROVAL:"عرض حالة الطلب",ACTIVE:"فتح الخدمة",EXPIRED:"تجديد الاشتراك",SUSPENDED:"مراجعة الحالة",REJECTED:"إعادة تقديم الطلب"};
export function isServiceCode(value:string):value is ServiceCode{return serviceCodes.includes(value as ServiceCode);}
export function serviceDefinition(code:ServiceCode){return services.find(service=>service.code===code) as ServiceDefinition;}
