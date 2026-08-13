import type {IconName} from './Icons';
import {Icon} from './Icons';
import {Card} from './Enterprise';

export function ContentSections({sections}:{sections:{title:string;body:string;items?:string[];icon?:IconName}[]}){return <div className="md-grid">{sections.map(section=><Card key={section.title} className="p-6 sm:p-8"><div className="flex items-start gap-4">{section.icon?<div className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--md-radius-md)] bg-[var(--md-mint-subtle)] text-[var(--md-mint)]"><Icon name={section.icon}/></div>:null}<div><h2 className="md-type-h2">{section.title}</h2><p className="md-type-body mt-4 md-secondary">{section.body}</p>{section.items?<ul className="md-stack md-stack-sm mt-5">{section.items.map(item=><li key={item} className="flex gap-3 md-secondary"><Icon name="check" className="mt-1 h-5 w-5 shrink-0 text-[var(--md-success)]"/>{item}</li>)}</ul>:null}</div></div></Card>)}</div>}
