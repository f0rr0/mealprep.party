"use client";

import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { hapticRef } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export function MealButton({
  title,
  label,
  selecting,
  selected,
  onOpen,
  onSelect,
  onLongPress,
}: {
  title: string;
  label: string;
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  onSelect: () => void;
  onLongPress: () => void;
}) {
  const press = useRef<{
    timer?: ReturnType<typeof setTimeout>;
    x: number;
    y: number;
    handled: boolean;
    active: boolean;
  }>({ x: 0, y: 0, handled: false, active: false });
  function cancel() {
    clearTimeout(press.current.timer);
  }
  useEffect(() => () => clearTimeout(press.current.timer), []);
  return (
    <Button
      ref={hapticRef}
      variant="outline"
      className="aria-pressed:bg-secondary aria-pressed:hover:bg-secondary h-20 min-h-20 w-full shrink-0 touch-pan-y justify-between gap-4 rounded-xl px-4 text-left whitespace-normal transition-colors [-webkit-touch-callout:none] active:not-aria-[haspopup]:translate-y-0"
      aria-label={`${selecting ? "Select" : "Open"} ${title}`}
      aria-pressed={selecting ? selected : undefined}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) {
          return;
        }
        cancel();
        press.current = {
          x: event.clientX,
          y: event.clientY,
          handled: false,
          active: true,
        };
        if (!selecting) {
          press.current.timer = setTimeout(() => {
            press.current.handled = true;
            onLongPress();
          }, 450);
        }
      }}
      onPointerMove={(event) => {
        if (
          press.current.active &&
          Math.hypot(
            event.clientX - press.current.x,
            event.clientY - press.current.y
          ) > 8
        ) {
          press.current.handled = true;
          cancel();
        }
      }}
      onPointerUp={() => {
        cancel();
        press.current.active = false;
      }}
      onPointerCancel={() => {
        cancel();
        press.current.active = false;
        press.current.handled = true;
      }}
      onPointerLeave={() => {
        cancel();
        if (press.current.active) {
          press.current.handled = true;
        }
        press.current.active = false;
      }}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        cancel();
        if (event.detail > 0 && press.current.handled) {
          press.current.handled = false;
          return;
        }
        press.current.handled = false;
        if (selecting) {
          onSelect();
        } else {
          onOpen();
        }
      }}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-muted-foreground font-normal">{label}</span>
        <span className="line-clamp-2">{title}</span>
      </span>
      <span className={cn("flex size-4 shrink-0", !selecting && "invisible")}>
        {selected ? <CheckCircle2Icon /> : <CircleIcon />}
      </span>
    </Button>
  );
}
