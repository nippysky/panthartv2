// src/ui/IconButton.tsx
import * as React from "react";

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

export function IconButton({
  className = "",
  type,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type ?? "button"}
      {...props}
      className={cx(
        "inline-flex h-10 w-10 items-center justify-center rounded-full",
        "border border-border bg-card text-foreground",
        "hover:bg-background/60 active:scale-[0.99]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        className
      )}
    />
  );
}
