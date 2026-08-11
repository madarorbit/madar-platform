"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function resolveSurface(pathname: string) {
  if (pathname.startsWith("/retail")) return "retail";
  if (pathname.startsWith("/workspace")) return "workspace";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/account") || pathname.startsWith("/dashboard"))
    return "account";
  if (
    ["/login", "/register", "/forgot-password", "/reset-password"].some(
      (route) => pathname.startsWith(route),
    )
  )
    return "auth";
  return "public";
}

export default function RouteSurface() {
  const pathname = usePathname() || "/";
  useEffect(() => {
    const surface = resolveSurface(pathname);
    document.body.dataset.madarSurface = surface;
    return () => {
      delete document.body.dataset.madarSurface;
    };
  }, [pathname]);
  return null;
}
