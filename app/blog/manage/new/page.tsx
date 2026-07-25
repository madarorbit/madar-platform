import PageShell from '@/components/ui/PageShell';
import {PageHero,Section} from '@/components/ui/Section';
import BlogEditorForm from '@/components/blog/BlogEditorForm';
import {requireBlogManager} from '@/src/lib/blog/server';

export const metadata={title:'إضافة محتوى | مدونة مَدار',robots:{index:false,follow:false}};
export default async function NewBlogPostPage(){await requireBlogManager();return <PageShell><PageHero eyebrow="إدارة مدونة مَدار" title="إضافة مقال أو منشور" description="اكتب المحتوى واحفظه كمسودة، أو انشره مباشرة عندما يصبح جاهزًا للعامة."/><Section><BlogEditorForm/></Section></PageShell>}
