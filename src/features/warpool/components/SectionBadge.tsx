import type { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  children: ReactNode;
};

export default function SectionBadge({ icon, children }: Props) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground/60">
      {icon}
      {children}
    </div>
  );
}