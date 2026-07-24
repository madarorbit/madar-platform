import StoreListingPage from '@/components/store/StoreListingPage';
export const metadata={title:'الاشتراكات والباقات | مَدار'};
export default function Page(){return <StoreListingPage eyebrow="متجر مَدار · الاشتراكات" title="الاشتراكات والباقات" description="خطط اشتراك قابلة للإدارة والتسعير والتفعيل من لوحة إدارة المتجر." filters={{entityType:'plan'}} catalogTitle="الخطط المنشورة"/>}
