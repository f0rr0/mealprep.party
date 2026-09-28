import content from "../content/plan.json";
import { defaultNames, planSchema } from "./model";
import type { State } from "./model";

export function seedState(): State {
  return {
    ...planSchema.parse(content),
    names: { ...defaultNames },
    pantry: [],
    groceries: [],
    version: 1,
  };
}
