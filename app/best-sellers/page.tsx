import StoreListingPage from '@/components/store/StoreListingPage';
export const metadata={title:'الأكثر مبيعًا | متجر مَدار'};
export default function Page(){return <StoreListingPage eyebrow="متجر مَدار · الأكثر مبيعًا" title="الأكثر مبيعًا" description="العناصر المنشورة مرتبة وفق عدد المبيعات المسجل في محرك المتجر." filters={{sort:'best_selling'}}/>}
