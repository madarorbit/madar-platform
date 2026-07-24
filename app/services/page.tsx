import StoreListingPage from '@/components/store/StoreListingPage';

export const metadata={title:'جميع الخدمات | متجر مَدار | ORBIT',description:'خدمات مَدار البرمجية والتقنية والإبداعية المنشورة والمتاحة للطلب.'};

export default function ServicesPage(){return <StoreListingPage eyebrow="متجر مَدار | ORBIT · الخدمات" title="خدمات تُبنى حول احتياج العمل" description="خدمات البرمجة والذكاء الاصطناعي والتصميم والتسويق والتجارة والاستشارات، مع تحكم كامل من لوحة الإدارة." filters={{entityType:'service'}} catalogTitle="الخدمات المنشورة"/>}
