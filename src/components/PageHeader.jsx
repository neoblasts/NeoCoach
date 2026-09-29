export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-base text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
