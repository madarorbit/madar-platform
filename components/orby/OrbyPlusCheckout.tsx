'use client';

import {useActionState,useMemo,useState} from 'react';
import {submitOrbyPlusPayment,type OrbyPlusActionState} from '@/app/actions/orby-plus';
import {Button,Field,Input,Notice,Select} from '@/components/ui/Enterprise';
import {convertStoreAmount,formatStoreMoney,type CurrencyDefinition,type ExchangeRateDefinition} from '@/src/lib/store/currency';

type Method={id:string;name:string;account_name:string|null;account_identifier:string|null;instructions:string|null;currency_agnostic:boolean};
type Restriction={payment_method_id:string;currency_code:string};

export default function OrbyPlusCheckout({price,currency,currencies,rates,methods,restrictions}:{price:number;currency:string;currencies:CurrencyDefinition[];rates:ExchangeRateDefinition[];methods:Method[];restrictions:Restriction[]}){
 const[state,action,pending]=useActionState<OrbyPlusActionState,FormData>(submitOrbyPlusPayment,{}),[paymentCurrency,setPaymentCurrency]=useState(currency),[methodId,setMethodId]=useState(methods[0]?.id||'');
 const availableMethods=useMemo(()=>methods.filter(method=>method.currency_agnostic||restrictions.some(item=>item.payment_method_id===method.id&&item.currency_code===paymentCurrency)),[methods,restrictions,paymentCurrency]),selected=availableMethods.find(item=>item.id===methodId)||availableMethods[0],converted=convertStoreAmount(price,currency,paymentCurrency,rates,currencies);
 return <form action={action} className="md-orby-plus-form"><input type="hidden" name="payment_method_id" value={selected?.id||''}/>
  <div className="md-orby-plus-currency"><Field label="عملة الدفع"><Select name="payment_currency" value={paymentCurrency} onChange={event=>{setPaymentCurrency(event.target.value);setMethodId('');}}>{currencies.filter(item=>item.is_active!==false).map(item=><option key={item.code} value={item.code}>{item.name} — {item.code}</option>)}</Select></Field><div className="md-orby-plus-amount"><span>المبلغ المطلوب</span><strong>{converted===null?'لا يتوفر سعر تحويل':formatStoreMoney(converted,paymentCurrency,currencies)}</strong>{paymentCurrency!==currency?<small>السعر الأصلي: {formatStoreMoney(price,currency,currencies)}</small>:null}</div></div>
  {converted===null?<Notice title="سعر التحويل غير متاح" variant="warning">لا يوجد سعر تحويل فعّال بين {currency} و{paymentCurrency}. اختر عملة أخرى أو انتظر تحديث الإدارة.</Notice>:null}
  <fieldset className="md-orby-payment-methods"><legend>وسيلة الدفع</legend>{availableMethods.length?<div>{availableMethods.map(method=><button type="button" key={method.id} onClick={()=>setMethodId(method.id)} aria-pressed={selected?.id===method.id} className={selected?.id===method.id?'is-selected':''}><strong>{method.name}</strong>{method.account_name?<span>{method.account_name}</span>:null}{method.account_identifier?<b dir="ltr">{method.account_identifier}</b>:null}{method.instructions?<small>{method.instructions}</small>:null}</button>)}</div>:<p>لا توجد وسيلة دفع تقبل العملة المحددة.</p>}</fieldset>
  <Field label="رقم الحوالة / العملية" help="مطلوب لإرسال طلب المراجعة."><Input required minLength={3} maxLength={120} name="payment_reference" autoComplete="off" placeholder="اكتب الرقم كما يظهر في التحويل"/></Field>
  <Field label="إيصال التحويل" help="اختياري · JPG / PNG / WebP / PDF حتى 10MB."><Input type="file" name="proof" accept="image/jpeg,image/png,image/webp,application/pdf"/></Field>
  {state.error?<Notice title="تعذر إرسال الطلب" variant="danger">{state.error}</Notice>:null}{state.success?<Notice title="تم إرسال الطلب" variant="success">{state.success}</Notice>:null}
  <Button type="submit" loading={pending} disabled={!selected||converted===null} className="w-full">إرسال طلب ORBY Plus</Button>
 </form>;
}
