import type { SVGProps } from 'react';

export type IconName = 'home'|'store'|'search'|'user'|'arrow'|'sparkles'|'automation'|'chart'|'layers'|'shield'|'document'|'help'|'community'|'briefcase'|'code'|'megaphone'|'x'|'instagram'|'whatsapp'|'github'|'mail'|'check';

const paths: Record<IconName, React.ReactNode> = {
  home:<><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7"/></>,
  store:<><path d="M4 10v10h16V10M3 4h18l-1 6H4L3 4Z"/><path d="M8 14h8M9 20v-6"/></>,
  search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  user:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  arrow:<path d="m9 18 6-6-6-6"/>,
  sparkles:<><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></>,
  automation:<><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/><circle cx="12" cy="12" r="4"/></>,
  chart:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  layers:<><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
  shield:<><path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
  document:<><path d="M6 2h8l4 4v16H6V2Z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
  help:<><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.7 2.7 0 1 1 4.2 2.3c-1 .7-1.7 1.2-1.7 2.7M12 18h.01"/></>,
  community:<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2"/><path d="M3 20a6 6 0 0 1 12 0M15 15a5 5 0 0 1 6 5"/></>,
  briefcase:<><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/></>,
  code:<><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/></>,
  megaphone:<><path d="m3 11 14-6v14L3 13v-2Z"/><path d="M6 14v5h4l1-3M20 9v6"/></>,
  x:<path d="M4 3h4.7l4.2 5.6L17.7 3H20l-6 7.4L21 21h-4.7l-4.8-6.5L6 21H3.7l6.7-8.3L4 3Zm3.6 2 9.7 14h1.1L8.7 5H7.6Z"/>,
  instagram:<><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".7" fill="currentColor" stroke="none"/></>,
  whatsapp:<><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.4-4.7a8.5 8.5 0 1 1 16.1-4.1Z"/><path d="M8 7.8c.5 3.5 2.7 5.8 6.2 6.7l1.2-1.5c.2-.3.6-.4.9-.2l2 1"/></>,
  github:<><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7.4A5.7 5.7 0 0 0 19.3 3 5.4 5.4 0 0 0 19.1.9S17.9.5 15 2.4a14 14 0 0 0-6 0C6.1.5 4.9.9 4.9.9A5.4 5.4 0 0 0 4.7 3a5.7 5.7 0 0 0-1.5 4.1c0 5.8 3.5 7 6.8 7.4A4.8 4.8 0 0 0 9 18v4"/><path d="M9 19c-3 .9-3-1.5-4.2-2"/></>,
  mail:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  check:<path d="m5 12 4 4L19 6"/>,
};

export function Icon({name,className='h-5 w-5',...props}:{name:IconName;className?:string}&SVGProps<SVGSVGElement>){return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>}
