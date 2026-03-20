import Link from "next/link";

type Props = {
  title: string;
  body: string;
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
};

export default function AsyncState({
  title,
  body,
  onRetry,
  backHref,
  backLabel,
}: Props) {
  return (
    <div className="rounded-[34px] border border-border bg-card/85 p-8 text-center shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)]">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-foreground/62 sm:text-base">
        {body}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition hover:scale-[1.01]"
          >
            Try again
          </button>
        ) : null}

        {backHref && backLabel ? (
          <Link
            href={backHref}
            className="rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition hover:bg-background"
          >
            {backLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}