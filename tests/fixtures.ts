import type { State } from "@/lib/model";

import { parsePlan } from "../scripts/plan";

export const members = {
  "member-a": { name: "Sam" },
  "member-b": { name: "Ria", avatar: "/avatars/example.webp" },
};

export const meals = {
  first: {
    title: "First meal",
    recipe: "Cook the ingredients.",
    ingredients: ["Rice", "Beans"],
  },
  second: {
    title: "Second meal",
    recipe: "Mix the ingredients.",
    ingredients: ["Carrots", " rice "],
  },
};

export const schedule = {
  Monday: {
    Breakfast: { meal: "first", members: ["member-a"] },
    Lunch: "second",
    Dinner: "first",
  },
  Tuesday: { Lunch: { meal: "second", members: ["member-a"] } },
  Wednesday: {},
  Thursday: {},
  Friday: {},
  Saturday: {},
  Sunday: {},
};

export function createState(): State {
  return {
    ...parsePlan(schedule, meals, members),
    pantry: [],
    groceries: [],
    version: 1,
  };
}
