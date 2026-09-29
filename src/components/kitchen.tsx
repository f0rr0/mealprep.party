"use client";

import { CheckIcon, LinkIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import Image from "next/image";
import { Fragment, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

import { HeaderItem } from "@/components/header-item";
import { MealButton } from "@/components/meal-button";
import { MealDock } from "@/components/meal-dock";
import {
  MemberAvatars,
  preloadMemberAvatars,
} from "@/components/member-avatars";
import { Reminders } from "@/components/reminders";
import { ShareMealsButton } from "@/components/share-meals-button";
import { TabIndicator } from "@/components/tab-indicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Empty, EmptyMedia } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";
import { hapticRef } from "@/lib/haptics";
import { createKitchenSync } from "@/lib/kitchen-sync";
import {
  entryKey,
  groceryText,
  groupPlan,
  ingredientKey,
  ingredientsForEntries,
  missingIngredients,
  selectEntries,
  slots,
  weekdayFor,
  weekdays,
  withNames,
} from "@/lib/model";
import type { PlanEntry, State, Weekday } from "@/lib/model";
import { mealShareText } from "@/lib/share";
import { drawerContentClass } from "@/lib/ui-styles";
import { cn } from "@/lib/utils";

import groceriesEmpty from "../../public/groceries-empty.webp";
import wordmark from "../../public/illustrations/wordmark.webp";

const headerButtonClass =
  "h-11 min-w-16 rounded-full px-3 hover:bg-transparent";

const actionButtonClass = "h-12 rounded-full text-base";

const tabPanelClass =
  "col-start-1 row-start-1 w-full self-start transition-opacity duration-160 ease-[cubic-bezier(0.2,0,0,1)] data-ending-style:pointer-events-none data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none";

function WeekStrip({
  today,
  selectedDays,
}: {
  today?: Weekday;
  selectedDays: Weekday[];
}) {
  return (
    <TabsList
      aria-label="Day of the week"
      activateOnFocus={false}
      className="bg-background relative isolate w-full gap-1 p-0 group-data-horizontal/tabs:h-11"
    >
      <TabIndicator className="bg-foreground rounded-xl" />
      {weekdays.map((value) => (
        <TabsTrigger
          ref={hapticRef}
          key={value}
          value={value}
          aria-label={`${value}${value === today ? ", today" : ""}${selectedDays.includes(value) ? ", meals selected" : ""}`}
          aria-current={value === today ? "date" : undefined}
          className="relative z-10 h-11 min-w-0 flex-1 rounded-xl p-0 text-white mix-blend-difference transition-none hover:text-white data-active:bg-transparent data-active:text-white group-data-[variant=default]/tabs-list:data-active:shadow-none dark:text-white dark:hover:text-white dark:data-active:border-transparent dark:data-active:bg-transparent dark:data-active:text-white"
        >
          <span>{value.slice(0, 3)}</span>
          {value === today && (
            <span
              aria-hidden="true"
              className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current"
            />
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

export default function Kitchen({
  initialState,
  deploymentId: currentDeploymentId,
}: {
  initialState: Promise<State>;
  deploymentId: string | null;
}) {
  const [state, setState] = useState<State | null>(null);
  const [day, setDay] = useState<Weekday | null>(null);
  const [dayMotion, setDayMotion] = useState({ day, direction: 1 });
  if (dayMotion.day !== day) {
    setDayMotion({
      day,
      direction:
        day &&
        dayMotion.day &&
        weekdays.indexOf(day) < weekdays.indexOf(dayMotion.day)
          ? -1
          : 1,
    });
  }
  const [today, setToday] = useState<Weekday>();
  const [tab, setTab] = useState("plan");
  const [selection, setSelection] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [recipe, setRecipe] = useState<Pick<PlanEntry, "day" | "slot"> | null>(
    null
  );
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [error, setError] = useState("");
  const [copyFallback, setCopyFallback] = useState("");
  const [updateSeconds, setUpdateSeconds] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const sync = useRef<ReturnType<typeof createKitchenSync> | null>(null);

  useEffect(() => {
    if (!currentDeploymentId) {
      return;
    }
    let stopped = false;
    let checking = false;
    let found = false;
    async function check() {
      if (
        stopped ||
        checking ||
        found ||
        document.hidden ||
        !navigator.onLine
      ) {
        return;
      }
      checking = true;
      try {
        const response = await fetch("/api/version", {
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        if (response.ok) {
          const { deploymentId } = (await response.json()) as {
            deploymentId: string | null;
          };
          if (
            !stopped &&
            deploymentId &&
            deploymentId !== currentDeploymentId
          ) {
            found = true;
            setUpdateSeconds(10);
          }
        }
      } catch {
        // Keep the current app while offline; check again when it reconnects.
      } finally {
        checking = false;
      }
    }
    void check();
    const timer = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, [currentDeploymentId]);

  useEffect(() => {
    let active = true;
    const currentDay = weekdayFor(new Date());
    const url = new URL(window.location.href);
    const requestedDay = weekdays.find(
      (value) =>
        value.toLowerCase() === url.searchParams.get("day")?.toLowerCase()
    );
    // oxlint-disable-next-line react/set-state-in-effect -- Resolve the browser’s local day after hydration, independently of the network.
    setDay((selected) => requestedDay ?? selected ?? currentDay);
    if (url.searchParams.has("day")) {
      url.searchParams.delete("day");
      window.history.replaceState(window.history.state, "", url);
    }
    setToday(currentDay);
    function openNotification(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.data?.type !== "notification-open" ||
        typeof event.data.url !== "string"
      ) {
        return;
      }
      const target = URL.parse(event.data.url, window.location.origin);
      if (target?.origin !== window.location.origin) {
        return;
      }
      const nextDay = weekdays.find(
        (value) =>
          value.toLowerCase() === target.searchParams.get("day")?.toLowerCase()
      );
      if (nextDay) {
        setDay(nextDay);
        setTab("plan");
        setRecipeOpen(false);
        setCopyFallback("");
      }
      event.source?.postMessage({
        type: "notification-opened",
        url: target.href,
      });
    }
    async function notificationReady() {
      const worker = await navigator.serviceWorker.ready;
      if (active) {
        worker.active?.postMessage({ type: "notification-ready" });
      }
    }
    function notificationResumed() {
      if (document.visibilityState === "visible") {
        void notificationReady();
      }
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", openNotification);
      document.addEventListener("visibilitychange", notificationResumed);
      window.addEventListener("pageshow", notificationResumed);
      void notificationReady();
    }
    async function load() {
      try {
        const data = await initialState;
        if (!active) {
          return;
        }
        setState(data);
        preloadMemberAvatars(Object.values(data.avatars ?? {}));
        sync.current = createKitchenSync(data, (next, message) => {
          if (active) {
            setState(next);
            setPending(sync.current?.hasPending() ?? false);
            setError(message);
          }
        });
      } catch {
        if (active) {
          setError("Couldn’t load your meals.");
        }
      }
    }
    void load();
    async function refresh() {
      if (document.visibilityState !== "visible") {
        return;
      }
      setToday(weekdayFor(new Date()));
      try {
        await sync.current?.refresh();
      } catch {
        /* Keep the current view while offline. */
      }
    }
    const timer = setInterval(refresh, 15_000);
    function retry() {
      void sync.current?.retry();
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (sync.current?.hasPending()) {
        event.preventDefault();
      }
    }
    window.addEventListener("online", retry);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("online", retry);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", refresh);
      navigator.serviceWorker?.removeEventListener("message", openNotification);
      document.removeEventListener("visibilitychange", notificationResumed);
      window.removeEventListener("pageshow", notificationResumed);
    };
  }, [initialState]);

  const plan = state?.plan ?? [];
  const meals = state?.meals ?? [];
  const dayPlan = plan
    .filter((entry) => entry.day === day)
    .toSorted((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot));
  const daySlots = groupPlan(dayPlan);
  const selected = selection;
  const selectedPlan = plan.filter((entry) =>
    selected.includes(entryKey(entry))
  );
  const selectedDays = weekdays.filter((value) =>
    selectedPlan.some((entry) => entry.day === value)
  );
  const groceries = state?.groceries ?? [];
  const ingredients = groceries;
  const wanted = ingredientsForEntries(meals, selectedPlan);
  const added =
    wanted.length > 0 && missingIngredients(wanted, ingredients).length === 0;
  const updatePaused =
    pending ||
    selecting ||
    (selected.length > 0 && !added) ||
    recipeOpen ||
    !!copyFallback;

  useEffect(() => {
    if (updateSeconds === null) {
      return;
    }
    const timer = setInterval(() => {
      if (
        document.hidden ||
        updatePaused ||
        sync.current?.hasPending() ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')
      ) {
        return;
      }
      if (updateSeconds <= 1) {
        window.location.reload();
      } else {
        setUpdateSeconds(updateSeconds - 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [updateSeconds, updatePaused]);
  const pantry = state?.pantry ?? [];
  const text = groceryText(ingredients, pantry);
  const { copied, markCopied } = useCopyFeedback(text);
  const recipeEntries = plan.filter(
    (entry) => entry.day === recipe?.day && entry.slot === recipe?.slot
  );
  const recipeMeals = recipeEntries.flatMap((entry) => {
    const meal = meals.find((item) => item.id === entry.mealId);
    return meal ? [{ entry, meal }] : [];
  });
  const recipeIngredients = ingredientsForEntries(meals, recipeEntries);
  const allDaySelected =
    dayPlan.length > 0 &&
    dayPlan.every((entry) => selected.includes(entryKey(entry)));

  function toggleMeals(entries: PlanEntry[]) {
    setSelection(
      selectEntries(
        selected,
        entries,
        !entries.every((entry) => selected.includes(entryKey(entry)))
      )
    );
  }
  function addMeals(entries: PlanEntry[]) {
    if (
      !missingIngredients(ingredientsForEntries(meals, entries), ingredients)
        .length
    ) {
      return;
    }
    sync.current?.setGroceries(ingredientsForEntries(meals, entries), []);
  }
  const recipeAdded =
    !!recipeIngredients.length &&
    !missingIngredients(recipeIngredients, ingredients).length;
  const selectionMode = selecting && tab === "plan";

  return (
    <main
      className={cn(
        "mx-auto flex min-h-dvh max-w-xl flex-col gap-2 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6",
        updateSeconds !== null && "pb-[calc(11rem+env(safe-area-inset-bottom))]"
      )}
    >
      {updateSeconds !== null && (
        <aside className="bg-background/95 fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-2xl border p-3 shadow-lg backdrop-blur-xl">
          <output className="sr-only">
            New update available. Reload when ready.
          </output>
          <div className="min-w-0">
            <p className="font-medium">Update ready</p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {updatePaused
                ? "Reload when you’re done"
                : `Reloading in ${updateSeconds}s`}
            </p>
          </div>
          <Button
            ref={hapticRef}
            className="h-11 shrink-0 rounded-full px-4"
            disabled={pending}
            onClick={() => {
              if (!sync.current?.hasPending()) {
                window.location.reload();
              }
            }}
          >
            Reload
          </Button>
        </aside>
      )}
      <header className="relative flex h-11 shrink-0 -translate-y-1 items-center justify-center">
        <h1 className="sr-only">mealprep.party</h1>
        <AnimatePresence initial={false}>
          {tab === "plan" && !selectionMode && (
            <HeaderItem key="reminders" className="left-0">
              <Reminders />
            </HeaderItem>
          )}
          {!selectionMode && (
            <HeaderItem key="title">
              <Image
                src={wordmark}
                alt="मीलप्रेप.पार्टी"
                width={144}
                height={30}
                sizes="144px"
                className="h-auto w-36 -translate-y-1 dark:hue-rotate-180 dark:invert"
                loading="eager"
              />
            </HeaderItem>
          )}
          {selectionMode && (
            <HeaderItem key="select-all" className="left-0">
              <Button
                variant="ghost"
                className={headerButtonClass}
                ref={hapticRef}
                disabled={!state}
                onClick={() => {
                  setSelection(
                    selectEntries(selected, dayPlan, !allDaySelected)
                  );
                }}
              >
                <span>{allDaySelected ? "Deselect all" : "Select all"}</span>
              </Button>
            </HeaderItem>
          )}
          {selectionMode && (
            <HeaderItem key="count">
              <output className="text-sm font-medium tabular-nums">
                {groupPlan(selectedPlan).length} selected
              </output>
            </HeaderItem>
          )}
          {tab === "plan" && (
            <HeaderItem key={selecting ? "done" : "select"} className="right-0">
              <Button
                variant="ghost"
                className={headerButtonClass}
                ref={hapticRef}
                disabled={!state}
                onClick={() => {
                  setSelecting(!selecting);
                }}
              >
                <span>{selecting ? "Done" : "Select"}</span>
              </Button>
            </HeaderItem>
          )}
          {tab === "groceries" && !!ingredients.length && (
            <HeaderItem key="clear" className="left-0">
              <Button
                variant="ghost"
                className={headerButtonClass}
                ref={hapticRef}
                aria-label="Clear grocery list"
                onClick={() => {
                  sync.current?.setGroceries([], groceries);
                }}
              >
                Clear
              </Button>
            </HeaderItem>
          )}
          {tab === "groceries" && !!ingredients.length && (
            <HeaderItem key="copy" className="right-0">
              <Button
                variant="ghost"
                className={headerButtonClass}
                ref={hapticRef}
                disabled={!text}
                aria-label={copied ? "List copied" : "Copy grocery list"}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(text);
                    markCopied();
                  } catch {
                    setCopyFallback(text);
                  }
                }}
              >
                <span>{copied ? "Copied" : "Copy"}</span>
              </Button>
            </HeaderItem>
          )}
        </AnimatePresence>
        <output className="sr-only">{copied ? "List copied" : ""}</output>
      </header>
      <Tabs
        className="flex-1"
        value={tab}
        onValueChange={(value) => {
          if (value === "groceries" && selecting) {
            addMeals(selectedPlan);
            setSelecting(false);
          }
          setTab(String(value));
          window.scrollTo({ top: 0, behavior: "instant" });
        }}
      >
        <MealDock
          activeTab={tab}
          selectionMode={selectionMode}
          added={added}
          empty={!wanted.length}
          shareText={state ? mealShareText(state, selectedPlan) : ""}
          onPlan={() => {
            if (tab === "plan") {
              const current = weekdayFor(new Date());
              setToday(current);
              setDay(current);
              window.scrollTo({ top: 0, behavior: "instant" });
            }
          }}
        />
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-3 md:text-balance">
              {error}
              <Button
                ref={hapticRef}
                variant="outline"
                onClick={() => {
                  if (state) {
                    void sync.current?.retry();
                  } else {
                    location.reload();
                  }
                }}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <div className="grid flex-1 items-start">
          <TabsContent
            value="plan"
            className={cn(tabPanelClass, "flex flex-col gap-3")}
          >
            <Tabs
              value={day}
              className="gap-4"
              onValueChange={(value) => {
                const next = weekdays.find((weekday) => weekday === value);
                if (next) {
                  setDay(next);
                }
              }}
            >
              <WeekStrip
                today={today}
                selectedDays={selecting ? selectedDays : []}
              />
              <div className="grid items-start" aria-busy={!state}>
                {!state && (
                  <output
                    className="col-start-1 row-start-1 flex flex-col gap-2"
                    aria-label="Loading meals"
                  >
                    {slots.map((slot) => (
                      <Skeleton key={slot} className="h-25 w-full rounded-xl" />
                    ))}
                  </output>
                )}
                {day && (
                  <TabsContent
                    value={day}
                    aria-label={`${day} meals`}
                    className="col-start-1 row-start-1 flex w-full flex-col gap-2"
                  >
                    {state &&
                      daySlots.map((group, index) => {
                        const title = group.entries
                          .flatMap((entry) => {
                            const meal = meals.find(
                              (item) => item.id === entry.mealId
                            );
                            return meal
                              ? [withNames(meal.title, state.names)]
                              : [];
                          })
                          .join(", ");
                        const people = [
                          ...new Set(
                            group.entries.flatMap((entry) => entry.people)
                          ),
                        ];
                        return (
                          <MealButton
                            key={group.slot}
                            eager={index === 0}
                            slot={group.slot}
                            direction={dayMotion.direction}
                            title={title}
                            members={people.map((id) => ({
                              id,
                              name: state.names[id],
                            }))}
                            selecting={selecting}
                            selected={group.entries.every((entry) =>
                              selected.includes(entryKey(entry))
                            )}
                            open={
                              recipeOpen &&
                              recipe !== null &&
                              recipe.day === group.day &&
                              recipe.slot === group.slot
                            }
                            onOpen={() => {
                              setRecipe({ day: group.day, slot: group.slot });
                              setRecipeOpen(true);
                            }}
                            onSelect={() => toggleMeals(group.entries)}
                            onLongPress={() => {
                              setSelection(group.entries.map(entryKey));
                              setSelecting(true);
                            }}
                          />
                        );
                      })}
                    {state && !dayPlan.length && (
                      <p className="text-muted-foreground py-8">
                        No meals planned.
                      </p>
                    )}
                  </TabsContent>
                )}
              </div>
            </Tabs>
          </TabsContent>
          <TabsContent
            value="groceries"
            className={cn(tabPanelClass, "flex flex-col gap-5 self-stretch")}
          >
            <FieldGroup className="gap-0 empty:hidden">
              {ingredients.map((ingredient) => {
                const checked = pantry.includes(ingredientKey(ingredient));
                return (
                  <Field key={ingredient} orientation="horizontal">
                    <FieldLabel className="min-h-12 flex-1 items-center gap-3 py-3 has-data-checked:bg-transparent dark:has-data-checked:bg-transparent">
                      <Checkbox
                        inputRef={hapticRef}
                        className="data-checked:border-muted-foreground/40 data-checked:bg-muted data-checked:text-muted-foreground group-has-focus-visible/field-label:data-checked:border-muted-foreground dark:data-checked:bg-muted pointer-events-none"
                        checked={checked}
                        onCheckedChange={(value) => {
                          sync.current?.set(ingredient, value);
                        }}
                      />
                      <span
                        className={cn(
                          "text-base/6",
                          checked && "text-muted-foreground line-through"
                        )}
                      >
                        {ingredient}
                      </span>
                    </FieldLabel>
                  </Field>
                );
              })}
            </FieldGroup>
            {state ? (
              !ingredients.length && (
                <Empty className="min-h-72 gap-6 pb-16">
                  <EmptyMedia aria-hidden="true" className="mb-0">
                    <Image
                      src={groceriesEmpty}
                      alt=""
                      width={224}
                      height={224}
                      sizes="224px"
                    />
                  </EmptyMedia>
                  <Button
                    ref={hapticRef}
                    className={cn(actionButtonClass, "hover:bg-primary px-6")}
                    onClick={() => {
                      setSelection([]);
                      setSelecting(true);
                      setTab("plan");
                    }}
                  >
                    Add meals
                  </Button>
                </Empty>
              )
            ) : (
              <Skeleton className="h-12 w-full rounded-xl" />
            )}
          </TabsContent>
        </div>
      </Tabs>

      <Drawer
        open={recipeOpen}
        onOpenChange={setRecipeOpen}
        onOpenChangeComplete={(open) => {
          if (!open) {
            setRecipe(null);
          }
        }}
        showSwipeHandle
      >
        <DrawerContent
          className={cn(drawerContentClass, "min-h-[60dvh] text-base/6")}
        >
          <DrawerHeader className="gap-3 md:gap-3">
            <DrawerTitle className="text-center text-lg/6">
              {recipeMeals.length === 1 && state
                ? withNames(recipeMeals[0].meal.title, state.names)
                : (recipe?.slot ?? "Recipe")}
            </DrawerTitle>
            {recipeMeals.length === 1 && state && (
              <MemberAvatars
                members={recipeMeals[0].entry.people.map((id) => ({
                  id,
                  name: state.names[id],
                  avatar: state.avatars?.[id],
                }))}
              />
            )}
            <DrawerDescription className="sr-only">
              Recipe and ingredients.
            </DrawerDescription>
          </DrawerHeader>
          {state && (
            <div className="flex min-h-0 flex-col gap-6 overflow-y-auto overscroll-contain mask-[linear-gradient(to_bottom,transparent,black_24px,black_calc(100%-24px),transparent)] px-4 py-6">
              {recipeMeals.map(({ entry, meal }, index) => (
                <Fragment key={entryKey(entry)}>
                  {index > 0 && <Separator />}
                  <section
                    className="flex flex-col gap-6"
                    aria-label={withNames(meal.title, state.names)}
                  >
                    {recipeMeals.length > 1 && (
                      <header className="flex flex-col gap-3">
                        <h3 className="text-center text-lg/6 font-medium">
                          {withNames(meal.title, state.names)}
                        </h3>
                        <MemberAvatars
                          members={entry.people.map((id) => ({
                            id,
                            name: state.names[id],
                            avatar: state.avatars?.[id],
                          }))}
                        />
                      </header>
                    )}
                    <div className="flex flex-col gap-3 [&_a]:underline [&_h1]:font-medium [&_h2]:font-medium [&_h3]:font-medium [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
                      <Markdown skipHtml components={{ img: () => null }}>
                        {withNames(meal.recipe, state.names)}
                      </Markdown>
                      {meal.recipeLink && (
                        <a
                          ref={hapticRef}
                          href={meal.recipeLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 self-start rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          {[
                            "youtube.com",
                            "www.youtube.com",
                            "youtu.be",
                          ].includes(new URL(meal.recipeLink).hostname) ? (
                            <Image
                              src="/icons/youtube.svg"
                              alt=""
                              width={20}
                              height={14}
                              className="shrink-0"
                            />
                          ) : (
                            <LinkIcon aria-hidden="true" className="size-4" />
                          )}
                          Recipe link
                        </a>
                      )}
                    </div>
                    <div>
                      <h3 className="mb-2 font-medium">Ingredients</h3>
                      <ul className="grid list-disc grid-cols-2 gap-x-8 gap-y-1 pl-5 sm:grid-cols-3">
                        {meal.ingredients.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </section>
                </Fragment>
              ))}
            </div>
          )}
          <DrawerFooter className="grid grid-cols-2">
            <Button
              ref={hapticRef}
              variant="secondary"
              className={cn(
                actionButtonClass,
                "hover:bg-secondary",
                recipeAdded && "disabled:opacity-100"
              )}
              disabled={recipeAdded || !recipeIngredients.length}
              onClick={() => {
                addMeals(recipeEntries);
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                {recipeAdded ? (
                  <>
                    <CheckIcon data-icon="inline-start" />
                    Added
                  </>
                ) : (
                  "Add to groceries"
                )}
              </span>
            </Button>
            <ShareMealsButton
              text={state ? mealShareText(state, recipeEntries) : ""}
              className={actionButtonClass}
            />
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={!!copyFallback}
        onOpenChange={(open) => {
          if (!open) {
            setCopyFallback("");
          }
        }}
        showSwipeHandle
      >
        <DrawerContent className={drawerContentClass}>
          <DrawerHeader>
            <DrawerTitle className="text-center text-lg/6">
              Grocery list
            </DrawerTitle>
            <DrawerDescription className="text-base/6">
              Select and copy.
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4">
            <Textarea
              aria-label="Grocery list to copy"
              className="text-base/6 md:text-base"
              readOnly
              rows={10}
              value={copyFallback}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
          <DrawerFooter>
            <DrawerClose
              render={
                <Button className={cn(actionButtonClass, "hover:bg-primary")} />
              }
            >
              Done
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
