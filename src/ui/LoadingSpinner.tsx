// src/ui/app/LoadingSpinner.tsx
import * as React from "react";

export function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80 ${className}`}
      aria-hidden="true"
    />
  );
}
