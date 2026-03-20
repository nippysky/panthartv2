import { Clock3 } from "lucide-react";

type Props = {
  timeline: string[];
};

export default function TimelineCard({ timeline }: Props) {
  return (
    <div className="rounded-[30px] border border-border bg-background/80 p-5">
      <div className="mb-4 flex items-center gap-2 text-sm text-foreground/70">
        <Clock3 className="h-4 w-4 text-accent" />
        Timeline
      </div>

      <div className="space-y-3">
        {timeline.map((item, idx) => (
          <div
            key={idx}
            className="rounded-[22px] border border-border bg-card p-4 text-sm leading-6 text-foreground/62"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}