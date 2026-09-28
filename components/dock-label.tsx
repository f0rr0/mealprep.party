"use client";

import type { LucideIcon } from "lucide-react";

export function DockLabel({
  icon: Icon,
  children,
  iconClassName = "size-5",
}: {
  icon: LucideIcon;
  children: string;
  iconClassName?: string;
}) {
  return (
    <span className="flex flex-col items-center gap-1 text-xs/4">
      <span className="flex size-5 items-center justify-center">
        <Icon className={iconClassName} aria-hidden="true" />
      </span>
      <span>{children}</span>
    </span>
  );
}
