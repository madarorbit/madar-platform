import type { SVGProps } from "react";

export type MadarIllustrationKind =
  | "operations"
  | "automation"
  | "intelligence"
  | "security"
  | "analysis"
  | "context";

export function illustrationKindFromIcon(icon: string): MadarIllustrationKind {
  if (icon === "automation") return "automation";
  if (icon === "sparkles") return "intelligence";
  if (icon === "shield") return "security";
  if (icon === "chart") return "analysis";
  if (icon === "document") return "context";
  return "operations";
}

function Nodes() {
  return <g className="md-illustration-node"><circle cx="16" cy="18" r="3"/><circle cx="82" cy="18" r="3"/><circle cx="82" cy="54" r="3"/></g>;
}

function Motif({kind}:{kind:MadarIllustrationKind}) {
  if (kind === "automation") return <>
    <g className="md-illustration-secondary"><path d="M18 36h18M60 24h18M60 48h18"/><path d="m31 31 6 5-6 5M73 19l6 5-6 5M73 43l6 5-6 5"/></g>
    <g className="md-illustration-primary"><circle cx="49" cy="36" r="11"/><path d="M43 30l12 12M55 30 43 42"/></g><Nodes/>
  </>;
  if (kind === "intelligence") return <>
    <g className="md-illustration-secondary"><path d="M18 52c11-15 20-20 31-20s20 5 31 20"/><path d="M27 21h44"/></g>
    <g className="md-illustration-primary"><path d="m49 14 4.2 12.8L66 31l-12.8 4.2L49 48l-4.2-12.8L32 31l12.8-4.2L49 14Z"/></g><Nodes/>
  </>;
  if (kind === "security") return <>
    <g className="md-illustration-secondary"><path d="M18 54h64M25 22h12M61 22h12"/><path d="M25 22v12M73 22v12"/></g>
    <g className="md-illustration-primary"><path d="M49 15 67 22v13c0 15-18 23-18 23S31 50 31 35V22l18-7Z"/><path d="m41 35 6 6 11-12"/></g><Nodes/>
  </>;
  if (kind === "analysis") return <>
    <g className="md-illustration-secondary"><path d="M19 55h61M26 48V36M41 48V25M56 48V31M71 48V19"/></g>
    <g className="md-illustration-primary"><path d="m24 31 16-10 15 5 18-13"/><circle cx="24" cy="31" r="3"/><circle cx="40" cy="21" r="3"/><circle cx="55" cy="26" r="3"/><circle cx="73" cy="13" r="3"/></g>
  </>;
  if (kind === "context") return <>
    <g className="md-illustration-secondary"><rect x="19" y="17" width="31" height="40" rx="6"/><path d="M27 29h15M27 37h15M27 45h10"/></g>
    <g className="md-illustration-primary"><circle cx="69" cy="36" r="14"/><path d="M69 28v16M61 36h16"/></g><Nodes/>
  </>;
  return <>
    <g className="md-illustration-secondary"><path d="m18 24 22-10 22 10-22 10-22-10Z"/><path d="m18 36 22 10 22-10M18 47l22 10 22-10"/></g>
    <g className="md-illustration-primary"><path d="M62 25h18v29H62"/><path d="m74 47 7 7-7 7"/></g><Nodes/>
  </>;
}

export function MadarIllustration({kind,className="",...props}:{kind:MadarIllustrationKind;className?:string}&SVGProps<SVGSVGElement>) {
  return <span className={`md-illustration ${className}`.trim()} aria-hidden="true">
    <svg viewBox="0 0 98 72" fill="none" focusable="false" {...props}>
      <rect className="md-illustration-frame" x="1" y="1" width="96" height="70" rx="18"/>
      <Motif kind={kind}/>
    </svg>
  </span>;
}
