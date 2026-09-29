export const drawerContentClass =
  "mx-auto w-full max-w-xl motion-reduce:transition-none [&_[data-slot=drawer-footer]]:pt-4 [&_[data-slot=drawer-footer]]:pb-[calc(1rem+env(safe-area-inset-bottom))] dark:[&_[data-slot=drawer-swipe-handle]]:after:bg-muted-foreground/50";

export const selectionSpring = {
  type: "spring",
  duration: 0.45,
  bounce: 0,
} as const;
