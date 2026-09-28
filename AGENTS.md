<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project constraints

Read `/Users/sid/.codex/RTK.md`; prefix shell commands with `rtk`. Keep exactly two app tabs in a fixed bottom navigation: Plan and Groceries, with a repeating Monday–Sunday routine. Plan shows a compact weekday selector and one day’s meals. No dated plans, calendar navigation, or long seven-day agenda. Meals are maintained programmatically in content/meals.json and scheduled in content/plan.json, never edited in the UI. Meals contain title, Markdown recipe, plain-text ingredients and an optional recipe link. Do not store preparation durations. Members are generic IDs with display names in content/plan.json; do not hardcode names, roles, or household size. Keep the persisted names map and people references compatible. MCP_ACCOUNTS maps member IDs to provider credentials. Use one sans-serif font throughout, loaded with next/font. Do not add Fontsource or Cormorant. No nutrition targets or connection flows. Retain the member-based MCP backend for future shopping work. Style with React Tailwind classes. Do not customize generated `src/components/ui/` or `src/app/globals.css`. Use T3 Env, Drizzle, and Vercel environment variables. Keep `.env.local` ignored and included in `.worktreeinclude`.

Iteration is local-only until the user asks to publish. Use Base UI (including Drawer) through untouched shadcn sources. No name settings, accordions or whole-week grocery option. Plan selections add to a separate, persisted grocery list. Compare ingredients, ignoring pantry checks, to show Added. Groceries contains only the ingredient checklist and copy action; all meal selection happens in Plan. Use Motion for the floating dock transitions and a shared icon/label layout. Grocery checks update optimistically. Use ios-haptics through the shared hapticRef adapter for mobile feedback. Its pinned upstream source lives in vendor/ios-haptics; see UPSTREAM.md before updating it.

Use Bun for dependency management, scripts, tests, and checks. Use `bun run`, `bun test`, and `bunx --bun`; never npm, npx, or a Node/tsx script runner. Keep the Bun version pinned in mise.toml and packageManager, and commit bun.lock. Run `mise run check` after changes.

Manage tools outside Bun package management through pinned versions in `mise.toml`. Keep package dependencies in `package.json` and `bun.lock`. Use the latest stable native TypeScript compiler (TypeScript 7+, exposed as `tsc`).
