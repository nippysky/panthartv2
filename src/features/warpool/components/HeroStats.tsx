import type { ReactNode } from "react";

type HeroStatsProps = {
  icon: ReactNode;
  title: string;
  body: string;
};

export default function HeroStats({ icon, title, body }: HeroStatsProps) {
  return (
    <div className="rounded-[26px] border border-border bg-card/85 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.03)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.22)]">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-background text-accent">
        {icon}
      </div>
      <div className="text-2xl font-semibold">{title}</div>
      <p className="mt-1 text-sm text-foreground/60">{body}</p>
    </div>
  );
}