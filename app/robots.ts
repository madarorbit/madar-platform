import type { MetadataRoute } from "next";
import { siteConfig } from "@/src/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/account/",
        "/workspace/",
        "/workspace-payment/",
        "/dashboard",
        "/onboarding",
        "/auth/",
        "/api/",
        "/checkout",
        "/cart",
        "/order-confirmation",
        "/payment/",
        "/forgot-password",
        "/reset-password",
        "/maintenance",
      ],
    },
    sitemap: `${siteConfig.baseUrl}/sitemap.xml`,
    host: siteConfig.baseUrl,
  };
}
