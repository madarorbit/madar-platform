'use server';

import {createHash,randomUUID} from 'node:crypto';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {supabaseConfig} from '@/src/lib/env';
import {isBlogCategory} from '@/src/data/blog';
import {requireBlogManager} from '@/src/lib/blog/server';
import {currentProfile,serverToken,supabaseFetch} from '@/src/lib/supabase/server';
import {validateMagicBytes} from '@/src/lib/file-signatures.mjs';

export type BlogEditorState={error?:string};
export type BlogCommentState={error?:string;success?:string};

const clean=(value:FormDataEntryValue|null,max:number)=>String(value||'').trim().slice(0,max);
const encodeStoragePath=(path:string)=>path.split('/').map(encodeURIComponent).join('/');
const slugify=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,120);

async function validateMedia(file:File){
 const allowed:Record<string,{extension:string;kind:'image'|'video';limit:number}>={
  'image/jpeg':{extension:'jpg',kind:'image',limit:8*1024*1024},'image/png':{extension:'png',kind:'image',limit:8*1024*1024},'image/webp':{extension:'webp',kind:'image',limit:8*1024*1024},
  'video/mp4':{extension:'mp4',kind:'video',limit:25*1024*1024},'video/webm':{extension:'webm',kind:'video',limit:25*1024*1024},
 };
 const config=allowed[file.type];
 if(!config)throw new Error('الملف يجب أن يكون صورة JPEG أو PNG أو WebP، أو فيديو MP4 أو WebM.');
 if(file.size>config.limit)throw new Error(config.kind==='image'?'حجم الصورة يجب ألا يتجاوز 8 ميجابايت.':'حجم الفيديو يجب ألا يتجاوز 25 ميجابايت.');
 if(config.kind==='image'&&!await validateMagicBytes(file))throw new Error('محتوى الصورة لا يطابق نوع الملف.');
 if(config.kind==='video'){
  const bytes=new Uint8Array((await file.arrayBuffer()).slice(0,16));
  const mp4=file.type==='video/mp4'&&String.fromCharCode(...bytes.slice(4,8))==='ftyp';
  const webm=file.type==='video/webm'&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3;
  if(!mp4&&!webm)throw new Error('محتوى الفيديو لا يطابق نوع الملف.');
 }
 return config;
}

async function uploadBlogMedia(file:File,userId:string){
 const config=await validateMedia(file),token=await serverToken();
 if(!token)throw new Error('انتهت جلسة الدخول. سجل الدخول مجددًا.');
 const {url,key}=supabaseConfig(),path=`${userId}/${new Date().toISOString().slice(0,10)}/${randomUUID()}.${config.extension}`;
 const response=await fetch(`${url}/storage/v1/object/blog-media/${encodeStoragePath(path)}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':file.type,'x-upsert':'false'},body:file,cache:'no-store'});
 if(!response.ok)throw new Error('تعذر رفع وسائط المقال.');
 return {media_type:config.kind,media_path:path,media_url:`${url}/storage/v1/object/public/blog-media/${encodeStoragePath(path)}`};
}

async function removeBlogMedia(path:string|null){
 if(!path)return;
 const token=await serverToken();if(!token)return;
 const {url,key}=supabaseConfig();
 await fetch(`${url}/storage/v1/object/blog-media/${encodeStoragePath(path)}`,{method:'DELETE',headers:{apikey:key,Authorization:`Bearer ${token}`},cache:'no-store'}).catch(()=>undefined);
}

function readPostForm(form:FormData){
 const title=clean(form.get('title'),180),category=clean(form.get('category_slug'),80),content=clean(form.get('content'),40000),excerpt=clean(form.get('excerpt'),500),status=clean(form.get('status'),20)==='published'?'published' as const:'draft' as const;
 const slug=slugify(clean(form.get('slug'),140)||title);
 if(title.length<4)throw new Error('عنوان المقال يجب أن يكون أربعة أحرف على الأقل.');
 if(!isBlogCategory(category))throw new Error('اختر قسمًا صحيحًا للمدونة.');
 if(!slug)throw new Error('تعذر إنشاء رابط المقال. اكتب رابطًا مختصرًا واضحًا.');
 if(content.length<20)throw new Error('محتوى المقال قصير جدًا.');
 return {title,category_slug:category,content,excerpt,slug,status,published_at:status==='published'?new Date().toISOString():null};
}

export async function createBlogPost(_previous:BlogEditorState,form:FormData):Promise<BlogEditorState>{
 let destination='/blog';
 try{
  const profile=await requireBlogManager(),values=readPostForm(form),file=form.get('media');
  const media=file instanceof File&&file.size?await uploadBlogMedia(file,profile.id):{};
  const rows=await supabaseFetch('/rest/v1/blog_posts',{method:'POST',body:JSON.stringify({...values,...media,author_id:profile.id})}) as Array<{slug:string}>;
  destination=`/blog/${rows[0]?.slug||values.slug}`;
  revalidatePath('/blog');revalidatePath(`/blog/category/${values.category_slug}`);revalidatePath('/sitemap.xml');
 }catch(error){return {error:error instanceof Error?error.message:'تعذر إنشاء المقال.'};}
 redirect(destination);
}

export async function updateBlogPost(_previous:BlogEditorState,form:FormData):Promise<BlogEditorState>{
 let destination='/blog';
 try{
  const profile=await requireBlogManager();
  const id=clean(form.get('id'),80),values=readPostForm(form);
  const existing=await supabaseFetch(`/rest/v1/blog_posts?id=eq.${encodeURIComponent(id)}&select=id,slug,category_slug,media_path&limit=1`) as Array<{id:string;slug:string;category_slug:string;media_path:string|null}>;
  if(!existing[0])throw new Error('المقال غير موجود.');
  const file=form.get('media'),removeMedia=form.get('remove_media')==='on';
  let media:Record<string,string|null>={};
  if(file instanceof File&&file.size)media=await uploadBlogMedia(file,profile.id);
  else if(removeMedia)media={media_type:null,media_path:null,media_url:null};
  await supabaseFetch(`/rest/v1/blog_posts?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({...values,...media})});
  if((removeMedia||(file instanceof File&&file.size))&&existing[0].media_path)await removeBlogMedia(existing[0].media_path);
  destination=`/blog/${values.slug}`;
  revalidatePath('/blog');revalidatePath(`/blog/${existing[0].slug}`);revalidatePath(`/blog/${values.slug}`);revalidatePath(`/blog/category/${existing[0].category_slug}`);revalidatePath(`/blog/category/${values.category_slug}`);revalidatePath('/sitemap.xml');
 }catch(error){return {error:error instanceof Error?error.message:'تعذر تعديل المقال.'};}
 redirect(destination);
}

