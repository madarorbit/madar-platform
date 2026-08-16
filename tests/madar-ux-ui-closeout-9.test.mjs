import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const text=async(path)=>(await readFile(new URL(`../${path}`,import.meta.url))).toString('utf8');

test('phase 9 closeout layer is last and keeps phase 8 before it',async()=>{
 const globals=await text('app/globals.css');
 assert.match(globals,/visual-language-assets-8\.css";\n@import "\.\/ux-closeout-9\.css"/);
});

test('Sheet escapes transformed and backdrop-filter ancestors through a body portal',async()=>{
 const sheet=await text('components/ui/EnterpriseClient.tsx');
 const css=await text('app/ux-closeout-9.css');
 assert.match(sheet,/from 'react-dom'/);
 assert.match(sheet,/createPortal\(/);
 assert.match(sheet,/document\.body/);
 assert.match(sheet,/event\.key==='Escape'/);
 assert.match(sheet,/document\.body\.style\.overflow='hidden'/);
 assert.match(css,/height: 100dvh/);
 assert.match(css,/env\(safe-area-inset-top\)/);
 assert.match(css,/overscroll-behavior: contain/);
});

test('Phase 8 Masters remain the canonical service and ORBY paths',async()=>{
 const [catalog,config,cards]=await Promise.all([text('src/lib/services/catalog.ts'),text('src/config/site.ts'),text('components/account/ServiceCards.tsx')]);
 for(const asset of ['connected-business-master.webp','native-business-master.webp','madar-retail-master.webp'])assert.ok(catalog.includes(asset),asset);
 assert.match(config,/orbyMaster:'\/assets\/orby\/orby-master\.webp'/);
 assert.match(cards,/md-service-master-image/);
 assert.match(cards,/const imageSizes=compact\?/);
 assert.match(cards,/\bunoptimized\b/);
});

test('concept artwork uses the real MADAR illustration component rather than giant functional icons',async()=>{
 const [why,categories,about,illustration,css]=await Promise.all([
  text('components/home/WhyMadar.tsx'),text('components/home/Categories.tsx'),text('app/about/page.tsx'),text('components/ui/MadarIllustration.tsx'),text('app/ux-closeout-9.css')
 ]);
 assert.equal((why.match(/<MadarIllustration/g)||[]).length,1,'WhyMadar maps four runtime cards through the component');
 assert.equal((categories.match(/<MadarIllustration/g)||[]).length,1,'Categories maps four runtime cards through the component');
 assert.equal((about.match(/<MadarIllustration/g)||[]).length,4,'ORBY intro has four explicit concept illustrations');
 assert.match(illustration,/md-illustration-primary/);
 assert.match(illustration,/md-illustration-secondary/);
 assert.match(illustration,/md-illustration-node/);
 assert.match(illustration,/aria-hidden="true"/);
 assert.match(css,/Duotone Line \+ Geometric Minimal/);
 assert.doesNotMatch(about,/text-slate-|text-violet-|text-emerald-|border-violet-|from-violet-|to-emerald-/);
});

test('ORBY intro preserves the Master and has a direct chat CTA',async()=>{
 const about=await text('app/about/page.tsx');
 assert.match(about,/siteConfig\.assets\.orbyMaster/);
 assert.match(about,/sizes="\(max-width: 1023px\)/);
 assert.match(about,/\bunoptimized\b/);
 assert.match(about,/href="\/orby"[^>]*>ابدأ محادثة مع ORBY/);
});

test('ORBY mobile header keeps actions but provides a compact labelled new-chat control',async()=>{
 const [shell,css]=await Promise.all([text('components/orby/OrbyShell.tsx'),text('app/ux-closeout-9.css')]);
 assert.match(shell,/className="md-orby-new-chat"/);
 assert.match(shell,/aria-label="بدء محادثة ORBY جديدة"/);
 assert.match(css,/@media \(max-width: 430px\)/);
 assert.match(css,/\.md-orby-new-chat > span/);
 assert.match(css,/\.md-orby-header-copy > span \{ display: none; \}/);
});

test('ORBY composer treats Enter as newline and uses an explicit send action',async()=>{
 const chat=await text('components/orby/OrbyChat.tsx');
 assert.match(chat,/event\.ctrlKey\|\|event\.metaKey/);
 assert.match(chat,/Enter لسطر جديد/);
 assert.match(chat,/type="submit"/);
 assert.doesNotMatch(chat,/event\.key==='Enter'&&!event\.shiftKey/);
 assert.match(chat,/نسخ الرد/);
 assert.match(chat,/إعادة إنشاء الرد/);
});

test('Google sign-in has intentional icon/text alignment without touching auth routing',async()=>{
 const [button,css]=await Promise.all([text('components/auth/GoogleAuthButton.tsx'),text('app/ux-closeout-9.css')]);
 assert.match(button,/\/auth\/google\?next=/);
 assert.match(button,/md-google-mark/);
 assert.match(button,/md-google-label/);
 assert.match(css,/grid-template-columns: 2\.25rem minmax\(0,1fr\) 2\.25rem/);
 assert.match(css,/min-height: 3rem/);
});

test('account closeout exposes primary tasks first and collapses secondary detail',async()=>{
 const [account,css]=await Promise.all([text('app/account/page.tsx'),text('app/ux-closeout-9.css')]);
 assert.match(account,/md-account-primary-grid/);
 assert.match(account,/<details className="md-account-secondary">/);
 assert.match(account,/تفاصيل الحساب والنشاط/);
 assert.match(css,/\.md-service-grid\.is-compact \.md-service-card/);
 assert.match(css,/\.md-account-secondary-body/);
});

test('functional theme icons use the shared icon system',async()=>{
 const theme=await text('components/theme/ThemeToggle.tsx');
 assert.match(theme,/@\/components\/ui\/Icons/);
 assert.match(theme,/name="sun"/);
 assert.match(theme,/name="moon"/);
 assert.doesNotMatch(theme,/<svg/);
});

test('phase 9 adds no new dependency or parallel palette requirement',async()=>{
 const [pkg,css]=await Promise.all([text('package.json'),text('app/ux-closeout-9.css')]);
 assert.doesNotMatch(pkg,/heroicons|fortawesome|react-icons/);
 assert.doesNotMatch(css,/slate-|violet-|emerald-/i);
 assert.match(css,/var\(--md-/);
 assert.match(css,/forced-colors: active/);
 assert.match(css,/prefers-reduced-motion: reduce/);
});
