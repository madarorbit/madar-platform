import {Icon} from '@/components/ui/Icons';
import {cx} from '@/components/ui/Enterprise';

export function Section({children,className=''}:{children:React.ReactNode;className?:string}){return <section className={cx('md-container md-section',className)}>{children}</section>}
export function PageHero({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){return <header className="md-page-header"><section className="md-container md-page-header-inner"><span className="md-eyebrow"><Icon name="sparkles" className="h-4 w-4"/>{eyebrow}</span><h1 className="md-title">{title}</h1><p className="md-description">{description}</p></section></header>}
export function EmptyState({title,description}:{title:string;description:string}){return <div className="md-empty"><div className="max-w-xl"><span className="md-empty-icon mx-auto"><Icon name="layers"/></span><h2 className="mt-5 text-2xl font-black">{title}</h2><p className="mt-3 text-slate-400">{description}</p></div></div>}
