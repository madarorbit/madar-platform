import {createHash,randomUUID} from 'node:crypto';
import type {OrbyIdentity,OrbyJsonObject} from '../core/contracts';
import type {OrbyCitation,OrbyDetectorInput,OrbyDetectorKey,OrbyDetectorSignal,OrbyProactiveDetector,OrbySuggestedAction} from './contracts';

export type OrbyMetricSnapshot={
 current:{sales:number;revenue:number;orders:number;customers:number;traffic:number;supportOpen:number;paymentOverdue:number;lowInventory:number;systemErrors:number};
 previous:{sales:number;revenue:number;orders:number;customers:number;traffic:number;supportOpen:number;paymentOverdue:number;lowInventory:number;systemErrors:number};
 sampleSize:number;freshnessSeconds:number;qualityScore:number;dimensions:OrbyJsonObject;evidence:readonly OrbyCitation[];
};
export interface OrbyBusinessMetricReader { read(input:OrbyDetectorInput):Promise<OrbyMetricSnapshot>; }

function ratio(current:number,previous:number){return previous===0?(current===0?0:1):(current-previous)/Math.abs(previous);}
function confidence(snapshot:OrbyMetricSnapshot){const sample=Math.min(1,snapshot.sampleSize/50),freshness=Math.max(0,1-snapshot.freshnessSeconds/(60*60*24*7));return Math.max(.05,Math.min(1,sample*.45+freshness*.25+snapshot.qualityScore*.3));}
function riskScore(change:number,severityWeight=1){return Math.round(Math.min(100,Math.max(0,Math.abs(change)*100*severityWeight)));}
function fingerprint(key:string,input:OrbyDetectorInput,metrics:OrbyJsonObject){return createHash('sha256').update(`${key}:${input.identity.organizationId}:${input.identity.workspaceId||''}:${JSON.stringify(metrics)}`).digest('hex').slice(0,40);}
function action(title:string,description:string,riskLevel:OrbySuggestedAction['riskLevel']='low',toolName?:string,input?:OrbyJsonObject):OrbySuggestedAction{return{id:randomUUID(),title,description,riskLevel,requiresApproval:true,toolName,input};}
function signal(input:OrbyDetectorInput,snapshot:OrbyMetricSnapshot,values:Omit<OrbyDetectorSignal,'organizationId'|'workspaceId'|'fingerprint'|'detectedAt'|'confidence'|'evidence'>):OrbyDetectorSignal{
 return {...values,organizationId:input.identity.organizationId,workspaceId:input.identity.workspaceId,fingerprint:fingerprint(values.detector,input,values.metrics),detectedAt:input.now,confidence:confidence(snapshot),evidence:snapshot.evidence};
}

abstract class MetricDetector implements OrbyProactiveDetector {
 abstract readonly key:OrbyDetectorKey;
 constructor(protected readonly reader:OrbyBusinessMetricReader){}
 protected snapshot(input:OrbyDetectorInput){return this.reader.read(input);}
 abstract detect(input:OrbyDetectorInput):Promise<readonly OrbyDetectorSignal[]>;
}

export class SalesDropDetector extends MetricDetector {
 readonly key='sales_drop' as const;
 async detect(input:OrbyDetectorInput){const s=await this.snapshot(input),change=ratio(s.current.sales,s.previous.sales);if(change>-.12)return [];
  const orderChange=ratio(s.current.orders,s.previous.orders),trafficChange=ratio(s.current.traffic,s.previous.traffic),causes:string[]=[];
  if(trafficChange<-.1)causes.push('انخفاض الزيارات أو الطلب الوارد');if(orderChange<change*.75)causes.push('انخفاض معدل التحويل أو عدد الطلبات');if(s.current.paymentOverdue>s.previous.paymentOverdue)causes.push('زيادة المدفوعات المتأخرة');
  return [signal(input,s,{detector:this.key,title:'انخفاض ملحوظ في المبيعات',description:`انخفضت المبيعات بنسبة ${Math.abs(change*100).toFixed(1)}% مقارنة بالفترة السابقة.`,category:'anomaly',severity:change<-.35?'critical':change<-.22?'high':'medium',metrics:{salesCurrent:s.current.sales,salesPrevious:s.previous.sales,change,orderChange,trafficChange},riskScore:riskScore(change,1.4),opportunityScore:0,rootCauses:causes.length?causes:['تحتاج البيانات التفصيلية إلى مراجعة لتحديد السبب'],recommendations:['مراجعة القنوات والمنتجات الأكثر مساهمة في الانخفاض','مقارنة التحويل والزيارات والطلبات بين الفترتين'],suggestedActions:[action('تجهيز تحليل الانخفاض','إنشاء تحليل تفصيلي للفترة والمنتجات والقنوات.','low','madar.business.action.draft',{actionType:'sales_analysis',payload:{source:'orby-insight'}}),action('إعداد خطة استجابة','تجهيز مسودة خطة لمعالجة انخفاض المبيعات دون تنفيذ مباشر.','medium','madar.business.action.draft',{actionType:'sales_recovery',payload:{source:'orby-insight'}})]} )];
 }
}