export async function deleteBlogPost(form:FormData){
 await requireBlogManager();
 const id=clean(form.get('id'),80),rows=await supabaseFetch(`/rest/v1/blog_posts?id=eq.${encodeURIComponent(id)}&select=slug,category_slug,media_path&limit=1`) as Array<{slug:string;category_slug:string;media_path:string|null}>;
 if(rows[0]){await supabaseFetch(`/rest/v1/blog_posts?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});await removeBlogMedia(rows[0].media_path);revalidatePath('/blog');revalidatePath(`/blog/category/${rows[0].category_slug}`);revalidatePath('/sitemap.xml');}
 redirect('/blog');
}

async function visitorHash(){
 const jar=await cookies();let visitor=jar.get('madar-blog-visitor')?.value;
 if(!visitor){visitor=randomUUID();jar.set('madar-blog-visitor',visitor,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:60*60*24*365});}
 return createHash('sha256').update(visitor).digest('hex');
}

async function publicInsert(table:string,payload:unknown){
 const {url,key}=supabaseConfig();
 const response=await fetch(`${url}/rest/v1/${table}?on_conflict=post_id,visitor_hash`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(payload),cache:'no-store'});
 if(!response.ok)throw new Error('تعذر تسجيل التفاعل الآن.');
}

async function publicCount(postId:string,column:'likes_count'|'comments_count'|'shares_count'){
 const {url,key}=supabaseConfig();const response=await fetch(`${url}/rest/v1/blog_posts?id=eq.${encodeURIComponent(postId)}&select=${column}&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:'no-store'});
 if(!response.ok)return 0;const rows=await response.json() as Array<Record<string,number>>;return Number(rows[0]?.[column]||0);
}

export async function likeBlogPost(postId:string){
 try{await publicInsert('blog_likes',{post_id:postId,visitor_hash:await visitorHash()});revalidatePath('/blog','layout');return {ok:true,count:await publicCount(postId,'likes_count')};}
 catch{return {ok:false,count:await publicCount(postId,'likes_count')};}
}

export async function shareBlogPost(postId:string){
 try{
  const {url,key}=supabaseConfig(),response=await fetch(`${url}/rest/v1/blog_shares`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({post_id:postId,visitor_hash:await visitorHash()}),cache:'no-store'});
  if(!response.ok)throw new Error('تعذر تسجيل المشاركة.');
  revalidatePath('/blog','layout');return {ok:true,count:await publicCount(postId,'shares_count')};
 }catch{return {ok:false,count:await publicCount(postId,'shares_count')};}
}

export async function addBlogComment(_previous:BlogCommentState,form:FormData):Promise<BlogCommentState>{
 try{
  if(clean(form.get('website'),200))return {success:'تم نشر تعليقك.'};
  const postId=clean(form.get('post_id'),80),profile=await currentProfile().catch(()=>null),authorName=(profile?.full_name||clean(form.get('author_name'),80)),body=clean(form.get('body'),1200);
  if(authorName.length<2)throw new Error('اكتب اسمك ليظهر مع التعليق.');
  if(body.length<2)throw new Error('اكتب تعليقًا واضحًا.');
  const {url,key}=supabaseConfig(),response=await fetch(`${url}/rest/v1/blog_comments`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({post_id:postId,visitor_hash:await visitorHash(),author_name:authorName,body}),cache:'no-store'});
  if(!response.ok)throw new Error('تعذر نشر التعليق الآن.');
  revalidatePath('/blog','layout');
  return {success:'تم نشر تعليقك.'};
 }catch(error){return {error:error instanceof Error?error.message:'تعذر نشر التعليق.'};}
}
