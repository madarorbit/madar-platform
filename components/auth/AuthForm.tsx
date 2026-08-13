'use client';
import Link from 'next/link';
import {useActionState} from 'react';
import {login,register,forgotPassword} from '@/app/actions/auth';
import {Button,Field,Input,Notice,Panel} from '@/components/ui/Enterprise';

type Kind='login'|'register'|'forgot';type State={error?:string;success?:string};const actionByKind={login,register,forgot:forgotPassword};
export function AuthForm({kind,next,notice}:{kind:Kind;next?:string;notice?:string}){
 const action=actionByKind[kind] as(previous:State,formData:FormData)=>Promise<State>,[state,formAction,pending]=useActionState(action,{});
 return <Panel className="mx-auto max-w-md"><form action={formAction} className="md-stack md-stack-sm" noValidate>{notice?<Notice title="اكتمل إنشاء الحساب" variant="success">{notice}</Notice>:null}{kind==='register'?<AuthField name="full_name" label="الاسم الكامل" autoComplete="name"/>:null}<AuthField name="email" label="البريد الإلكتروني" type="email" autoComplete="email"/>{kind!=='forgot'?<><AuthField name="password" label="كلمة المرور" type="password" autoComplete={kind==='login'?'current-password':'new-password'}/>{kind==='register'?<><AuthField name="confirm" label="تأكيد كلمة المرور" type="password" autoComplete="new-password"/><label className="md-terms-control"><input required name="terms" type="checkbox"/><span>أوافق على <Link href="/terms" target="_blank">شروط الاستخدام</Link> و<Link href="/privacy" target="_blank">سياسة الخصوصية</Link>.</span></label></>:null}</>:null}<input type="hidden" name="next" value={next||''}/><Button loading={pending} className="w-full" size="lg">{kind==='login'?'تسجيل الدخول':kind==='register'?'إنشاء الحساب':'إرسال رابط الاستعادة'}</Button>{state.error?<Notice title="تعذر إكمال العملية" variant="danger">{state.error}</Notice>:null}{state.success?<Notice title="تمت العملية بنجاح" variant="success">{state.success}</Notice>:null}{kind==='login'?<div className="md-auth-links"><Link href="/forgot-password">نسيت كلمة المرور؟</Link><span aria-hidden="true">•</span><Link href="/register">إنشاء حساب جديد</Link></div>:null}</form></Panel>;
}
function AuthField({name,label,type='text',autoComplete}:{name:string;label:string;type?:string;autoComplete?:string}){return <Field label={label}><Input required name={name} type={type} autoComplete={autoComplete}/></Field>}
