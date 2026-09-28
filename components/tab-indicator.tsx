"use client";

import { Tabs } from "@base-ui/react/tabs";

import { cn } from "@/lib/utils";

export function TabIndicator({ className }: { className: string }) {
  return (
    <Tabs.Indicator
      data-slot="tab-indicator"
      className={cn(
        "pointer-events-none absolute top-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) translate-y-(--active-tab-top) transition-[translate] duration-160 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
        className
      )}
    />
  );
}
