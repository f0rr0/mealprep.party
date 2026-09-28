import { slots, weekdays, withNames } from "./model";
import type { PlanEntry, State } from "./model";

export function mealShareText(state: State, entries: PlanEntry[]) {
  return entries
    .toSorted(
      (a, b) =>
        weekdays.indexOf(a.day) - weekdays.indexOf(b.day) ||
        slots.indexOf(a.slot) - slots.indexOf(b.slot)
    )
    .flatMap((entry) => {
      const meal = state.meals.find((item) => item.id === entry.mealId);
      if (!meal) {
        return [];
      }
      return [
        [
          `${entry.day} · ${entry.slot} · ${entry.people.map((person) => state.names[person]).join(" & ")}`,
          withNames(meal.title, state.names),
          withNames(meal.recipe, state.names),
          `Ingredients\n${meal.ingredients.map((item) => `• ${item}`).join("\n")}`,
          meal.recipeLink,
        ]
          .filter(Boolean)
          .join("\n\n"),
      ];
    })
    .join("\n\n———\n\n");
}

export async function shareText(
  text: string,
  platform: {
    share?: (data: ShareData) => Promise<void>;
    clipboard?: Pick<Clipboard, "writeText">;
  } = navigator
) {
  if (platform.share) {
    try {
      await platform.share({ title: "Our kitchen", text });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  try {
    if (!platform.clipboard) {
      return "manual";
    }
    await platform.clipboard.writeText(text);
    return "copied";
  } catch {
    return "manual";
  }
}
