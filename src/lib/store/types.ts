export type StoreEntityType='product'|'service'|'plan';
export type StoreCatalogStatus='draft'|'published'|'archived'|'coming_soon'|'sold_out'|'disabled';
export type StoreVisibility='visible'|'hidden';
export type StoreAvailability='available'|'coming_soon'|'sold_out'|'disabled';

export type StoreCategory={
 id:string;
 name:string;
 slug:string;
 description:string|null;
 imageUrl:string|null;
 sortOrder:number;
};

export type StoreItem={
 id:string;
 entityType:StoreEntityType;
 name:string;
 slug:string;
 shortDescription:string;
 longDescription:string;
 price:number;
 compareAtPrice:number|null;
 currency:string;
 status:StoreCatalogStatus;
 visibility:StoreVisibility;
 availability:StoreAvailability;
 itemType:string;
 category:StoreCategory|null;
 subcategory:StoreCategory|null;
 thumbnailUrl:string|null;
 videoUrl:string|null;
 externalUrl:string|null;
 purchaseUrl:string|null;
 deliveryType:string|null;
 deliveryDuration:string|null;
 requiresApproval:boolean;
 isFree:boolean;
 isFeatured:boolean;
 showOnHome:boolean;
 ratingAverage:number;
 ratingCount:number;
 salesCount:number;
 viewCount:number;
 features:string[];
 includes:string[];
 keywords:string[];
 publishedAt:string|null;
 createdAt:string;
};

export type StoreSearchFilters={
 q?:string;
 entityType?:StoreEntityType|'all';
 category?:string;
 subcategory?:string;
 free?:'all'|'free'|'paid';
 featured?:boolean;
 comingSoon?:boolean;
 minPrice?:number;
 maxPrice?:number;
 sort?:'latest'|'best_selling'|'rating'|'price_asc'|'price_desc'|'alphabetical';
 page?:number;
 pageSize?:number;
};

export type StoreSearchResponse={
 items:StoreItem[];
 total:number;
 page:number;
 pageSize:number;
 hasMore:boolean;
};
