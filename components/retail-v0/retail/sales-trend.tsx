import { formatMoney } from "@/src/lib/retail/format";

export function SalesTrend({
  data,
  currency,
}: {
  data: Array<{ day: string; revenue: number }>;
  currency: string;
}) {
  if (!data.length) return <p className="muted py-12 text-center text-sm">لا توجد نقاط زمنية في الفترة.</p>;
  const width = 800;
  const height = 260;
  const padding = 28;
  const max = Math.max(...data.map((item) => Number(item.revenue)), 1);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const points = data.map((item, index) => {
    const x = padding + (data.length === 1 ? usableWidth / 2 : (index / (data.length - 1)) * usableWidth);
    const y = padding + usableHeight - (Number(item.revenue) / max) * usableHeight;
    return { ...item, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="اتجاه صافي المبيعات خلال الفترة" className="h-auto w-full overflow-visible">
        {[0, 0.5, 1].map((ratio) => {
          const y = padding + usableHeight - ratio * usableHeight;
          return <line key={ratio} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#253140" strokeWidth="1" />;
        })}
        <path d={path} fill="none" stroke="#61f3c2" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point) => <circle key={point.day} cx={point.x} cy={point.y} r="5" fill="#070b10" stroke="#61f3c2" strokeWidth="3"><title>{point.day}: {formatMoney(point.revenue, currency)}</title></circle>)}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{data[0]?.day}</span><span>أعلى قيمة: {formatMoney(max, currency)}</span><span>{data.at(-1)?.day}</span></div>
    </div>
  );
}
