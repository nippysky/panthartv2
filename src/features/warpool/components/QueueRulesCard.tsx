import { Lock } from "lucide-react";

type Props = {
  rules: string[];
};

export default function QueueRulesCard({ rules }: Props) {
  return (
    <div className="rounded-[34px] border border-border bg-card/85 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] backdrop-blur dark:shadow-[0_20px_80px_rgba(0,0,0,0.30)]">
      <div className="mb-4 flex items-center gap-2 text-sm text-foreground/70">
        <Lock className="h-4 w-4 text-accent" />
        Battle rules
      </div>

      <div className="space-y-3">
        {rules.map((rule, idx) => (
          <div
            key={idx}
            className="rounded-[22px] border border-border bg-background/80 p-4 text-sm leading-6 text-foreground/62"
          >
            {rule}
          </div>
        ))}
      </div>
    </div>
  );
}