export class RevenueDetector extends MetricDetector {
 readonly key='revenue' as const;
 async detect(input:OrbyDetectorInput){const s=await this.snapshot(input),change=ratio(s.current.revenue,s.previous.revenue);if(Math.abs(change)<.15)return [];
  const positive=change>0;return [signal(input,s,{detector:this.key,title:positive?'نمو في الإيرادات':'تراجع في الإيرادات',description:`تغيرت الإيرادات بنسبة ${(change*100).toFixed(1)}% مقارنة بالفترة السابقة.`,category:positive?'opportunity':'risk',severity:Math.abs(change)>.35?'high':'medium',metrics:{revenueCurrent:s.current.revenue,revenuePrevious:s.previous.revenue,change},riskScore:positive?0:riskScore(change,1.2),opportunityScore:positive?riskScore(change,1.1):0,rootCauses:['تغير حجم الطلبات أو متوسط قيمة الطلب'],recommendations:[positive?'تحديد المنتجات والقنوات التي تقود النمو':'تحليل المنتجات والعملاء والقنوات المتراجعة'],suggestedActions:[action('إنشاء تقرير الإيرادات','تجهيز تقرير تفصيلي بأسباب التغير.','low','madar.business.action.draft',{actionType:'revenue_analysis',payload:{source:'orby-insight'}})]})];
 }
}

export class CustomerChurnDetector extends MetricDetector {
 readonly key='customer_churn' as const;
 async detect(input:OrbyDetectorInput){const s=await this.snapshot(input),change=ratio(s.current.customers,s.previous.customers);if(change>-.1)return [];
  return [signal(input,s,{detector:this.key,title:'مؤشر محتمل لتسرب العملاء',description:`انخفض عدد العملاء النشطين بنسبة ${Math.abs(change*100).toFixed(1)}%.`,category:'risk',severity:change<-.25?'high':'medium',metrics:{activeCustomers:s.current.customers,previousActiveCustomers:s.previous.customers,change},riskScore:riskScore(change,1.5),opportunityScore:0,rootCauses:['انخفاض تكرار الشراء أو النشاط خلال الفترة'],recommendations:['تقسيم العملاء المتوقفين حسب القيمة وآخر نشاط','إعداد حملة استعادة موجهة بعد الموافقة'],suggestedActions:[action('تجهيز قائمة استعادة','إنشاء مسودة شرائح العملاء المقترح التواصل معها.','medium','madar.business.action.draft',{actionType:'customer_reactivation',payload:{source:'orby-insight'}})]})];
 }
}

export class InventoryDetector extends MetricDetector {
 readonly key='inventory' as const;
 async detect(input:OrbyDetectorInput){const s=await this.snapshot(input);if(s.current.lowInventory<=0)return [];
  const count=s.current.lowInventory;return [signal(input,s,{detector:this.key,title:'مخزون منخفض يحتاج الانتباه',description:`تم رصد ${count} عنصرًا عند مستوى مخزون منخفض أو نفاد محتمل.`,category:'risk',severity:count>20?'high':count>5?'medium':'low',metrics:{lowInventory:count,previousLowInventory:s.previous.lowInventory},riskScore:Math.min(100,count*5),opportunityScore:0,rootCauses:['الاستهلاك أو المبيعات أسرع من وتيرة إعادة التوريد'],recommendations:['مراجعة المنتجات الأعلى حركة ومدة التوريد','تجهيز مسودة إعادة طلب للمراجعة'],suggestedActions:[action('تجهيز إعادة التوريد','إعداد مسودة احتياجات المخزون دون إرسال طلب شراء.','high','madar.business.action.draft',{actionType:'inventory_restock',payload:{source:'orby-insight'}})]})];
 }
}

export class PaymentDetector extends MetricDetector {
 readonly key='payment' as const;
 async detect(input:OrbyDetectorInput){const s=await this.snapshot(input);if(s.current.paymentOverdue<=0)return [];
  const count=s.current.paymentOverdue;return [signal(input,s,{detector:this.key,title:'مدفوعات متأخرة',description:`يوجد ${count} مدفوعات أو فواتير متأخرة وفق البيانات الحالية.`,category:'risk',severity:count>10?'high':'medium',metrics:{overduePayments:count,previous:s.previous.paymentOverdue},riskScore:Math.min(100,count*8),opportunityScore:0,rootCauses:['تأخر التحصيل أو تعثر بعض عمليات الدفع'],recommendations:['مراجعة أعمار الديون وأعلى القيم','إعداد رسائل متابعة للمراجعة قبل الإرسال'],suggestedActions:[action('إعداد رسائل متابعة','تجهيز مسودات تذكير بالمدفوعات دون إرسال.','medium','madar.business.action.draft',{actionType:'payment_followup',payload:{source:'orby-insight'}})]})];
 }
}

