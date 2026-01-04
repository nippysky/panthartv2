// src/ui/Button.tsx
import Link from "next/link";
import * as React from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium cursor-pointer" +
  "transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-background border border-primary " +
    "shadow-[0_12px_40px_color-mix(in_oklab,var(--accent)_20%,transparent)] " +
    "hover:opacity-[0.96]",
  secondary:
    "bg-card text-foreground border border-border " +
    "hover:border-foreground/20 hover:bg-card/80",
  ghost:
    "bg-transparent text-foreground border border-transparent " +
    "hover:bg-foreground/5",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  href,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  href?: string;
}) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {props.children}
      </Link>
    );
  }

  return <button {...props} className={cls} />;
}
