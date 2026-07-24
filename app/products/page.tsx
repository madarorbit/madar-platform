import StoreListingPage from '@/components/store/StoreListingPage';

export const metadata={title:'جميع المنتجات | متجر مَدار | ORBIT',description:'جميع المنتجات الرقمية والأنظمة والقوالب المنشورة والمتاحة في متجر مَدار.'};

export default function ProductsPage(){return <StoreListingPage eyebrow="متجر مَدار | ORBIT · المنتجات" title="جميع المنتجات والأنظمة الجاهزة" description="كتالوج ديناميكي يُدار بالكامل من لوحة الإدارة، ويعرض فقط العناصر المنشورة والمرئية والمفعّلة." filters={{entityType:'product'}} catalogTitle="المنتجات المنشورة"/>}
