import Link from 'next/link';
import type {ReactNode} from 'react';
import {requireBusinessWorkspace} from '@/src/lib/business';

const links=[['/workspace','نظرة عامة'],['/workspace/orby','أوربي'],['/workspace/analytics','التحليلات'],['/workspace/setup','الإعداد'],['/workspace/imports','الاستيراد'],['/workspace/products','المنتجات'],['/workspace/inventory','المخزون'],['/workspace/customers','العملاء'],['/workspace/sales','المبيعات'],['/workspace/expenses','المصروفات'],['/workspace/suppliers','الموردون'],['/workspace/tasks','المهام'],['/workspace/activity','سجل النشاط'],['/account/subscription','الاشتراك'],['/account/support','دعم Beta']];

export default async function WorkspaceLayout({children}:{children:ReactNode}){
 const{workspace,membership,subscriptionStatus}=await requireBusinessWorkspace();
 return <div className="min-h-screen bg-[#09090b] text-white print:bg-white"><header className="border-b border-white/10 bg-[#0d0d11]/95 print:hidden"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4"><div><Link href="/dashboard" className="text-sm font-bold text-[#70E4D4]">مَدار</Link><h1 className="text-xl font-black">{workspace.name}</h1><p className="text-xs text-slate-400">{membership.role} · {workspace.currency} · الاشتراك {subscriptionStatus}</p></div><nav className="flex max-w-full gap-2 overflow-x-auto pb-1">{links.map(([href,label])=><Link key={href} href={href} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-bold transition ${href==='/workspace/orby'?'border-violet-300/30 bg-violet-300/10 text-violet-100':'border-white/10 hover:border-[#70E4D4]/50 hover:text-[#70E4D4]'}`}>{label}</Link>)}</nav></div></header>{children}</div>;
}
