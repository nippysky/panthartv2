// app/not-found.tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { Container } from "@/src/ui/Container";

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] md:text-xs font-semibold",
        "ring-1 shadow-sm backdrop-blur-md",
        "bg-foreground text-background ring-black/10",
        "dark:bg-white/10 dark:text-white dark:ring-white/15"
      )}
    >
      {children}
    </span>
  );
}

function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "h-11 inline-flex items-center justify-center px-5 rounded-2xl font-semibold text-sm",
        "bg-foreground text-background",
        "hover:opacity-90 active:opacity-85",
        "focus:outline-none focus:ring-2 focus:ring-foreground/20"
      )}
    >
      {children}
    </Link>
  );
}

function GhostLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "h-11 inline-flex items-center justify-center px-5 rounded-2xl font-semibold text-sm",
        "border border-border bg-background/70 backdrop-blur",
        "hover:bg-background/90",
        "focus:outline-none focus:ring-2 focus:ring-foreground/10"
      )}
    >
      {children}
    </Link>
  );
}

export default function NotFound() {
  return (
    <Container size="xl" className="py-10 md:py-14">
      {/* Breadcrumb-ish hint (matches your pages) */}
      <nav className="mb-5 text-sm text-muted">
        <Link className="hover:underline" href="/">
          Home
        </Link>
        <span className="mx-2 opacity-60">/</span>
        <span className="text-foreground/80">404</span>
      </nav>

      <section className="relative overflow-hidden rounded-[28px] border border-border">
        {/* Premium background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(900px_320px_at_15%_10%,rgba(56,189,248,0.14),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(900px_320px_at_85%_90%,rgba(168,85,247,0.14),transparent_60%)]" />
          <div className="absolute inset-0 [background:linear-gradient(180deg,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0.03)_45%,rgba(0,0,0,0.06)_100%)] dark:[background:linear-gradient(180deg,rgba(0,0,0,0.65)_0%,rgba(0,0,0,0.30)_45%,rgba(0,0,0,0.65)_100%)]" />
        </div>

        <div className="relative p-6 md:p-10">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Pill>404</Pill>
              <span className="text-xs text-muted-foreground">
                Page not found
              </span>
            </div>

            <h1 className="mt-4 text-[1.8rem] md:text-[2.4rem] font-semibold tracking-tight leading-[1.1]">
              This page took a detour into the metaverse.
            </h1>

            <p className="mt-3 text-sm md:text-[15px] text-muted-foreground leading-relaxed max-w-[65ch]">
              The link may be broken, the page may have moved, or it might never
              have existed. Either way — you’re still in the right universe.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <PrimaryLink href="/">Back to Home</PrimaryLink>
              <GhostLink href="/minting-now">Explore Minting Now</GhostLink>
            </div>

            {/* Tiny helpful hints, kept clean */}
            <div className="mt-6 text-xs text-muted-foreground">
              Tip: Double-check the address, or use the navigation to find what
              you need.
            </div>
          </div>

          {/* Right-side “Apple-grade” ornament (subtle) */}
          <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2">
            <div className="relative h-40 w-40 rounded-4xl border border-border bg-background/60 backdrop-blur">
              <div className="absolute inset-0 rounded-4xl [background:radial-gradient(120px_120px_at_30%_25%,rgba(56,189,248,0.18),transparent_60%),radial-gradient(120px_120px_at_70%_75%,rgba(168,85,247,0.18),transparent_60%)]" />
              <div className="absolute inset-3 rounded-[26px] border border-border/70 bg-background/70" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="text-3xl font-semibold tabular-nums">404</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Not Found
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Container>
  );
}