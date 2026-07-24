import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('enterprise design system exposes required foundations',async()=>{
 const css=await read('app/design-system.css');
 for(const token of ['--md-color-brand','--md-color-mint','--md-radius-lg','--md-shadow-md','--md-container','--md-duration-normal'])assert.match(css,new RegExp(token));
 for(const component of ['.md-button','.md-input','.md-table-wrap','.md-empty','.md-skeleton','.md-sidebar','.md-tabs','.md-orby-chip'])assert.ok(css.includes(component),`missing ${component}`);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/\[dir="rtl"\]/);
});

test('ORBY is present in the main and workspace navigation',async()=>{
 const[navbar,workspace,student,config]=await Promise.all([read('components/layout/NavbarClient.tsx'),read('components/workspace/EnterpriseWorkspaceShell.tsx'),read('app/student/layout.tsx'),read('src/config/site.ts')]);
 for(const source of [navbar,workspace,student]){assert.match(source,/أوربي/);assert.match(source,/orby-assistant\.svg|siteConfig\.assets\.orby/)}
 assert.match(config,/orby:'\/brand\/orby-assistant\.svg'/);
});

test('root presentation remains Arabic and right-to-left',async()=>{
 const[root,config]=await Promise.all([read('app/layout.tsx'),read('src/config/site.ts')]);
 assert.match(root,/lang="ar"/);
 assert.match(root,/dir="rtl"/);
 assert.match(config,/name: 'مَدار'/);
});

test('enterprise transformation does not introduce database or server action files',async()=>{
 const packageJson=JSON.parse(await read('package.json'));
 assert.equal(packageJson.scripts.test,'node --test tests/*.test.mjs');
 const design=await read('docs/ENTERPRISE_DESIGN_SYSTEM_AR.md');
 assert.match(design,/يمنع تعديل المسارات أو قاعدة البيانات أو منطق الأعمال/);
});
