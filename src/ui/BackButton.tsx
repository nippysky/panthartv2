"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/src/ui/Button";

type Variant = "default" | "primary" | "secondary" | "outline" | "ghost" | "link" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

export function BackButton({
  className = "",
  label = "Back",
  fallbackHref = "/",
  variant = "ghost",
  size = "md",
}: {
  className?: string;
  label?: string;
  fallbackHref?: string;
  variant?: Variant;
  size?: Size;
}) {
  const router = useRouter();

  const goBack = React.useCallback(() => {
    // history-based back needs client runtime (this is the minimal client wrapper)
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }, [router, fallbackHref]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={goBack}
      className={className}
      aria-label="Go back"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
