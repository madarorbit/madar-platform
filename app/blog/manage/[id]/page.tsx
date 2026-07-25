import {notFound} from 'next/navigation';
import PageShell from '@/components/ui/PageShell';
import {PageHero,Section} from '@/components/ui/Section';
import BlogEditorForm from '@/components/blog/BlogEditorForm';
import {getPostForManager} from '@/src/lib/blog/server';

export const metadata={title:'تعديل المحتوى | مدونة مَدار',robots:{index:false,follow:false}};
export default async function EditBlogPostPage({params}:{params:Promise<{id:string}>}){const{id}=await params,post=await getPostForManager(id);if(!post)notFound();return <PageShell><PageHero eyebrow="إدارة مدونة مَدار" title="تعديل المقال أو المنشور" description="يمكنك تحديث النص والقسم وحالة النشر والصورة أو الفيديو المرفق."/><Section><BlogEditorForm post={post}/></Section></PageShell>}
