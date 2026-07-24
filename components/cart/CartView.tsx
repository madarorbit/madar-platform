'use client';
import Link from 'next/link';
import {useCart} from './CartProvider';
import {arabicDisplay,arabicMoney} from '@/src/lib/arabic-display';
import {Button,Card,EmptyState,Input} from '@/components/ui/Enterprise';

export default function CartView(){
 const{items,remove,setQuantity}=useCart(),total=items.reduce((sum,item)=>sum+item.price*item.quantity,0);
 if(!items.length)return <EmptyState title="سلتك فارغة" description="استعرض منتجات مَدار وخدماتها ثم أضف ما يناسبك." action={<Link href="/store" className="md-button md-button-primary">الانتقال إلى المتجر</Link>}/>;
 return <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]"><div className="space-y-4">{items.map(item=>{const title=arabicDisplay(item.title);return <Card key={`${item.type}-${item.id}`} className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold text-emerald-300">{item.type==='product'?'منتج رقمي':'خدمة'}</p><h2 className="mt-1 text-xl font-black">{title}</h2><p className="mt-1 text-slate-300">{arabicMoney(item.price,item.currency)}</p></div><div className="flex flex-wrap items-center gap-3"><label className="md-field max-w-32"><span className="md-label">الكمية</span><Input aria-label={`كمية ${title}`} type="number" min="1" max="20" value={item.quantity} onChange={event=>setQuantity(item.id,item.type,Number(event.target.value))} className="text-center"/></label><Button type="button" variant="danger" size="sm" onClick={()=>remove(item.id,item.type)}>إزالة</Button></div></Card>})}</div><Card className="h-fit lg:sticky lg:top-24"><h2 className="text-xl font-black">ملخص السلة</h2><p className="mt-5 flex justify-between gap-4"><span>الإجمالي المبدئي</span><strong className="text-emerald-300">{arabicMoney(total,items[0]?.currency||'SAR')}</strong></p><p className="mt-3 text-sm leading-6 text-slate-400">يُحسب الخصم والسعر النهائي بأمان من قاعدة البيانات عند إنشاء الطلب.</p><Link href="/checkout" className="md-button md-button-primary mt-6 w-full">متابعة إتمام الطلب</Link></Card></div>;
}
