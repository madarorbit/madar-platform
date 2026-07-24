import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('theme is applied before hydration and stored for later visits',async()=>{
 const[root,provider]=await Promise.all([read('app/layout.tsx'),read('components/theme/ThemeProvider.tsx')]);
 assert.match(root,/madar-theme/);
 assert.match(root,/suppressHydrationWarning/);
 assert.match(root,/ThemeProvider/);
 assert.match(provider,/localStorage\.setItem\(STORAGE_KEY,theme\)/);
 assert.match(provider,/prefers-color-scheme: dark/);
 assert.match(provider,/md-theme-transition/);
});

test('light and dark tokens cover the enterprise design system',async()=>{
 const css=await read('app/theme-system.css');
 assert.match(css,/:root\[data-theme="light"\]/);
 assert.match(css,/:root\[data-theme="dark"\]/);
 for(const token of ['--md-color-bg','--md-color-surface','--md-color-text','--md-color-brand','--md-color-mint','--md-shadow-md'])assert.ok(css.includes(token),`missing ${token}`);
 assert.match(css,/transition-duration: 300ms/);
 assert.match(css,/\.md-theme-toggle-sun/);
 assert.match(css,/\.md-theme-toggle-moon/);
 assert.match(css,/\.md-chart/);
 assert.match(css,/\.md-footer/);
});

test('public and authenticated navigation shells expose the theme toggle',async()=>{
 const[navbar,admin,workspace]=await Promise.all([read('components/layout/NavbarClient.tsx'),read('components/admin/EnterpriseAdminShell.tsx'),read('components/workspace/EnterpriseWorkspaceShell.tsx')]);
 assert.doesNotMatch(navbar,/authenticated&&<ThemeToggle/);
 assert.equal((navbar.match(/<ThemeToggle\/>/g)||[]).length,2,'desktop and mobile navigation must always expose the toggle');
 assert.match(admin,/<ThemeToggle\/>/);
 assert.match(workspace,/<ThemeToggle\/>/);
});
