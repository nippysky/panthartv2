"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={cn("text-sm font-medium text-foreground", className)}
    />
  );
}
