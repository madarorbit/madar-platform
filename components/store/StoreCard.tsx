import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/Icons";
import { arabicMoney } from "@/src/lib/arabic-display";
import type { StoreItem } from "@/src/lib/store/types";

const labels: Record<string, string> = {
  digital_product: "منتج رقمي",
  ready_system: "نظام جاهز",
  template: "قالب",
  service: "خدمة",
  subscription: "اشتراك",
  bundle: "باقة",
};
const availability: Record<string, string> = {
  available: "متاح",
  coming_soon: "قريبًا",
  sold_out: "نفد",
  disabled: "غير متاح",
};

export default function StoreCard({ item }: { item: StoreItem }) {
  const href =
    item.entityType === "product"
      ? `/products/${item.slug}`
      : item.entityType === "service"
        ? `/services/${item.slug}`
        : `/subscriptions/${item.slug}`;
  const action =
    item.entityType === "service"
      ? "اطلب الخدمة"
      : item.entityType === "plan"
        ? "اشترك"
        : "شراء";
  const state = item.availability;
  return (
    <article className="md-card md-card-interactive group flex h-full flex-col overflow-hidden p-0">
      <div className="md-store-card-media relative aspect-[16/10] overflow-hidden">
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt={`صورة ${item.name}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="md-store-card-placeholder absolute inset-0 grid place-items-center">
            <span className="md-store-card-placeholder-icon grid h-24 w-24 place-items-center rounded-3xl backdrop-blur">
              <Icon
                name={
                  item.entityType === "service"
                    ? "automation"
                    : item.entityType === "plan"
                      ? "sparkles"
                      : "layers"
                }
                className="h-12 w-12"
              />
            </span>
          </div>
        )}
        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
          <span className="md-badge md-store-media-badge">
            {labels[item.itemType] || labels[item.entityType] || "عنصر متجر"}
          </span>
          {state !== "available" && (
            <span className="md-badge md-store-media-status">
              <Icon name="warning" className="h-3.5 w-3.5" />
              {availability[state] || state}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="md-eyebrow">
          {item.subcategory?.name ||
            item.category?.name ||
            "متجر مَدار | ORBIT"}
        </p>
        <h2 className="md-type-h2 mt-2">
          <Link href={href}>{item.name}</Link>
        </h2>
        <p className="md-type-body md-muted mt-3 line-clamp-3 flex-1">
          {item.shortDescription}
        </p>
        <div className="md-type-caption md-muted mt-4 flex flex-wrap items-center gap-3">
          <span aria-label={`التقييم ${item.ratingAverage} من خمسة`}>
            ★ {item.ratingAverage.toFixed(1)}
          </span>
          <span>{item.ratingCount} تقييم</span>
        </div>
        <div className="md-store-card-footer mt-5 flex flex-wrap items-end justify-between gap-4 pt-5">
          <div>
            <strong className="md-store-price block text-xl">
              {item.isFree ? "مجاني" : arabicMoney(item.price, item.currency)}
            </strong>
            {item.compareAtPrice !== null &&
              item.compareAtPrice > item.price && (
                <del className="md-help">
                  {arabicMoney(item.compareAtPrice, item.currency)}
                </del>
              )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={href}
              className="md-button md-button-ghost md-button-sm"
            >
              التفاصيل
            </Link>
            <Link
              href={`${href}#purchase`}
              className="md-button md-button-primary md-button-sm"
            >
              {action}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}