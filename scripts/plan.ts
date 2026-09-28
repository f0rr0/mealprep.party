import { z } from "zod";

import { memberIdSchema, planSchema, slots, weekdays } from "@/lib/model";

const scheduleSchema = z.strictObject({
  members: z.record(memberIdSchema, z.string()),
  week: z.record(
    z.enum(weekdays),
    z.partialRecord(
      z.enum(slots),
      z.union([
        z.string().min(1),
        z.strictObject({
          meal: z.string().min(1),
          members: z.array(memberIdSchema).min(1),
        }),
      ])
    )
  ),
});

export function parsePlan(schedule: unknown, meals: unknown) {
  const { members, week } = scheduleSchema.parse(schedule);
  return planSchema.parse({
    names: members,
    meals,
    plan: weekdays.flatMap((day) =>
      slots.flatMap((slot) => {
        const entry = week[day][slot];
        if (!entry) {
          return [];
        }
        return [
          {
            day,
            slot,
            mealId: typeof entry === "string" ? entry : entry.meal,
            people:
              typeof entry === "string" ? Object.keys(members) : entry.members,
          },
        ];
      })
    ),
  });
}
