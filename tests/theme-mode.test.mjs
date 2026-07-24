import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('theme is initialized before the interface renders',async()=>{
 const layout=await read('app/layout.tsx');
 assert.match(layout,/madar-theme/);
 assert.match(layout,/prefers-color-scheme: light/);
 assert.match(layout,/suppressHydrationWarning/);
 assert.match(layout,/dangerouslySetInnerHTML/);
});

test('light and dark themes use the enterprise design tokens',async()=>{
 const css=await read('app/theme.css');
 assert.match(css,/:root\[data-theme="light"\]/);
 assert.match(css,/--md-color-bg: #f5f7fb/);
 assert.match(css,/--md-color-brand: #6c3bff/);
 assert.match(css,/--md-color-mint: #00a98f/);
 assert.match(css,/transition-duration: 300ms/);
 assert.match(css,/md-theme-toggle/);
});

test('authenticated navigation exposes the theme toggle',async()=>{
 const navbar=await read('components/layout/NavbarClient.tsx');
 const toggle=await read('components/theme/ThemeToggle.tsx');
 assert.match(navbar,/ThemeToggle/);
 assert.match(navbar,/authenticated\?<><ThemeToggle compact\/>/);
 assert.match(toggle,/localStorage\.setItem\(STORAGE_KEY,theme\)/);
 assert.match(toggle,/md-theme-icon-sun/);
 assert.match(toggle,/md-theme-icon-moon/);
});
