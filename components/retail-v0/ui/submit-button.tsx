"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";

export function SubmitButton({
  children,
  pendingLabel = "جارٍ الحفظ…",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const variant = className?.includes("button-secondary") ? "secondary" : className?.includes("button-danger") ? "danger" : "primary";
  const normalizedClassName = className?.replaceAll("button-primary", "").replaceAll("button-secondary", "").replaceAll("button-danger", "").trim();
  return (
    <button className={buttonClass(variant, "md", normalizedClassName)} type="submit" disabled={pending} aria-busy={pending || undefined}>
      {pending ? <Icon name="spinner" className="md-button-spinner" /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}
