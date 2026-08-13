import { Notice } from "@/components/ui/Enterprise";

export function FlashMessage({
  success,
  error,
}: {
  success?: string;
  error?: string;
}) {
  const message = error ?? success;
  if (!message) return null;
  return <Notice title={message} variant={error ? "danger" : "success"} />;
}
