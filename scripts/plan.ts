import { z } from "zod";

import {
  mealSchema,
  memberIdSchema,
  planSchema,
  slots,
  weekdays,
} from "@/lib/model";

const assignmentSchema = z.union([
  z.string().min(1),
  z.strictObject({
    meal: z.string().min(1),
    members: z.array(memberIdSchema).min(1),
  }),
]);

const membersSchema = z.record(
  memberIdSchema,
  z.strictObject({ name: z.string(), avatar: z.string().optional() })
);
const mealsSchema = z.record(
  z.string().min(1).max(100),
  mealSchema.omit({ id: true })
);
const scheduleSchema = z.record(
  z.enum(weekdays),
  z.partialRecord(
    z.enum(slots),
    z.union([assignmentSchema, z.array(assignmentSchema).min(1).max(100)])
  )
);

export function parsePlan(
  schedule: unknown,
  catalog: unknown,
  people: unknown
) {
  const week = scheduleSchema.parse(schedule);
  const members = membersSchema.parse(people);
  const meals = Object.entries(mealsSchema.parse(catalog)).map(
    ([id, meal]) => ({ id, ...meal })
  );
  return planSchema.parse({
    names: Object.fromEntries(
      Object.entries(members).map(([id, member]) => [id, member.name])
    ),
    avatars: Object.fromEntries(
      Object.entries(members).flatMap(([id, member]) =>
        member.avatar ? [[id, member.avatar]] : []
      )
    ),
    meals,
    plan: weekdays.flatMap((day) =>
      slots.flatMap((slot) => {
        const entry = week[day][slot];
        if (!entry) {
          return [];
        }
        return (Array.isArray(entry) ? entry : [entry]).map((assignment) => ({
          day,
          slot,
          mealId: typeof assignment === "string" ? assignment : assignment.meal,
          people:
            typeof assignment === "string"
              ? Object.keys(members)
              : assignment.members,
        }));
      })
    ),
  });
}
