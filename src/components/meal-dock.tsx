"use client";

import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useState } from "react";

import { DockLabel } from "@/components/dock-label";
import { ShareMealsButton } from "@/components/share-meals-button";
import { TabIndicator } from "@/components/tab-indicator";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hapticRef } from "@/lib/haptics";

const tabClass =
  "z-10 h-16 w-(--dock-item) flex-none rounded-full p-0 text-foreground transition-colors dark:text-foreground data-active:bg-transparent dark:data-active:bg-transparent dark:data-active:border-transparent group-data-[variant=default]/tabs-list:data-active:shadow-none";

export function MealDock({
  activeTab,
  selectionMode,
  onPlan,
  added,
  empty,
  shareText,
}: {
  activeTab: string;
  selectionMode: boolean;
  onPlan: () => void;
  added: boolean;
  empty: boolean;
  shareText: string;
}) {
  const hasSelection = selectionMode && !empty;
  const reducedMotion = useReducedMotion();
  // Keep outgoing content intact when the final meal is deselected.
  const [lastSelection, setLastSelection] = useState({ added, shareText });
  if (
    hasSelection &&
    (lastSelection.added !== added || lastSelection.shareText !== shareText)
  ) {
    setLastSelection({ added, shareText });
  }
  // One clock keeps the label, Share and dock geometry together on reversals.
  const progress = useSpring(Number(hasSelection), {
    stiffness: 500,
    damping: 45,
    restDelta: 0.001,
    restSpeed: 0.01,
  });
  const shareWidth = useMotionTemplate`calc(var(--dock-item) * ${progress})`;
  const groceriesOpacity = useTransform(progress, [0, 1], [1, 0]);
  const shareOpacity = useTransform(progress, [0, 0.25, 1], [0, 0, 1]);

  useEffect(() => {
    if (reducedMotion) {
      progress.jump(Number(hasSelection));
    } else {
      progress.set(Number(hasSelection));
    }
  }, [hasSelection, progress, reducedMotion]);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 flex justify-center">
      <nav
        aria-label="Kitchen"
        className="bg-background/95 pointer-events-auto relative flex w-fit items-center overflow-hidden rounded-[40px] border p-1.5 shadow-lg backdrop-blur-xl [--dock-item:min(6rem,calc((100vw-2rem)/3))]"
      >
        <TabsList
          activateOnFocus={false}
          className="relative isolate flex w-fit shrink-0 rounded-full bg-transparent p-0 group-data-horizontal/tabs:h-16"
          aria-label="Kitchen"
        >
          <TabIndicator className="bg-muted rounded-full" />
          <TabsTrigger
            ref={hapticRef}
            value="plan"
            className={tabClass}
            onClick={onPlan}
          >
            <DockLabel icon="plan" selected={activeTab === "plan"}>
              Plan
            </DockLabel>
          </TabsTrigger>
          <TabsTrigger
            ref={hapticRef}
            value="groceries"
            className={tabClass}
            disabled={hasSelection && added}
            aria-label={
              hasSelection
                ? added
                  ? "Already added"
                  : "Add to list"
                : "Groceries"
            }
          >
            <span className="grid place-items-center">
              <motion.span
                className="col-start-1 row-start-1"
                style={{ opacity: groceriesOpacity }}
                aria-hidden={hasSelection}
              >
                <DockLabel
                  icon="groceries"
                  selected={activeTab === "groceries"}
                >
                  Groceries
                </DockLabel>
              </motion.span>
              <motion.span
                className="col-start-1 row-start-1"
                style={{ opacity: progress }}
                aria-hidden={!hasSelection}
              >
                <DockLabel icon={lastSelection.added ? "done" : "add"}>
                  {lastSelection.added ? "Added" : "Add to list"}
                </DockLabel>
              </motion.span>
            </span>
          </TabsTrigger>
        </TabsList>
        <motion.div
          style={{ width: shareWidth, opacity: shareOpacity }}
          inert={!hasSelection}
          aria-hidden={!hasSelection}
          className="flex h-16 shrink-0 justify-center overflow-hidden"
        >
          <ShareMealsButton
            dock
            text={lastSelection.shareText}
            className="h-16 w-(--dock-item) shrink-0 rounded-full border border-transparent p-0 hover:bg-transparent active:not-aria-[haspopup]:translate-y-0"
          />
        </motion.div>
      </nav>
    </div>
  );
}
