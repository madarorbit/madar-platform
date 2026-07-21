import { requireAdmin } from '@/src/lib/auth';

export default async function AdminLayout({children}:{children:React.ReactNode}) {
 await requireAdmin();
 return children;
}
