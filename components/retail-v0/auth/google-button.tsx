import Link from "next/link";

export function GoogleButton({ next = "/retail/workspace" }: { next?: string }) {
  return (
    <Link className="button-secondary w-full" href={`/auth/google?next=${encodeURIComponent(next)}`}>
      المتابعة بواسطة Google
    </Link>
  );
}
