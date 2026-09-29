"use client";

import { CheckIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

import { HeaderItem } from "@/components/header-item";
import { MealButton } from "@/components/meal-button";
import { MealDock } from "@/components/meal-dock";
import { MemberAvatars } from "@/components/member-avatars";
import { ShareMealsButton } from "@/components/share-meals-button";
import { TabIndicator } from "@/components/tab-indicator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";
import { hapticRef } from "@/lib/haptics";
import { createKitchenSync } from "@/lib/kitchen-sync";
import {
  entryKey,
  groceryText,
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
import {
  actionButtonClass,
  headerButtonClass,
  tabPanelClass,
} from "@/lib/ui-styles";
import { cn } from "@/lib/utils";

import groceriesEmpty from "../../public/groceries-empty.webp";
import wordmark from "../../public/illustrations/wordmark.webp";

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
}: {
  initialState: Promise<State>;
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
  const [recipe, setRecipe] = useState<PlanEntry | null>(null);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [error, setError] = useState("");
  const [copyFallback, setCopyFallback] = useState("");
  const sync = useRef<ReturnType<typeof createKitchenSync> | null>(null);

  useEffect(() => {
    let active = true;
    const currentDay = weekdayFor(new Date());
    // oxlint-disable-next-line react/set-state-in-effect -- Resolve the browser’s local day after hydration, independently of the network.
    setDay(currentDay);
    setToday(currentDay);
    async function load() {
      try {
        const data = await initialState;
        if (!active) {
          return;
        }
        setState(data);
        sync.current = createKitchenSync(data, (next, message) => {
          if (active) {
            setState(next);
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
    };
  }, [initialState]);

  const plan = state?.plan ?? [];
  const meals = state?.meals ?? [];
  const dayPlan = plan
    .filter((entry) => entry.day === day)
    .toSorted((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot));
  const selected = selection;
  const selectedPlan = plan.filter((entry) =>
    selected.includes(entryKey(entry))
  );
  const selectedDays = weekdays.filter((value) =>
    selectedPlan.some((entry) => entry.day === value)
  );
  const groceries = state?.groceries ?? [];
  const groceryPlan = plan.filter((entry) =>
    groceries.includes(entryKey(entry))
  );
  const ingredients = ingredientsForEntries(meals, groceryPlan);
  const wanted = ingredientsForEntries(meals, selectedPlan);
  const added =
    wanted.length > 0 && missingIngredients(wanted, ingredients).length === 0;
  const pantry = state?.pantry ?? [];
  const text = groceryText(ingredients, pantry);
  const { copied, markCopied } = useCopyFeedback(text);
  const recipeMeal = meals.find((meal) => meal.id === recipe?.mealId);
  const allDaySelected =
    dayPlan.length > 0 &&
    dayPlan.every((entry) => selected.includes(entryKey(entry)));

  function toggleMeal(entry: PlanEntry) {
    setSelection(
      selectEntries(selected, [entry], !selected.includes(entryKey(entry)))
    );
  }
  function addMeals(entries: PlanEntry[]) {
    if (
      !missingIngredients(ingredientsForEntries(meals, entries), ingredients)
        .length
    ) {
      return;
    }
    sync.current?.setGroceries(entries.map(entryKey), []);
  }
  const recipeAdded =
    !!recipeMeal?.ingredients.length &&
    !missingIngredients(recipeMeal.ingredients, ingredients).length;
  const selectionMode = selecting && tab === "plan";

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-2 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6">
      <header className="relative flex h-11 shrink-0 -translate-y-1 items-center justify-center">
        <h1 className="sr-only">mealprep.party</h1>
        <AnimatePresence initial={false}>
          {!selectionMode && (
            <HeaderItem key="title">
              <Image
                src={wordmark}
                alt="मीलप्रेप.पार्टी"
                width={144}
                height={30}
                sizes="144px"
                className="h-auto w-36 -translate-y-1"
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
                {selectedPlan.length} selected
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
            <AlertDescription className="flex items-center justify-between gap-3">
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
                      dayPlan.map((entry) => {
                        const meal = meals.find(
                          (item) => item.id === entry.mealId
                        );
                        if (!meal) {
                          return null;
                        }
                        return (
                          <MealButton
                            key={entry.slot}
                            slot={entry.slot}
                            direction={dayMotion.direction}
                            title={withNames(meal.title, state.names)}
                            members={entry.people.map((id) => ({
                              id,
                              name: state.names[id],
                            }))}
                            selecting={selecting}
                            selected={selected.includes(entryKey(entry))}
                            onOpen={() => {
                              setRecipe(entry);
                              setRecipeOpen(true);
                            }}
                            onSelect={() => toggleMeal(entry)}
                            onLongPress={() => {
                              setSelection([entryKey(entry)]);
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
        <DrawerContent className="mx-auto min-h-[60dvh] w-full max-w-xl text-base/6 motion-reduce:transition-none">
          <DrawerHeader className="gap-3 md:gap-3">
            <DrawerTitle className="text-center text-lg/6">
              {recipeMeal && state
                ? withNames(recipeMeal.title, state.names)
                : "Recipe"}
            </DrawerTitle>
            {recipe && state && (
              <MemberAvatars
                members={recipe.people.map((id) => ({
                  id,
                  name: state.names[id],
                }))}
              />
            )}
            <DrawerDescription className="sr-only">
              Recipe and ingredients.
            </DrawerDescription>
          </DrawerHeader>
          {recipeMeal && state && (
            <div className="flex min-h-0 flex-col gap-6 overflow-y-auto overscroll-contain p-4">
              <div className="flex flex-col gap-3 [&_a]:underline [&_h1]:font-medium [&_h2]:font-medium [&_h3]:font-medium [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
                <Markdown skipHtml components={{ img: () => null }}>
                  {withNames(recipeMeal.recipe, state.names)}
                </Markdown>
              </div>
              <div>
                <h3 className="mb-2 font-medium">Ingredients</h3>
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  {recipeMeal.ingredients.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              {recipeMeal.recipeLink && (
                <a
                  href={recipeMeal.recipeLink}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({
                    variant: "outline",
                    className: actionButtonClass,
                  })}
                >
                  Source
                </a>
              )}
            </div>
          )}
          <DrawerFooter className="grid grid-cols-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button
              ref={hapticRef}
              variant={recipeAdded ? "secondary" : "default"}
              className={cn(
                actionButtonClass,
                recipeAdded ? "disabled:opacity-100" : "hover:bg-primary"
              )}
              disabled={recipeAdded || !recipeMeal?.ingredients.length}
              onClick={() => {
                if (recipe) {
                  addMeals([recipe]);
                }
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
              text={state && recipe ? mealShareText(state, [recipe]) : ""}
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
        <DrawerContent className="mx-auto w-full max-w-xl motion-reduce:transition-none">
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
