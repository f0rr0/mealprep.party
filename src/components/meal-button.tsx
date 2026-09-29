"use client";

import { CheckIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { hapticRef } from "@/lib/haptics";
import type { PlanEntry } from "@/lib/model";
import { selectionSpring } from "@/lib/ui-styles";
import { cn } from "@/lib/utils";

import breakfast from "../../public/illustrations/breakfast-setting.webp";
import dinner from "../../public/illustrations/dinner-setting.webp";
import lunch from "../../public/illustrations/lunch-setting.webp";
import snack from "../../public/illustrations/snack-setting.webp";

const illustrations = {
  Breakfast: { image: breakfast, surface: "#fff2cf", ink: "#30291e" },
  Lunch: { image: lunch, surface: "#e8efdc", ink: "#293025" },
  Snack: { image: snack, surface: "#f9e1d4", ink: "#382920" },
  Dinner: { image: dinner, surface: "#26374d", ink: "#fff7e8" },
};

const textMotion = {
  enter: (direction: number) => ({ opacity: 0, y: direction * 16 }),
  visible: { opacity: 1, y: 0 },
  exit: (direction: number) => ({
    opacity: 0,
    y: direction * -12,
    transition: {
      duration: direction ? 0.2 : 0,
      opacity: { duration: direction ? 0.16 : 0, delay: 0 },
    },
  }),
};

export function MealButton({
  title,
  members,
  slot,
  direction,
  selecting,
  selected,
  onOpen,
  onSelect,
  onLongPress,
}: {
  title: string;
  members: { id: string; name: string }[];
  slot: PlanEntry["slot"];
  direction: number;
  selecting: boolean;
  selected: boolean;
  onOpen: () => void;
  onSelect: () => void;
  onLongPress: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const illustration = illustrations[slot];
  const checked = selecting && selected;
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
      className="relative isolate h-28 min-h-28 w-full shrink-0 touch-pan-y justify-start overflow-hidden rounded-xl border-0 bg-(--meal-surface) px-4 text-left whitespace-normal text-(--meal-ink) [-webkit-touch-callout:none] hover:bg-(--meal-surface) hover:text-(--meal-ink) active:not-aria-[haspopup]:translate-y-0 dark:bg-(--meal-surface) dark:hover:bg-(--meal-surface)"
      style={
        {
          "--meal-surface": illustration.surface,
          "--meal-ink": illustration.ink,
        } as CSSProperties
      }
      aria-label={`${selecting ? "Select" : "Open"} ${title} for ${members.map((member) => member.name).join(" & ")}`}
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
      <motion.span
        className="pointer-events-none absolute inset-0 origin-right"
        initial={false}
        animate={{ scale: checked ? 1.1 : 1 }}
        transition={reducedMotion ? { duration: 0 } : selectionSpring}
      >
        <Image
          src={illustration.image}
          alt=""
          fill
          sizes="(max-width: 640px) calc(100vw - 32px), 608px"
          draggable={false}
          className="object-cover"
        />
      </motion.span>
      <motion.span
        layout={reducedMotion ? false : "position"}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        className="relative flex w-3/5 min-w-0 flex-col gap-1"
      >
        <span className="text-sm/6 font-normal opacity-75">{slot}</span>
        <FadingText
          text={title}
          direction={direction}
          className="text-base/6"
        />
      </motion.span>
      <motion.span
        aria-hidden="true"
        initial={false}
        animate={{ opacity: selecting ? 1 : 0, scale: selecting ? 1 : 0.8 }}
        transition={{
          duration: reducedMotion ? 0 : 0.16,
          ease: [0.2, 0, 0, 1],
        }}
        className={cn(
          "pointer-events-none absolute right-3 bottom-3 flex size-6 items-center justify-center rounded-full border shadow-sm transition-colors duration-150 motion-reduce:transition-none",
          checked
            ? "border-transparent bg-(--meal-ink) text-(--meal-surface)"
            : "border-(--meal-ink)/40 bg-(--meal-surface) text-(--meal-ink)"
        )}
      >
        <CheckIcon className={cn(!checked && "opacity-0")} />
      </motion.span>
    </Button>
  );
}

function FadingText({
  text,
  direction,
  className,
}: {
  text: string;
  direction: number;
  className: string;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <span className={cn("relative block overflow-hidden", className)}>
      <span className="invisible line-clamp-2" aria-hidden="true">
        {text}
      </span>
      <span className="sr-only">{text}</span>
      <AnimatePresence initial={false} custom={reducedMotion ? 0 : direction}>
        <motion.span
          key={text}
          aria-hidden="true"
          className="absolute inset-x-0 top-0"
          custom={reducedMotion ? 0 : direction}
          variants={textMotion}
          initial="enter"
          animate="visible"
          exit="exit"
          transition={
            reducedMotion
              ? { duration: 0 }
              : {
                  duration: 0.4,
                  ease: [0.2, 0, 0, 1],
                  opacity: {
                    duration: 0.34,
                    delay: 0.06,
                    ease: [0.4, 0, 0.2, 1],
                  },
                }
          }
        >
          <span className="line-clamp-2">{text}</span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
