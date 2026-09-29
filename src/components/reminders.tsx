"use client";

import { cn } from "cn";
import {
  BellIcon,
  ChevronDownIcon,
  ShareIcon,
  SquarePlusIcon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { hapticRef } from "@/lib/haptics";
import { claimPrompt } from "@/lib/prompts";
import { drawerContentClass } from "@/lib/ui-styles";

import appIcon from "../../public/app-icon.png";

const PROMPT_IDLE_DELAY_MS = 8000;

async function saveReminder(body: object) {
  const response = await fetch("/api/reminders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error("Notification request failed");
  }
  return response.json() as Promise<{ enabled: boolean }>;
}

type Status =
  | "loading"
  | "install"
  | "unsupported"
  | "unavailable"
  | "ready"
  | "blocked"
  | "error";

export function Reminders() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const publicKey = useRef("");

  useEffect(() => {
    if (
      (status !== "install" && (status !== "ready" || enabled)) ||
      open ||
      busy ||
      (permission !== null && permission !== "default") ||
      !window.isSecureContext ||
      window.self !== window.top ||
      (status === "install" &&
        (!/Version\/[\d.]+.*Safari\//u.test(navigator.userAgent) ||
          /FBAN|FBAV|Instagram|GSA\//u.test(navigator.userAgent)))
    ) {
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      clearTimeout(timer);
      if (document.visibilityState !== "visible") {
        return;
      }
      timer = setTimeout(() => {
        if (
          document.visibilityState === "visible" &&
          (status === "install"
            ? !window.matchMedia("(display-mode: standalone)").matches
            : Notification.permission === "default") &&
          !document.querySelector('[role="dialog"], [role="alertdialog"]') &&
          claimPrompt(status === "install" ? "home-screen" : "notifications")
        ) {
          setOpen(true);
        }
      }, PROMPT_IDLE_DELAY_MS);
    }
    schedule();
    document.addEventListener("visibilitychange", schedule);
    document.addEventListener("pointerup", schedule, { passive: true });
    document.addEventListener("keydown", schedule);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
      document.removeEventListener("pointerup", schedule);
      document.removeEventListener("keydown", schedule);
    };
  }, [status, open, enabled, busy, permission]);

  useEffect(() => {
    if (busy) {
      return;
    }
    function refresh() {
      if (document.visibilityState === "visible") {
        setStatus("loading");
        setError("");
      }
    }
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [busy]);

  useEffect(() => {
    if (status !== "loading") {
      return;
    }
    let active = true;
    async function load() {
      setPermission("Notification" in window ? Notification.permission : null);
      const ios =
        /iPad|iPhone|iPod/u.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone;
      if (ios && !standalone) {
        setStatus("install");
        return;
      }
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("blocked");
        return;
      }
      try {
        const response = await fetch("/api/reminders", {
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          throw new Error("Couldn’t load reminders.");
        }
        const config = (await response.json()) as { publicKey: string | null };
        if (!active) {
          return;
        }
        if (!config.publicKey) {
          setStatus("unavailable");
          return;
        }
        publicKey.current = config.publicKey;
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        const worker = await navigator.serviceWorker.ready;
        const subscription = await worker.pushManager.getSubscription();
        const saved = subscription
          ? await saveReminder({
              action: "status",
              endpoint: subscription.endpoint,
            })
          : { enabled: false };
        if (active) {
          registration.current = worker;
          setEnabled(saved.enabled);
          setStatus("ready");
        }
      } catch {
        if (active) {
          setStatus("error");
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [status]);

  async function toggle() {
    if (!registration.current) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Ask directly from the tap, before any network or service-worker awaits.
      if (!enabled) {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== "default") {
          setOpen(false);
        }
        if (result !== "granted") {
          if (result === "denied") {
            setStatus("blocked");
          }
          return;
        }
      }
      let subscription =
        await registration.current.pushManager.getSubscription();
      if (enabled) {
        if (subscription) {
          await saveReminder({
            action: "unsubscribe",
            endpoint: subscription.endpoint,
          });
          setEnabled(false);
          await subscription.unsubscribe();
        } else {
          setEnabled(false);
        }
      } else {
        subscription ??= await registration.current.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey.current,
        });
        await saveReminder({
          action: "subscribe",
          subscription: subscription.toJSON(),
        });
        setEnabled(true);
        setOpen(false);
      }
    } catch {
      setError("Couldn’t update notifications.");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (status === "install" || status === "ready") {
          claimPrompt(status === "install" ? "home-screen" : "notifications");
        }
        if (nextOpen) {
          setStatus("loading");
          setError("");
        }
      }}
      showSwipeHandle
    >
      {(permission === "default" ||
        (permission === null && status === "install")) && (
        <DrawerTrigger
          render={
            <Button
              ref={hapticRef}
              variant="ghost"
              size="icon-lg"
              className="size-11 rounded-full"
            />
          }
          aria-label="Notifications"
        >
          <BellIcon />
        </DrawerTrigger>
      )}
      <DrawerContent className={drawerContentClass}>
        <DrawerHeader>
          <DrawerTitle className="text-center text-lg/6">
            {status === "install" ? "Add to Home Screen" : "Notifications"}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Manage notifications on this device.
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-base/6">
          {status === "install" && (
            <ol className="flex flex-col gap-6 py-4">
              <li className="flex items-center gap-4">
                <span
                  className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-xl"
                  aria-hidden="true"
                >
                  <ShareIcon className="size-6" />
                </span>
                <div>
                  <p className="font-medium text-pretty">1. Share in Safari</p>
                  <p className="text-muted-foreground text-sm/5">
                    Tap Share, or open the ••• menu first.
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <span
                  className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-xl"
                  aria-hidden="true"
                >
                  <ChevronDownIcon className="size-6" />
                </span>
                <div>
                  <p className="font-medium text-pretty">2. View More</p>
                  <p className="text-muted-foreground text-sm/5">
                    In the Share menu, tap View More if shown.
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <span
                  className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-xl"
                  aria-hidden="true"
                >
                  <SquarePlusIcon className="size-6" />
                </span>
                <div>
                  <p className="font-medium text-pretty">
                    3. Add to Home Screen
                  </p>
                  <p className="text-muted-foreground text-sm/5">
                    Keep Open as Web App on, then Add.
                  </p>
                </div>
              </li>
              <li className="flex items-center gap-4">
                <Image
                  src={appIcon}
                  alt=""
                  sizes="48px"
                  className="size-12 shrink-0 rounded-xl"
                />
                <div>
                  <p className="font-medium text-pretty">
                    4. Open mealprep.party
                  </p>
                  <p className="text-muted-foreground text-sm/5">
                    Tap its new icon on your Home Screen.
                  </p>
                </div>
              </li>
            </ol>
          )}
          {status !== "install" && (
            <div className="flex min-h-40 flex-col items-center justify-center gap-4 py-4 text-center">
              <Image
                src={appIcon}
                alt=""
                sizes="64px"
                className="size-16 rounded-2xl"
              />
              <output className="text-muted-foreground max-w-72 text-balance">
                {status === "loading" && "Checking notifications…"}
                {status === "blocked" &&
                  "Allow notifications for mealprep.party in your device or browser settings."}
                {status === "unsupported" &&
                  "Open in Safari on iPhone, or a browser that supports notifications."}
                {(status === "unavailable" || status === "error") &&
                  "Notifications are unavailable right now."}
                {status === "ready" &&
                  (enabled
                    ? "Notifications are on for this device."
                    : "Get reminders from mealprep.party.")}
              </output>
            </div>
          )}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription className="md:text-balance">
                {error}
              </AlertDescription>
            </Alert>
          )}
        </div>
        {(status === "install" || status === "ready") && (
          <DrawerFooter>
            {status === "ready" && (
              <Button
                ref={hapticRef}
                size="lg"
                className={cn(
                  "h-12 rounded-full text-base",
                  !enabled && "enabled:hover:bg-primary"
                )}
                variant={enabled ? "secondary" : "default"}
                disabled={busy}
                onClick={toggle}
              >
                {busy
                  ? enabled
                    ? "Turning off…"
                    : "Enabling…"
                  : enabled
                    ? "Turn off"
                    : "Enable notifications"}
              </Button>
            )}
            {(status === "install" || !enabled) && (
              <DrawerClose
                render={
                  <Button
                    variant="secondary"
                    size="lg"
                    className="h-12 rounded-full text-base"
                    disabled={busy}
                  />
                }
              >
                Not now
              </DrawerClose>
            )}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
