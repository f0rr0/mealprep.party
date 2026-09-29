// Record before opening so remounts and reloads cannot repeat the promotion.
export function claimPrompt(
  kind: "home-screen" | "notifications",
  storage?: Pick<Storage, "getItem" | "setItem">
) {
  try {
    const preferences = storage ?? window.localStorage;
    const key = `mealprep:${kind}-prompt`;
    if (preferences.getItem(key)) {
      return false;
    }
    preferences.setItem(key, "seen");
    return true;
  } catch {
    // Without persistent preferences, skip automatic prompts rather than nag.
    return false;
  }
}
