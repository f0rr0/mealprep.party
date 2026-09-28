import { z } from "zod";

export const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export type Weekday = (typeof weekdays)[number];
export const slots = ["Breakfast", "Lunch", "Snack", "Dinner"] as const;
export const memberIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]{0,99}$/u)
  .refine(
    (id) => !["__proto__", "constructor", "prototype"].includes(id),
    "Invalid member ID."
  );
const membersSchema = z
  .record(memberIdSchema, z.string().trim().min(1).max(40))
  .refine(
    (members) => Object.keys(members).length > 0,
    "At least one member is required."
  );
export type Members = z.infer<typeof membersSchema>;
const shortText = z.string().trim().min(1).max(500);
export const mealSchema = z.strictObject({
  id: z.string().min(1).max(100),
  title: shortText,
  recipe: z.string().trim().min(1).max(20_000),
  ingredients: z.array(shortText).max(100),
  recipeLink: z
    .union([z.literal(""), z.url().regex(/^https?:\/\//u)])
    .default(""),
});
export type Meal = z.infer<typeof mealSchema>;
export const planSchema = z
  .strictObject({
    names: membersSchema,
    meals: z.array(mealSchema).max(1000),
    plan: z
      .array(
        z.strictObject({
          day: z.enum(weekdays),
          slot: z.enum(slots),
          mealId: z.string().min(1),
          people: z.array(memberIdSchema).min(1),
        })
      )
      .max(10_000),
  })
  .superRefine((data, ctx) => {
    const ids = new Set(data.meals.map((meal) => meal.id));
    if (ids.size !== data.meals.length) {
      ctx.addIssue({ code: "custom", message: "Meal IDs must be unique." });
    }
    const entries = new Set<string>();
    for (const entry of data.plan) {
      const key = `${entry.day}:${entry.slot}:${entry.mealId}`;
      if (
        !ids.has(entry.mealId) ||
        entry.people.some((id) => !Object.hasOwn(data.names, id)) ||
        entries.has(key) ||
        new Set(entry.people).size !== entry.people.length
      ) {
        ctx.addIssue({
          code: "custom",
          message: `Invalid or repeated plan entry: ${key}`,
        });
      }
      entries.add(key);
    }
  });
type Plan = z.infer<typeof planSchema>;
export type State = Plan & {
  version: number;
  pantry: string[];
  groceries: string[];
};
export const kitchenCommand = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("groceries"),
    add: z.array(z.string().min(1).max(200)).max(10_000),
    remove: z.array(z.string().min(1).max(200)).max(10_000),
    version: z.number().int(),
  }),
  z.strictObject({
    action: z.literal("pantry"),
    ingredient: shortText,
    checked: z.boolean(),
    version: z.number().int(),
  }),
]);
export function weekdayFor(date: Date): Weekday {
  return weekdays[(date.getDay() + 6) % 7];
}
export function ingredientKey(name: string) {
  return name.trim().toLocaleLowerCase();
}
export function ingredientsFor(meals: Meal[]) {
  return [
    ...new Map(
      meals
        .flatMap((meal) => meal.ingredients)
        .map((name) => [ingredientKey(name), name.trim()])
    ).values(),
  ];
}
export function groceryText(ingredients: string[], pantry: string[]) {
  return ingredients
    .filter((name) => !pantry.includes(ingredientKey(name)))
    .join("\n");
}
export function withNames(text: string, members: Members) {
  return text.replaceAll(
    /\{\{(?<member>[a-z0-9_-]+)\}\}/gu,
    (placeholder, id: string) =>
      Object.hasOwn(members, id) ? members[id] : placeholder
  );
}

export type PlanEntry = Plan["plan"][number];
export function entryKey(entry: PlanEntry) {
  return `${entry.day}:${entry.slot}:${entry.mealId}`;
}
export function selectEntries(
  selection: string[],
  entries: PlanEntry[],
  checked: boolean
) {
  const keys = new Set(entries.map(entryKey));
  return checked
    ? [...new Set([...selection, ...keys])]
    : selection.filter((key) => !keys.has(key));
}

export function updateGroceries(state: State, add: string[], remove: string[]) {
  const valid = new Set(state.plan.map(entryKey));
  const removed = new Set(remove);
  return [
    ...new Set([
      ...(state.groceries ?? []).filter((key) => !removed.has(key)),
      ...add,
    ]),
  ].filter((key) => valid.has(key));
}

export function ingredientsForEntries(meals: Meal[], entries: PlanEntry[]) {
  const ids = new Set(entries.map((entry) => entry.mealId));
  return ingredientsFor(meals.filter((meal) => ids.has(meal.id)));
}

export function missingIngredients(wanted: string[], existing: string[]) {
  const included = new Set(existing.map(ingredientKey));
  return wanted.filter((name) => !included.has(ingredientKey(name)));
}
