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
 let initial;let categories=[];
 try{[initial,categories]=await Promise.all([searchStore({...filters,page:1,pageSize:12}),getStoreCategories()])}
 catch{initial={items:[],total:0,page:1,pageSize:12,hasMore:false}}
 return <PageShell><PageHero eyebrow={eyebrow} title={title} description={description}/><Section><StoreCatalog initial={initial} categories={categories} fixed={filters} title={catalogTitle||title}/></Section></PageShell>;
}
