import {arabicMoney} from '@/src/lib/arabic-display';

/**
 * Presentation-only compatibility type.
 * Store records are loaded exclusively from Supabase through src/lib/store/server.ts.
 */
export type Product = {
  id: string | number;
  slug: string;
  category: string;
  title: string;
  description: string;
  longDescription: string;
  price: number;
  currency: string;
  icon: string;
  status: 'published' | 'draft';
  delivery: string;
  features: string[];
  includes: string[];
  thumbnailUrl?: string | null;
};

export function formatPrice(product: Pick<Product,'price'|'currency'>) { return arabicMoney(product.price,product.currency); }
