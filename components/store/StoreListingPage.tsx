import PageShell from '@/components/ui/PageShell';
import {PageHero,Section} from '@/components/ui/Section';
import StoreCatalog from './StoreCatalog';
import {getStoreCategories,searchStore} from '@/src/lib/store/server';
import type {StoreSearchFilters} from '@/src/lib/store/types';

type Props={
 eyebrow:string;
 title:string;
 description:string;
 filters?:StoreSearchFilters;
 catalogTitle?:string;
};

export default async function StoreListingPage({eyebrow,title,description,filters={},catalogTitle}:Props){
 let initial:Awaited<ReturnType<typeof searchStore>>={items:[],total:0,page:1,pageSize:12,hasMore:false};
 let categories:Awaited<ReturnType<typeof getStoreCategories>>=[];
 try{[initial,categories]=await Promise.all([searchStore({...filters,page:1,pageSize:12}),getStoreCategories()])}catch{}
 const validCategories=categories.filter((category):category is NonNullable<(typeof categories)[number]>=>category!=null);
 return <PageShell><PageHero eyebrow={eyebrow} title={title} description={description}/><Section><StoreCatalog initial={initial} categories={validCategories} fixed={filters} title={catalogTitle||title}/></Section></PageShell>;
}
