"use client";

import * as React from "react";

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

export default function CollectionDescription({
  text,
  className,
}: {
  text?: string | null;
  className?: string;
}) {
  const raw = (text ?? "").trim();
  const [expanded, setExpanded] = React.useState(false);

  // Simple + reliable toggle heuristic (no layout measuring needed)
  const canToggle = raw.length > 140;

  if (!raw) {
    return (
      <p className={cx("mt-3 text-sm leading-relaxed text-muted-foreground", className)}>
        —
      </p>
    );
  }

  return (
    <div className={cx("mt-3", className)}>
      <p
        className={cx(
          "text-sm leading-relaxed text-muted-foreground",
          // On mobile we show a little more before truncating
          !expanded && canToggle && "line-clamp-4 sm:line-clamp-2"
        )}
      >
        {raw}
      </p>

      {canToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center text-xs font-semibold text-foreground/85 underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground/40"
          aria-expanded={expanded}
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}
