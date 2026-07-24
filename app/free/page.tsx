import StoreListingPage from '@/components/store/StoreListingPage';
export const metadata={title:'المنتجات والخدمات المجانية | مَدار'};
export default function Page(){return <StoreListingPage eyebrow="متجر مَدار · مجاني" title="المجانية" description="المنتجات والخدمات والموارد المجانية التي فعّلتها إدارة مَدار." filters={{free:'free'}}/>}
