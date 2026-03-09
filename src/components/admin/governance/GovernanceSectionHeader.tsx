// app/(admin)/[slug]/governance/_components/GovernanceSectionHeader.tsx
type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export default function GovernanceSectionHeader({
  eyebrow = "Governance",
  title,
  description,
}: Props) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          {description}
        </p>
      ) : null}
    </section>
  );
}