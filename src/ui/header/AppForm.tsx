// src/ui/app/AppForm.tsx
import * as React from "react";

function cx(...cls: Array<string | false | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

export function AppField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-xs font-semibold text-foreground/90">
          {label}
        </label>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function AppInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-11 w-full rounded-2xl border border-border bg-background px-4",
        "text-sm text-foreground placeholder:text-muted",
        "outline-none transition",
        "focus:border-foreground/15 focus:ring-2 focus:ring-accent/35",
        props.className
      )}
    />
  );
}
