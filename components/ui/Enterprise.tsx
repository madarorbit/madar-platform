import Image from 'next/image';
import Link from 'next/link';
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import {Icon, type IconName} from '@/components/ui/Icons';

export function cx(...values:Array<string|false|null|undefined>){return values.filter(Boolean).join(' ')}

export function Container({children,className=''}:{children:ReactNode;className?:string}){return <div className={cx('md-container',className)}>{children}</div>}
export function PageContainer({children,className=''}:{children:ReactNode;className?:string}){return <div className={cx('md-page-container md-page',className)}>{children}</div>}
export function Page({children,className=''}:{children:ReactNode;className?:string}){return <main className={cx('md-shell',className)}>{children}</main>}
export function PageHeader({eyebrow,title,description,actions}:{eyebrow?:string;title:string;description?:string;actions?:ReactNode}){
 return <header className="md-page-header"><Container className="md-page-header-inner"><div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_auto]"><div>{eyebrow?<span className="md-eyebrow">{eyebrow}</span>:null}<h1 className="md-title">{title}</h1>{description?<p className="md-description">{description}</p>:null}</div>{actions?<div className="md-cluster lg:justify-end">{actions}</div>:null}</div></Container></header>;
}
export function Section({children,className=''}:{children:ReactNode;className?:string}){return <section className={cx('md-container md-section',className)}>{children}</section>}
export function ContentArea({children,className=''}:{children:ReactNode;className?:string}){return <div className={cx('md-content-area',className)}>{children}</div>}
export function Stack({children,className='',gap='md'}:{children:ReactNode;className?:string;gap?:'sm'|'md'|'lg'}){return <div className={cx('md-stack',gap==='sm'&&'md-stack-sm',gap==='lg'&&'md-stack-lg',className)}>{children}</div>}
export function Grid({children,className='',auto=true}:{children:ReactNode;className?:string;auto?:boolean}){return <div className={cx('md-grid',auto&&'md-grid-auto',className)}>{children}</div>}

type SurfaceTone='default'|'muted'|'raised';
function surfaceClass(tone:SurfaceTone){return tone==='muted'?'md-surface-muted':tone==='raised'?'md-surface-raised':''}
export function Surface({children,className='',tone='default',as='div'}:{children:ReactNode;className?:string;tone?:SurfaceTone;as?:'div'|'section'|'article'}){
 const Component=as;
 return <Component className={cx('md-surface',surfaceClass(tone),className)}>{children}</Component>;
}
export function Panel({children,className='',tone='default'}:{children:ReactNode;className?:string;tone?:SurfaceTone}){return <div className={cx('md-panel',surfaceClass(tone),className)}>{children}</div>}
export function Card({children,className='',interactive=false,tone='default',as='div'}:{children:ReactNode;className?:string;interactive?:boolean;tone?:SurfaceTone;as?:'div'|'article'|'section'}){
 const Component=as;
 return <Component className={cx('md-card',surfaceClass(tone),interactive&&'md-card-interactive',className)}>{children}</Component>;
}

