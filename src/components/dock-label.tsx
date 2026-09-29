"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";

import { selectionSpring } from "@/lib/ui-styles";

import add from "../../public/illustrations/nav-add.webp";
import copy from "../../public/illustrations/nav-copy.webp";
import done from "../../public/illustrations/nav-done.webp";
import groceries from "../../public/illustrations/nav-groceries.webp";
import plan from "../../public/illustrations/nav-plan.webp";
import share from "../../public/illustrations/nav-share.webp";

const icons = { plan, groceries, add, done, share, copy };

export function DockLabel({
  icon,
  selected = false,
  children,
}: {
  icon: keyof typeof icons;
  selected?: boolean;
  children: string;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <span className="flex flex-col items-center text-xs/4">
      <motion.span
        initial={false}
        animate={{ scale: selected ? 1.1 : 1 }}
        transition={reducedMotion ? { duration: 0 } : selectionSpring}
        className="flex h-9 w-11 items-center justify-center"
      >
        <Image
          src={icons[icon]}
          alt=""
          width={44}
          height={36}
          sizes="44px"
          draggable={false}
          className="pointer-events-none h-9 w-11 object-contain"
          loading="eager"
        />
      </motion.span>
      <span>{children}</span>
    </span>
  );
}
