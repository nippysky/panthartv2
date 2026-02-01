"use client";

import React from "react";

export function Collapsible({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "grid transition-[grid-template-rows] duration-300 ease-out",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      ].join(" ")}
    >
      <div
        className={[
          "overflow-hidden",
          "transition-all duration-300 ease-out",
          open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
