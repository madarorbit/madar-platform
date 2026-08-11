import "@/app/retail/retail.css";

export default function RetailAdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="madar-retail rounded-3xl p-1 sm:p-2">{children}</div>;
}
