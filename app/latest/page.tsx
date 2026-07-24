import StoreListingPage from '@/components/store/StoreListingPage';
export const metadata={title:'أحدث المنتجات والخدمات | مَدار'};
export default function Page(){return <StoreListingPage eyebrow="متجر مَدار · الجديد" title="أحدث المنتجات والخدمات" description="أحدث العناصر المنشورة في محرك المتجر، مرتبة بحسب تاريخ النشر." filters={{sort:'latest'}}/>}