const buttonVariants={primary:'md-button-primary',secondary:'md-button-secondary',outline:'md-button-outline',ghost:'md-button-ghost',danger:'md-button-danger',link:'md-button-link'} as const;
export type ButtonVariant=keyof typeof buttonVariants;
export type ButtonSize='sm'|'md'|'lg';
export function buttonClass(variant:ButtonVariant,size:ButtonSize,className?:string){return cx('md-button',buttonVariants[variant],size==='sm'&&'md-button-sm',size==='lg'&&'md-button-lg',className)}
export function Button({variant='primary',size='md',className,loading=false,children,disabled,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:ButtonVariant;size?:ButtonSize;loading?:boolean}){
 return <button className={buttonClass(variant,size,className)} disabled={disabled||loading} aria-busy={loading||undefined} {...props}>{loading?<Icon name="spinner" className="md-button-spinner"/>:null}{children}</button>;
}
export function ButtonLink({href,children,variant='primary',size='md',className,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{href:string;children:ReactNode;variant?:ButtonVariant;size?:ButtonSize}){return <Link href={href} className={buttonClass(variant,size,className)} {...props}>{children}</Link>}

export function IconButton({label,badge,active=false,className,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{label:string;badge?:number|string;active?:boolean}){
 return <button type="button" className={cx('md-icon-button',className)} aria-label={label} title={label} data-active={active||undefined} {...props}>{children}{badge!==undefined&&badge!==0?<span className="md-icon-badge" aria-hidden="true">{badge}</span>:null}</button>;
}
export function IconLink({href,label,badge,className,children,...props}:AnchorHTMLAttributes<HTMLAnchorElement>&{href:string;label:string;badge?:number|string}){
 return <Link href={href} className={cx('md-icon-link',className)} aria-label={label} title={label} {...props}>{children}{badge!==undefined&&badge!==0?<span className="md-icon-badge" aria-hidden="true">{badge}</span>:null}</Link>;
}

export function Avatar({src,alt='صورة الحساب',size='md',className=''}:{src?:string|null;alt?:string;size?:'sm'|'md'|'lg';className?:string}){
 return <span className={cx('md-avatar',size==='sm'&&'md-avatar-sm',size==='lg'&&'md-avatar-lg',!src&&'md-avatar-fallback',className)}>{src?<Image src={src} alt={alt} fill sizes={size==='lg'?'64px':size==='sm'?'32px':'40px'} unoptimized/>:<Icon name="user"/>}</span>;
}

export function Field({label,help,error,children,className=''}:{label?:string;help?:string;error?:string;children:ReactNode;className?:string}){return <label className={cx('md-field',className)}>{label?<span className="md-label">{label}</span>:null}{children}{error?<span className="md-field-error" role="alert">{error}</span>:help?<span className="md-help">{help}</span>:null}</label>}
export function Input({className,...props}:InputHTMLAttributes<HTMLInputElement>){return <input className={cx('md-input',className)} {...props}/>}
export function Select({className,children,...props}:SelectHTMLAttributes<HTMLSelectElement>){return <select className={cx('md-select',className)} {...props}>{children}</select>}
export function Textarea({className,...props}:TextareaHTMLAttributes<HTMLTextAreaElement>){return <textarea className={cx('md-textarea',className)} {...props}/>}
export function SearchInput({label='البحث',className,...props}:InputHTMLAttributes<HTMLInputElement>&{label?:string}){return <label className={cx('md-search-field',className)}><span className="sr-only">{label}</span><Icon name="search" className="h-4 w-4"/><Input type="search" {...props}/></label>}

const badgeVariants={default:'',brand:'md-badge-brand',success:'md-badge-success',warning:'md-badge-warning',danger:'md-badge-danger',info:'md-badge-info'} as const;
export function Badge({children,variant='default',className=''}:{children:ReactNode;variant?:keyof typeof badgeVariants;className?:string}){return <span className={cx('md-badge',badgeVariants[variant],className)}>{children}</span>}
export type StatusTone='active'|'pending'|'approved'|'rejected'|'expired'|'suspended'|'draft'|'published'|'error';
export function StatusBadge({status,children,className=''}:{status:StatusTone;children:ReactNode;className?:string}){return <span className={cx('md-badge',`md-status-${status}`,className)}><span className="md-status-dot" aria-hidden="true"/>{children}</span>}

export function Stat({label,value,detail,className=''}:{label:string;value:ReactNode;detail?:ReactNode;className?:string}){return <div className={cx('md-stat',className)}><span className="md-stat-label">{label}</span><strong className="md-stat-value">{value}</strong>{detail?<span className="md-help">{detail}</span>:null}</div>}
export function EmptyState({title,description,icon='layers',action,compact=false}:{title:string;description:string;icon?:IconName;action?:ReactNode;compact?:boolean}){return <div className={cx('md-empty',compact&&'md-empty-compact')}><div><span className="md-empty-icon"><Icon name={icon}/></span><h2 className="md-state-title">{title}</h2><p className="md-state-description">{description}</p>{action?<div className="md-state-action">{action}</div>:null}</div></div>}
export function ErrorState({title='تعذر تحميل المحتوى',description,action,level='section'}:{title?:string;description:string;action?:ReactNode;level?:'section'|'page'}){return <div className={cx('md-error-state',level==='section'&&'md-error-state-compact')} role="alert"><div><span className="md-error-state-icon"><Icon name="warning"/></span><h2 className="md-state-title">{title}</h2><p className="md-state-description">{description}</p>{action?<div className="md-state-action">{action}</div>:null}</div></div>}
export function Skeleton({className='h-5 w-full'}:{className?:string}){return <span aria-hidden="true" className={cx('md-skeleton',className)}/>}
export function SkeletonGroup({label='جارٍ تحميل المحتوى',children,className=''}:{label?:string;children:ReactNode;className?:string}){return <div role="status" aria-label={label} className={cx('md-skeleton-stack',className)}>{children}<span className="sr-only">{label}</span></div>}

const noticeVariants={default:'md-notice-info',info:'md-notice-info',success:'md-notice-success',warning:'md-notice-warning',danger:'md-notice-danger'} as const;
const noticeIcons:Record<keyof typeof noticeVariants,IconName>={default:'info',info:'info',success:'check',warning:'warning',danger:'warning'};
export function Notice({title,children,variant='default',icon}:{title:string;children?:ReactNode;variant?:keyof typeof noticeVariants;icon?:IconName}){return <div className={cx('md-notice',noticeVariants[variant])} role={variant==='danger'?'alert':'status'}><span className="md-notice-icon"><Icon name={icon||noticeIcons[variant]}/></span><div><strong className="block">{title}</strong>{children?<div className="md-help mt-1">{children}</div>:null}</div></div>}

export function TableWrap({children,className=''}:{children:ReactNode;className?:string}){return <div className={cx('md-table-wrap',className)}>{children}</div>}
export function Table({children,className='',mobile='scroll',...props}:HTMLAttributes<HTMLTableElement>&{mobile?:'scroll'|'list'}){return <table className={cx('md-table md-table-responsive',className)} data-mobile={mobile} {...props}>{children}</table>}
export function Tabs({items,label='التبويبات'}:{items:Array<{label:string;href:string;active?:boolean}>;label?:string}){return <nav className="md-tabs" aria-label={label}>{items.map(item=><Link key={item.href} href={item.href} aria-current={item.active?'page':undefined} className={cx('md-tab',item.active&&'md-tab-active')}>{item.label}</Link>)}</nav>}
export function Breadcrumbs({items}:{items:Array<{label:string;href?:string}>}){return <nav className="md-breadcrumbs" aria-label="مسار الصفحة"><ol className="contents">{items.map((item,index)=><li key={`${item.label}-${index}`} className="contents">{index>0?<span aria-hidden="true">/</span>:null}{item.href?<Link href={item.href}>{item.label}</Link>:<span aria-current="page">{item.label}</span>}</li>)}</ol></nav>}
export function Pagination({page,totalPages,hrefFor}:{page:number;totalPages:number;hrefFor:(page:number)=>string}){if(totalPages<=1)return null;const pages=Array.from({length:totalPages},(_,index)=>index+1).filter(value=>value===1||value===totalPages||Math.abs(value-page)<=1);return <nav className="md-pagination" aria-label="التنقل بين الصفحات">{page>1?<Link className="md-page-button md-icon-directional" href={hrefFor(page-1)} aria-label="الصفحة السابقة"><Icon name="arrow" className="h-4 w-4"/></Link>:null}{pages.map((value,index)=><span className="contents" key={value}>{index>0&&value-pages[index-1]>1?<span aria-hidden="true" className="px-1 md-muted">…</span>:null}<Link href={hrefFor(value)} aria-current={value===page?'page':undefined} className={cx('md-page-button',value===page&&'md-page-button-active')}>{value.toLocaleString('ar-YE')}</Link></span>)}{page<totalPages?<Link className="md-page-button md-icon-directional" href={hrefFor(page+1)} aria-label="الصفحة التالية"><Icon name="arrow" className="h-4 w-4 rotate-180"/></Link>:null}</nav>}
export function Dropdown({label,children,className=''}:{label:ReactNode;children:ReactNode;className?:string}){return <details className={cx('md-menu-root group',className)}><summary className="md-button md-button-secondary md-menu-trigger">{label}<Icon name="arrow" className="h-4 w-4 rotate-90 transition group-open:-rotate-90"/></summary><div className="md-dropdown-panel">{children}</div></details>}
export function SearchBox({action='/search',placeholder='ابحث في مَدار',className=''}:{action?:string;placeholder?:string;className?:string}){return <form action={action} role="search" className={cx('flex items-center gap-2',className)}><SearchInput id="md-enterprise-search" name="q" placeholder={placeholder} className="min-w-0 flex-1"/><Button type="submit" size="sm">بحث</Button></form>}
export function OrbyBadge({imageSrc='/brand/orby-assistant.svg',label='أوربي'}:{imageSrc?:string;label?:string}){return <span className="md-orby-chip"><Image src={imageSrc} alt="صورة أوربي" width={32} height={32} unoptimized className="md-orby-avatar"/><span>{label}</span></span>}
export function Divider(){return <hr className="border-0 border-t border-[var(--md-border-subtle)]"/>}
