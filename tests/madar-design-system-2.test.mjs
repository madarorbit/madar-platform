import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('Design System 2 loads tokens before components and reference surfaces last',async()=>{
 const globals=await read('app/globals.css');
 const order=['design-tokens.css','design-system.css','theme-system.css','design-system-2-surfaces.css'].map(name=>globals.indexOf(name));
 assert.ok(order.every(index=>index>=0));
 assert.deepEqual([...order].sort((a,b)=>a-b),order);
});

test('semantic tokens cover themes, type, space, motion, elevation and charts',async()=>{
 const tokens=await read('app/design-tokens.css');
 for(const contract of ['--md-background:','--md-surface:','--md-text-primary:','--md-border-default:','--md-accent:','--md-success:','--md-type-display:','--md-space-4:','--md-radius-md:','--md-shadow-2:','--md-motion-normal:','--md-chart-1:'])assert.ok(tokens.includes(contract),contract);
 assert.match(tokens,/:root\[data-theme="light"\]/);
 assert.match(tokens,/:root\[data-theme="dark"\]/);
});

test('canonical primitives expose reusable layout, actions, forms and state components',async()=>{
 const [server,client]=await Promise.all([read('components/ui/Enterprise.tsx'),read('components/ui/EnterpriseClient.tsx')]);
 for(const name of ['PageContainer','PageHeader','Stack','Grid','Card','Button','IconButton','Avatar','Field','Input','StatusBadge','Table','EmptyState','ErrorState','SkeletonGroup'])assert.match(server,new RegExp(`export function ${name}`));
 for(const name of ['Menu','Sheet','Modal','Toast','ConfirmDialog'])assert.match(client,new RegExp(`export function ${name}`));
 assert.match(client,/aria-modal="true"/);
 assert.match(client,/event\.key==='Escape'/);
 assert.match(client,/returnFocusRef/);
});

test('theme persists light dark and system before hydration',async()=>{
 const [provider,layout,preferences]=await Promise.all([read('components/theme/ThemeProvider.tsx'),read('app/layout.tsx'),read('components/theme/ThemePreferences.tsx')]);
 for(const value of ['light','dark','system'])assert.match(`${provider}\n${preferences}`,new RegExp(`[\"']${value}[\"']`));
 assert.match(provider,/localStorage/);
 assert.match(layout,/dataset\.theme/);
 assert.match(layout,/matchMedia/);
});

test('reference surfaces consume the common system without changing domain APIs',async()=>{
 const paths=['components/home/Hero.tsx','components/account/ServiceCards.tsx','app/retail/workspace/page.tsx','components/orby/OrbyShell.tsx','components/orby/OrbyChat.tsx','components/auth/AuthForm.tsx'];
 const files=await Promise.all(paths.map(read));
 assert.match(files[0],/md-home-hero/);
 assert.match(files[1],/StatusBadge/);
 assert.match(files[2],/getAnalyticsSnapshot/);
 assert.match(files[3],/md-orby-shell/);
 assert.match(files[4],/data-voice-ready="true"/);
 assert.match(files[5],/Field/);
});

test('ORBY, cart and account controls meet shared visual and accessible contracts',async()=>{
 const [floating,chat,cart,actions]=await Promise.all([read('components/orby/OrbyFloatingFace.tsx'),read('components/orby/OrbyChat.tsx'),read('components/platform/CartStatusLink.tsx'),read('components/platform/GlobalUserActions.tsx')]);
 assert.match(floating,/md-orby-floating/);
 assert.match(chat,/aria-label="رسالتك إلى ORBY"/);
 assert.match(cart,/md-icon-badge/);
 assert.match(actions,/Avatar/);
 assert.match(actions,/Menu/);
});

test('responsive and reduced-motion contracts cover the reference breakpoints',async()=>{
 const surfaces=await read('app/design-system-2-surfaces.css');
 for(const breakpoint of ['1023px','767px','389px','1440px'])assert.ok(surfaces.includes(breakpoint));
 assert.match(surfaces,/prefers-reduced-motion: reduce/);
 assert.match(surfaces,/md-orby-mobile-sidebar-button/);
 assert.match(surfaces,/md-service-grid/);
});

test('component catalog is admin protected and documented as a migration contract',async()=>{
 const [layout,page,navigation,document]=await Promise.all([read('app/admin/layout.tsx'),read('app/admin/design-system/page.tsx'),read('src/lib/ux/navigation.ts'),read('docs/MADAR_DESIGN_SYSTEM_2.md')]);
 assert.match(layout,/requireAdmin/);
 assert.match(page,/DesignSystemShowcase/);
 assert.match(navigation,/\/admin\/design-system/);
 for(const section of ['Design tokens','Theme architecture','Component APIs','Responsive behavior','Accessibility baseline','Migration strategy','Known gaps'])assert.ok(document.includes(section),section);
});

test('shared money and date formatting has one Arabic-first entry point',async()=>{
 const format=await read('src/lib/format.ts');
 assert.match(format,/export function formatCurrency/);
 assert.match(format,/export function formatDate/);
 assert.match(format,/export function formatDateTime/);
 assert.match(format,/ar-YE/);
});
