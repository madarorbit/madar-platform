import StoreListingPage from '@/components/store/StoreListingPage';
export const metadata={title:'المنتجات والخدمات المميزة | مَدار'};
export default function Page(){return <StoreListingPage eyebrow="متجر مَدار · المميز" title="العناصر المميزة" description="المنتجات والخدمات والاشتراكات التي اختارتها إدارة مَدار للظهور المميز." filters={{featured:true}}/>}
