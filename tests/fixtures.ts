import type { State } from "@/lib/model";

import meals from "../content/meals.json";
import members from "../content/members.json";
import content from "../content/plan.json";
import { parsePlan } from "../scripts/plan";

export function createState(): State {
  return {
    ...parsePlan(content, meals, members),
    pantry: [],
    groceries: [],
    version: 1,
  };
}
