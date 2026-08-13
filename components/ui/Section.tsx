import {Icon} from '@/components/ui/Icons';
import {EmptyState as DesignSystemEmptyState,cx} from '@/components/ui/Enterprise';

export function Section({children,className=''}:{children:React.ReactNode;className?:string}){return <section className={cx('md-container md-section md-public-section',className)}>{children}</section>}
export function PageHero({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){return <header className="md-page-header md-public-page-hero"><section className="md-container md-page-header-inner"><span className="md-eyebrow"><Icon name="sparkles" className="h-4 w-4"/>{eyebrow}</span><h1 className="md-title">{title}</h1><p className="md-description">{description}</p><nav className="md-public-page-shortcuts" aria-label="روابط سريعة"><a href="#content">المحتوى</a><a href="/search">البحث</a><a href="/contact">المساعدة</a></nav></section></header>}
export function EmptyState({title,description}:{title:string;description:string}){return <DesignSystemEmptyState title={title} description={description}/>}
