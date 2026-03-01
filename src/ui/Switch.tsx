"use client";

import * as React from "react";

type Props = {
  checked: boolean;
  onCheckedChange?: (val: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className = "",
  "aria-label": ariaLabel = "Toggle",
}: Props) {
  const toggle = React.useCallback(() => {
    if (disabled) return;
    onCheckedChange?.(!checked);
  }, [disabled, onCheckedChange, checked]);

  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      onClick={toggle}
      onKeyDown={(e) => {
        // Make it feel native: Space/Enter toggles.
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border",
        "transition-colors duration-200 ease-out",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-[0.98]",
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
        checked
          ? "bg-foreground border-foreground/40"
          : "bg-foreground/10 border-border",
        className,
      ].join(" ")}
    >
      {/* Track shine (subtle depth) */}
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none absolute inset-0 rounded-full",
          checked
            ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
            : "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]",
        ].join(" ")}
      />

      {/* Thumb */}
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white",
          "shadow-[0_1px_2px_rgba(0,0,0,0.25)]",
          "transition-transform duration-200 ease-out will-change-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}