import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('ORBY 6 is chat-first without a mode selector',async()=>{
 const[chat,sidebar]=await Promise.all([read('components/orby/OrbyChat.tsx'),read('components/orby/OrbyConversationSidebar.tsx')]);
 assert.match(chat,/اكتب لأوربي/);
 assert.ok(chat.includes('/api/orby/stream'));
 assert.doesNotMatch(chat,/setMode|modeButtons|body\.mode|Mode selector/);
 assert.match(sidebar,/يمكنك طلب الشيء نفسه بكتابته طبيعيًا/);
});

test('composer streams, stops, retries, handles offline and respects Arabic IME',async()=>{
 const chat=await read('components/orby/OrbyChat.tsx');
 for(const pattern of [/AbortController/,/function stop/,/function retry/,/event\.nativeEvent\.isComposing/,/navigator\.onLine/,/online/,/aria-busy/,/md-orby-latest/,/scrollToLatest/])assert.match(chat,pattern);
 assert.match(chat,/data-voice-ready="true"/);
 assert.doesNotMatch(chat,/label="تسجيل صوت|<Icon name="mic"/);
});

test('ORBY markdown is safe, responsive and code remains LTR',async()=>{
 const[markdown,css]=await Promise.all([read('components/orby/OrbyMarkdown.tsx'),read('app/orby-experience-6.css')]);
 for(const pattern of [/safeHref/,/http:/,/https:/,/mailto:/,/blockquote/,/md-orby-table-wrap/,/md-orby-code-block/,/navigator\.clipboard/])assert.match(markdown,pattern);
 assert.match(markdown,/dir="ltr"/);
 assert.match(css,/\.md-orby-table-wrap/);
 assert.match(css,/overflow-x: auto/);
});

test('history is owned, bounded and grouped for responsive use',async()=>{
 const[page,sidebar,api]=await Promise.all([read('app/orby/page.tsx'),read('components/orby/OrbyConversationSidebar.tsx'),read('app/api/orby/conversations/route.ts')]);
 assert.match(page,/user_id=eq/);
 assert.match(page,/limit=201/);
 assert.match(page,/slice\(0, 200\)\.reverse/);
 assert.match(sidebar,/هذا الأسبوع/);
 assert.match(sidebar,/ConfirmDialog/);
 assert.match(api,/user_id=eq/);
});

test('guest new chat resets ephemeral UI without resetting the server quota',async()=>{
 const[shell,page]=await Promise.all([read('components/orby/OrbyShell.tsx'),read('app/orby/page.tsx')]);
 assert.match(shell,/conversation=new&session=/);
 assert.match(shell,/crypto\.randomUUID/);
 assert.match(page,/params\.session/);
 assert.match(page,/initialRemaining=\{5\}/);
});

test('service context is checked before account quota is consumed',async()=>{
 const stream=await read('app/api/orby/stream/route.ts');
 const contextFailure=stream.indexOf("ORBY_CONTEXT_UNAVAILABLE");
 const quotaReservation=stream.indexOf("consume_orby_account_quota");
 assert.ok(contextFailure>0&&quotaReservation>contextFailure,'account quota must be reserved after scoped context succeeds');
 assert.match(stream,/activeScope/);
 assert.match(stream,/resolveConversationScope/);
 assert.match(stream,/user_id=eq/);
 assert.match(stream,/request\.signal/);
});

test('Plus uses the unified shell, semantic system and database pricing',async()=>{
 const[page,checkout]=await Promise.all([read('app/orby/plus/page.tsx'),read('components/orby/OrbyPlusCheckout.tsx')]);
 assert.match(page,/OrbyShell/);
 assert.match(page,/subscription_plans/);
 assert.match(page,/exchange_rates/);
 assert.match(page,/payment_methods/);
 assert.doesNotMatch(page,/#(?:[0-9a-f]{3}){1,2}/i);
 assert.match(checkout,/Field/);
 assert.match(checkout,/Select/);
 assert.match(checkout,/Notice/);
 assert.doesNotMatch(checkout,/border-white|text-slate|bg-\[/);
});

test('ORBY 6 documentation states real capabilities and deliberate gaps',async()=>{
 const docs=await read('docs/ORBY_EXPERIENCE_6.md');
 for(const text of ['Chat architecture','Guest','Registered Free','ORBY Plus','Context model','Voice input','Mobile Translation Notes','Known gaps'])assert.match(docs,new RegExp(text));
 assert.match(docs,/غير مفعّل في Web/);
 assert.match(docs,/أحدث 200 رسالة/);
});
