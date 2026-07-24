import StoreListingPage from '@/components/store/StoreListingPage';

export const metadata={title:'البحث في متجر مَدار | ORBIT',description:'بحث لحظي في المنتجات والخدمات والاشتراكات والتصنيفات والوسوم وحقول SEO.'};

export default async function Page({searchParams}:{searchParams:Promise<{q?:string;type?:string;category?:string}>}){const params=await searchParams;const type=params.type==='product'||params.type==='service'||params.type==='plan'?params.type:'all';return <StoreListingPage eyebrow="MADAR Store Search" title="البحث في متجر مَدار" description="ابحث لحظيًا في أسماء المنتجات والخدمات وأوصافها وتصنيفاتها وبيانات SEO، ثم استخدم الفلاتر للوصول إلى النتيجة المناسبة." filters={{q:params.q?.slice(0,100),entityType:type,category:params.category}} catalogTitle={params.q?`نتائج البحث عن «${params.q.slice(0,100)}»`:'نتائج المتجر'}/>}
