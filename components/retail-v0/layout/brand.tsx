import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/retail" className="inline-flex items-center gap-3" aria-label="MADAR Retail الرئيسية">
      <Image src="/brand/madar-logo.svg" width={34} height={34} alt="" priority />
      <span className="font-black tracking-tight">
        MADAR <span className="text-mint">Retail</span>
        {compact ? null : <small className="block text-[.62rem] font-semibold text-slate-400">من منظومة مَدار</small>}
      </span>
    </Link>
  );
}
