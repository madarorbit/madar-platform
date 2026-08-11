import type { Metadata } from "next";
import "./retail.css";

export const metadata: Metadata = {
  title: { default: "MADAR Retail", template: "%s | MADAR Retail" },
  description: "نظام تشغيل ذكي وخفيف للتجارة الصغيرة داخل منصة مَدار.",
};

export default function RetailLayout({ children }: { children: React.ReactNode }) {
  return <div className="madar-retail min-h-screen">{children}</div>;
}
