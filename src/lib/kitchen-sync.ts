/* oxlint-disable no-await-in-loop -- Writes share a version and must be serialized. */
import { ingredientKey, updateGroceries } from "./model";
import type { State } from "./model";

// Keep the latest intent for each ingredient while one write is in flight.
export function createKitchenSync(
  initial: State,
  publish: (state: State, error: string) => void,
  request: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response> = fetch
) {
  let saved = initial;
  let saving = false;
  let revision = 0;
  const pending = new Map<string, boolean>();
  const pendingGroceries = new Map<
    string,
    { name: string; checked: boolean }
  >();
  const hasPending = () => pending.size > 0 || pendingGroceries.size > 0;
  function emit(error = "") {
    const pantry = new Set(saved.pantry);
    for (const [key, checked] of pending) {
      if (checked) {
        pantry.add(key);
      } else {
        pantry.delete(key);
      }
    }
    const add = [...pendingGroceries]
      .filter(([, item]) => item.checked)
      .map(([, item]) => item.name);
    const remove = [...pendingGroceries]
      .filter(([, item]) => !item.checked)
      .map(([key]) => key);
    const groceries = updateGroceries(saved, add, remove);
    const included = new Set(groceries.map(ingredientKey));
    publish(
      {
        ...saved,
        pantry: [...pantry].filter((key) => included.has(key)),
        groceries,
      },
      error
    );
  }
  async function drain() {
    if (saving || !hasPending()) {
      return;
    }
    saving = true;
    emit();
    try {
      let conflicts = 0;
      while (hasPending()) {
        const pantryChange = pendingGroceries.size
          ? undefined
          : pending.entries().next().value;
        const groceryChanges = new Map(pendingGroceries);
        const command = pantryChange
          ? {
              action: "pantry",
              ingredient: pantryChange[0],
              checked: pantryChange[1],
            }
          : {
              action: "grocery-items",
              add: [...groceryChanges]
                .filter(([, item]) => item.checked)
                .map(([, item]) => item.name),
              remove: [...groceryChanges]
                .filter(([, item]) => !item.checked)
                .map(([key]) => key),
            };
        const response = await request("/api/kitchen", {
          method: "PATCH",
          signal: AbortSignal.timeout(10_000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...command, version: saved.version }),
        });
        if (response.status === 409 && conflicts < 3) {
          conflicts += 1;
          const latest = await request("/api/kitchen", { cache: "no-store" });
          if (!latest.ok) {
            throw new Error("Couldn’t refresh groceries.");
          }
          saved = await latest.json();
          continue;
        }
        if (!response.ok) {
          throw new Error("Couldn’t save groceries.");
        }
        saved = { ...saved, ...(await response.json()) };
        conflicts = 0;
        if (pantryChange) {
          if (pending.get(pantryChange[0]) === pantryChange[1]) {
            pending.delete(pantryChange[0]);
          }
        } else {
          for (const [key, item] of groceryChanges) {
            if (pendingGroceries.get(key) === item) {
              pendingGroceries.delete(key);
            }
          }
        }
        emit();
      }
    } catch {
      emit("Changes haven’t saved yet.");
    } finally {
      saving = false;
    }
  }
  return {
    set(ingredient: string, checked: boolean) {
      revision += 1;
      pending.set(ingredientKey(ingredient), checked);
      emit();
      void drain();
    },
    setGroceries(add: string[], remove: string[]) {
      revision += 1;
      for (const key of add) {
        pendingGroceries.set(ingredientKey(key), { name: key, checked: true });
      }
      for (const key of remove) {
        pendingGroceries.set(ingredientKey(key), { name: key, checked: false });
      }
      emit();
      void drain();
    },
    retry: drain,
    async refresh() {
      if (saving || hasPending()) {
        return;
      }
      const started = revision;
      const response = await request("/api/kitchen", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const latest: State = await response.json();
      if (
        started === revision &&
        !saving &&
        !hasPending() &&
        latest.version >= saved.version
      ) {
        saved = latest;
        emit();
      }
    },
    hasPending,
  };
}
