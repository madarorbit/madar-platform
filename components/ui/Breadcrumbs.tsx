import {Breadcrumbs as DesignSystemBreadcrumbs} from '@/components/ui/Enterprise';
export function Breadcrumbs({items}:{items:{label:string;href?:string}[]}){return <div className="mb-8"><DesignSystemBreadcrumbs items={[{label:'الرئيسية',href:'/'},...items]}/></div>}