export class SupportDetector extends MetricDetector {
 readonly key='support' as const;
 async detect(input:OrbyDetectorInput){const s=await this.snapshot(input),change=ratio(s.current.supportOpen,s.previous.supportOpen);if(s.current.supportOpen<5&&change<.25)return [];
  return [signal(input,s,{detector:this.key,title:'ارتفاع في طلبات الدعم المفتوحة',description:`يوجد ${s.current.supportOpen} طلب دعم مفتوح حاليًا.`,category:'risk',severity:s.current.supportOpen>25?'high':'medium',metrics:{openTickets:s.current.supportOpen,change},riskScore:Math.min(100,s.current.supportOpen*3),opportunityScore:0,rootCauses:['زيادة الطلبات أو بطء زمن المعالجة'],recommendations:['ترتيب الطلبات حسب الأولوية والعمر','تحديد الأسئلة المتكررة لإنشاء ردود مساعدة'],suggestedActions:[action('تجهيز خطة معالجة','إعداد مسودة ترتيب ومعالجة طلبات الدعم.','low','madar.business.action.draft',{actionType:'support_triage',payload:{source:'orby-insight'}})]})];
 }
}

export class TrafficDetector extends MetricDetector {
 readonly key='traffic' as const;
 async detect(input:OrbyDetectorInput){const s=await this.snapshot(input),change=ratio(s.current.traffic,s.previous.traffic);if(Math.abs(change)<.2)return [];
  const positive=change>0;return [signal(input,s,{detector:this.key,title:positive?'فرصة من ارتفاع الزيارات':'انخفاض في الزيارات',description:`تغيرت الزيارات بنسبة ${(change*100).toFixed(1)}%.`,category:positive?'opportunity':'anomaly',severity:Math.abs(change)>.4?'high':'medium',metrics:{trafficCurrent:s.current.traffic,trafficPrevious:s.previous.traffic,change},riskScore:positive?0:riskScore(change),opportunityScore:positive?riskScore(change):0,rootCauses:['تغير أداء القنوات أو الحملات أو الظهور العضوي'],recommendations:[positive?'استثمار الارتفاع وتحسين التحويل':'مراجعة القنوات ومصادر الزيارات المتراجعة'],suggestedActions:[action('تحليل القنوات','تجهيز تحليل لمصادر الزيارات والتحويل.','low','madar.business.action.draft',{actionType:'traffic_analysis',payload:{source:'orby-insight'}})]})];
 }
}

export class SystemHealthDetector extends MetricDetector {
 readonly key='system_health' as const;
 async detect(input:OrbyDetectorInput){const s=await this.snapshot(input);if(s.current.systemErrors<=0)return [];
  return [signal(input,s,{detector:this.key,title:'أخطاء تشغيلية في الأنظمة المرتبطة',description:`تم رصد ${s.current.systemErrors} أخطاء أو سجلات صحة غير سليمة.`,category:'risk',severity:s.current.systemErrors>10?'critical':'high',metrics:{systemErrors:s.current.systemErrors},riskScore:Math.min(100,s.current.systemErrors*10),opportunityScore:0,rootCauses:['فشل مزامنة أو اتصال أو عملية داخلية'],recommendations:['مراجعة آخر الأخطاء وسجلات الاتصال','اختبار الاتصال دون تعديل البيانات'],suggestedActions:[action('اختبار الاتصالات','تجهيز تشغيل اختبارات الاتصال الآمنة.','low','madar.business.action.draft',{actionType:'system_health_analysis',payload:{source:'orby-insight'}})]})];
 }
}

export class OrbyDetectionEngine {
 private readonly detectors=new Map<OrbyDetectorKey,OrbyProactiveDetector>();
 register(detector:OrbyProactiveDetector){this.detectors.set(detector.key,detector);return this;}
 list(){return [...this.detectors.values()];}
 async run(input:OrbyDetectorInput,keys?:readonly OrbyDetectorKey[]){const selected=keys?.length?keys.map(key=>this.detectors.get(key)).filter((item):item is OrbyProactiveDetector=>Boolean(item)):this.list();return (await Promise.all(selected.map(detector=>detector.detect(input)))).flat();}
}

export function createStandardDetectors(reader:OrbyBusinessMetricReader){return new OrbyDetectionEngine()
 .register(new SalesDropDetector(reader)).register(new RevenueDetector(reader)).register(new CustomerChurnDetector(reader)).register(new InventoryDetector(reader))
 .register(new PaymentDetector(reader)).register(new SupportDetector(reader)).register(new TrafficDetector(reader)).register(new SystemHealthDetector(reader));}
