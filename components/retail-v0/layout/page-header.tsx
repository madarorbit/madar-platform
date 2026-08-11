export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">{title}</h1>
        {description ? <p className="muted mt-1 max-w-2xl text-sm leading-6">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}
