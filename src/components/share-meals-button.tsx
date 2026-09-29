"use client";

import { CheckIcon, ShareIcon } from "lucide-react";
import { useState } from "react";

import { DockLabel } from "@/components/dock-label";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";
import { hapticRef } from "@/lib/haptics";
import { shareText } from "@/lib/share";
import { drawerContentClass } from "@/lib/ui-styles";
import { cn } from "@/lib/utils";

export function ShareMealsButton({
  text,
  className,
  dock = false,
}: {
  text: string;
  className?: string;
  dock?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const { copied, markCopied } = useCopyFeedback(text);
  const [manual, setManual] = useState(false);
  return (
    <>
      <Button
        ref={hapticRef}
        variant={dock ? "ghost" : "default"}
        className={cn(!dock && "hover:bg-primary", className)}
        disabled={!text || busy}
        aria-label={copied ? "Meals copied" : "Share meals"}
        onClick={async () => {
          setBusy(true);
          const result = await shareText(text);
          setBusy(false);
          if (result === "copied") {
            markCopied();
          }
          if (result === "manual") {
            setManual(true);
          }
        }}
      >
        {dock ? (
          <DockLabel icon={copied ? "copy" : "share"}>
            {copied ? "Copied" : "Share"}
          </DockLabel>
        ) : (
          <>
            {copied ? (
              <CheckIcon aria-hidden="true" data-icon="inline-start" />
            ) : (
              <ShareIcon aria-hidden="true" data-icon="inline-start" />
            )}
            {copied ? "Copied" : "Share"}
          </>
        )}
      </Button>
      <Drawer open={manual} onOpenChange={setManual} showSwipeHandle>
        <DrawerContent className={drawerContentClass}>
          <DrawerHeader>
            <DrawerTitle className="text-center">Share meals</DrawerTitle>
            <DrawerDescription>Select and copy.</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Textarea
              aria-label="Meals to share"
              readOnly
              rows={10}
              value={text}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
