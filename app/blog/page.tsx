/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import PageShell from '@/components/ui/PageShell';
import {PageHero,Section,EmptyState} from '@/components/ui/Section';
import BlogPostCard from '@/components/blog/BlogPostCard';
import {blogCategories} from '@/src/data/blog';
import {canManageBlog,listVisiblePosts} from '@/src/lib/blog/server';
import {currentProfile} from '@/src/lib/supabase/server';

export const dynamic='force-dynamic';
export const metadata={title:'مدونة مَدار',description:'مقالات وأدلة ودروس عملية عن إدارة الأعمال والذكاء الاصطناعي والتجارة.'};

export default async function BlogPage(){
 const profile=await currentProfile().catch(()=>null),manager=canManageBlog(profile),posts=await listVisiblePosts({limit:9}).catch(()=>[]);
 return <PageShell><PageHero eyebrow="مدونة مَدار" title="معرفة عملية للأعمال والتقنية والتجارة" description="مقالات وأدلة ودروس تنشرها مَدار لمساعدة التجار ورواد الأعمال والمهتمين بالتقنية على اتخاذ قرارات أوضح."/>
  <Section><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-bold text-[#70E4D4]">أقسام المدونة</p><h2 className="mt-2 text-3xl font-black">اختر المجال الذي يهمك</h2></div>{manager&&<Link href="/blog/manage/new" className="rounded-xl bg-gradient-to-l from-[#6C3BFF] to-[#00A98F] px-5 py-3 font-black text-white">إضافة مقال أو منشور</Link>}</div>
   <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">{blogCategories.map(category=><Link key={category.slug} href={`/blog/category/${category.slug}`} className="group rounded-3xl border border-white/10 bg-white/[.04] p-5 transition hover:-translate-y-1 hover:border-violet-300/30"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-400/15 to-emerald-400/10"><img src={category.iconUrl} alt="" className="h-10 w-10"/></div><h3 className="mt-5 text-xl font-black">{category.title}</h3><p className="mt-3 text-sm leading-7 text-slate-400">{category.description}</p><span className="mt-5 inline-block text-sm font-bold text-[#70E4D4]">عرض القسم ←</span></Link>)}</div>
  </Section>
  <Section><div className="flex items-end justify-between gap-4"><div><p className="font-bold text-violet-200">الأحدث</p><h2 className="mt-2 text-3xl font-black">آخر ما نُشر في مَدار</h2></div></div>{posts.length?<div className="mt-7 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{posts.map(post=><BlogPostCard key={post.id} post={post} canManage={manager}/>)}</div>:<div className="mt-7"><EmptyState title="لا توجد مقالات منشورة بعد" description={manager?'ابدأ بإضافة أول مقال أو احفظه كمسودة حتى يصبح جاهزًا للنشر.':'ستظهر هنا المقالات والمنشورات فور نشرها من فريق مَدار.'}/></div>}</Section>
 </PageShell>;
}
