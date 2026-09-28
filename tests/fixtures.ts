import type { State } from "@/lib/model";

import meals from "../content/meals.json";
import content from "../content/plan.json";
import { parsePlan } from "../scripts/plan";

export function createState(): State {
  return {
    ...parsePlan(content, meals),
    pantry: [],
    groceries: [],
    version: 1,
  };
}
