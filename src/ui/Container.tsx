// src/ui/Container.tsx
import * as React from "react";

type ContainerSize = "md" | "lg" | "xl" | "full";

const sizes: Record<ContainerSize, string> = {
  md: "max-w-6xl",
  lg: "max-w-7xl",
  // Responsive width cap: roomy on big screens, not silly on smaller ones
  xl: "max-w-7xl 2xl:max-w-[88rem]",
  full: "max-w-none",
};

export function Container({
  children,
  className = "",
  size = "xl",
}: {
  children: React.ReactNode;
  className?: string;
  size?: ContainerSize;
}) {
  return (
    <div className={`mx-auto w-full ${sizes[size]} px-4 sm:px-6 ${className}`}>
      {children}
    </div>
  );
}
