import { NextResponse } from "next/server";
import { z } from "zod";

import { sameOrigin } from "@/lib/auth";
import { readState, updateState } from "@/lib/db";
import { ingredientKey, kitchenCommand, updateGroceries } from "@/lib/model";

export async function GET() {
  return NextResponse.json(await readState(), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function PATCH(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 }
    );
  }
  try {
    const command = kitchenCommand.parse(await req.json());
    const state = await updateState(command.version, (draft) => {
      if (command.action === "groceries") {
        draft.groceries = updateGroceries(draft, command.add, command.remove);
      } else {
        const key = ingredientKey(command.ingredient);
        draft.pantry = draft.pantry.filter((item) => item !== key);
        if (command.checked) {
          draft.pantry.push(key);
        }
      }
    });
    return NextResponse.json(state);
  } catch (error) {
    const conflict = error instanceof Error && error.message === "CONFLICT";
    return NextResponse.json(
      {
        error: conflict
          ? "Updated elsewhere. Try again."
          : error instanceof z.ZodError
            ? "Check your entries."
            : "Couldn’t save. Try again.",
      },
      { status: conflict ? 409 : 400 }
    );
  }
}
