import Link from "next/link";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

function DirectoryCard({
  title,
  text,
  href,
  eyebrow,
}: {
  title: string;
  text: string;
  href: string;
  eyebrow: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[28px] border border-border bg-card p-6 transition hover:bg-background/40 md:p-7"
    >
      <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
        {eyebrow}
      </div>

      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>

      <p className="mt-3 text-sm leading-6 text-muted md:text-base">{text}</p>

      <div className="mt-6 inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground">
        Open
      </div>
    </Link>
  );
}

export default async function WarpoolLandingPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="rounded-4xl border border-border bg-card p-6 md:p-8">
        <div className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Warpool Admin
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Comrades Warpool
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted md:text-base">
          A clean operator surface for Warpool. Use the sections below to inspect system
          health, prepare config proposals, manage shared multisig workflow, and monitor
          runtime recovery when needed.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DirectoryCard
          eyebrow="Overview"
          title="Overview"
          text="System health, registered contracts, indexed queue state, diagnostics, worker readiness, and the broader Warpool picture."
          href={`/admin/${slug}/warpool/overview`}
        />

        <DirectoryCard
          eyebrow="Config"
          title="Config"
          text="Adjust queue rules and global game settings, then save or submit clean multisig config proposals for future pools."
          href={`/admin/${slug}/warpool/config`}
        />

        <DirectoryCard
          eyebrow="Proposals"
          title="Proposals"
          text="Review stored admin proposals, see action progress, and let other multisig owners continue approval and execution safely."
          href={`/admin/${slug}/warpool/proposals`}
        />

        <DirectoryCard
          eyebrow="Runtime Monitor"
          title="Runtime Monitor"
          text="Observe live queue conditions, worker candidates, recovery needs, and runtime exceptions without mixing them into config governance."
          href={`/admin/${slug}/warpool/runtime`}
        />
      </div>
    </div>
  );
}