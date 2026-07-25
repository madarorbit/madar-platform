import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import PageShell from '@/components/ui/PageShell';
import {PageHero,Section,EmptyState} from '@/components/ui/Section';
import BlogPostCard from '@/components/blog/BlogPostCard';
import {blogCategories,blogCategoryBySlug} from '@/src/data/blog';
import {canManageBlog,listVisiblePosts} from '@/src/lib/blog/server';
import {currentProfile} from '@/src/lib/supabase/server';

export const dynamic='force-dynamic';
export function generateStaticParams(){return blogCategories.map(category=>({slug:category.slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const{slug}=await params,category=blogCategoryBySlug(slug);return category?{title:`${category.title} | مدونة مَدار`,description:category.description}:{title:'قسم غير موجود',robots:{index:false,follow:false}}}

export default async function BlogCategoryPage({params}:{params:Promise<{slug:string}>}){
 const{slug}=await params,category=blogCategoryBySlug(slug);if(!category)notFound();
 const profile=await currentProfile().catch(()=>null),manager=canManageBlog(profile),posts=await listVisiblePosts({category:category.slug,limit:100}).catch(()=>[]);
 return <PageShell><PageHero eyebrow="مدونة مَدار" title={category.title} description={category.description}/><Section><div className="flex flex-wrap items-center justify-between gap-3"><Link href="/blog" className="font-bold text-[#70E4D4]">العودة إلى أقسام المدونة</Link>{manager&&<Link href="/blog/manage/new" className="rounded-xl bg-gradient-to-l from-[#6C3BFF] to-[#00A98F] px-5 py-3 font-black text-white">إضافة محتوى جديد</Link>}</div>{posts.length?<div className="mt-7 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{posts.map(post=><BlogPostCard key={post.id} post={post} canManage={manager}/>)}</div>:<div className="mt-7"><EmptyState title="لا يوجد محتوى في هذا القسم بعد" description={manager?'يمكنك إضافة أول مقال أو منشور لهذا القسم الآن.':'سيظهر المحتوى هنا فور نشره من فريق مَدار.'}/></div>}</Section></PageShell>;
}
