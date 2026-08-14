'use client';

import {useActionState,useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {createOrder,type OrderState} from '@/app/actions/orders';
import {Button,Field,Input,Notice,Panel} from '@/components/ui/Enterprise';
import {useCart} from './CartProvider';
import {money} from '@/src/lib/order-status';

const initial:OrderState={};

export default function CheckoutForm({profile}:{profile:{full_name:string|null;email:string|null;phone:string|null}}){
 const{items,clear}=useCart(),[state,action,pending]=useActionState(createOrder,initial),router=useRouter(),groups=new Map<string,number>();
 for(const item of items)groups.set(item.currency,(groups.get(item.currency)||0)+item.price*item.quantity);
 const mixed=groups.size>1;
 useEffect(()=>{if(state.orderId){clear();router.push(`/account/orders/${state.orderId}`)}},[state.orderId,clear,router]);
 return <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
  <form action={action} className="md-panel md-checkout-form" aria-describedby="checkout-flow-help">
   <div className="md-checkout-heading"><div><span className="md-eyebrow">الخطوة 1 من 2</span><h2 className="md-type-h2 mt-2">بيانات الطلب</h2></div><p id="checkout-flow-help" className="md-type-body-sm md-muted">أنشئ الطلب أولًا، ثم أرسل بيانات التحويل من صفحة الطلب. لا يتم اعتبار الدفع مكتملًا قبل المراجعة.</p></div>
   <input type="hidden" name="items" value={JSON.stringify(items)}/>
   <div className="md-checkout-fields">
    <Field label="الاسم"><Input value={profile.full_name||''} readOnly autoComplete="name"/></Field>
    <Field label="البريد الإلكتروني"><Input value={profile.email||''} readOnly type="email" autoComplete="email" dir="ltr"/></Field>
    <Field label="رقم التواصل" help="استخدم رقمًا يمكن الرجوع إليه عند الحاجة لمراجعة الطلب."><Input name="phone" defaultValue={profile.phone||''} inputMode="tel" autoComplete="tel" dir="ltr"/></Field>
    <Field label="رمز الخصم" help="اتركه فارغًا إذا لم يكن لديك رمز."><Input name="coupon" autoCapitalize="characters" autoComplete="off" className="md-ltr-data uppercase"/></Field>
   </div>
   {mixed?<Notice title="السلة تحتوي أكثر من عملة" variant="warning">أكمل كل عملة في طلب مستقل حتى تبقى المبالغ واضحة ولا تُجمع عملات مختلفة رقميًا.</Notice>:null}
   {state.error?<Notice title="تعذر إنشاء الطلب" variant="danger">{state.error}</Notice>:null}
   {!items.length?<Notice title="السلة فارغة" variant="info">أضف منتجًا أو خدمة قبل متابعة الطلب.</Notice>:null}
   <Button type="submit" loading={pending} disabled={!items.length||mixed} className="w-full">إنشاء الطلب والمتابعة للدفع</Button>
  </form>
  <Panel className="md-checkout-summary"><div><span className="md-eyebrow">ملخص واضح</span><h2 className="md-type-h3 mt-2">الطلب</h2></div>{[...groups].length?<div className="md-checkout-totals">{[...groups].map(([currency,amount])=><div key={currency}><span className="md-ltr-data">{currency}</span><strong className="md-ltr-data">{money(amount,currency)}</strong></div>)}</div>:<p className="md-type-body-sm md-muted">لا توجد عناصر في السلة.</p>}<p className="md-help">السعر النهائي والخصم يعاد حسابهما على الخادم قبل إنشاء الطلب.</p></Panel>
 </div>;
}