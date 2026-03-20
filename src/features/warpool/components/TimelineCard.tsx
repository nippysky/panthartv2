import { Clock3 } from "lucide-react";
import type { WarpoolTimelineItem } from "@/src/features/warpool/types";

type Props = {
  timeline: WarpoolTimelineItem[];
};

export default function TimelineCard({ timeline }: Props) {
  return (
    <div className="rounded-[30px] border border-border bg-background/80 p-5">
      <div className="mb-4 flex items-center gap-2 text-sm text-foreground/70">
        <Clock3 className="h-4 w-4 text-accent" />
        Timeline
      </div>

      {timeline.length === 0 ? (
        <div className="rounded-[22px] border border-border bg-card p-4 text-sm text-foreground/60">
          No activity has been indexed for this pool yet.
        </div>
      ) : (
        <div className="space-y-3">
          {timeline.map((item) => (
            <div
              key={item.id}
              className="rounded-[22px] border border-border bg-card p-4"
            >
              <div className="text-sm leading-6 text-foreground/72">{item.label}</div>
              <div className="mt-1 text-xs text-foreground/45">{item.time}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}