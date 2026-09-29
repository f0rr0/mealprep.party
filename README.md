# mealprep.party

Weekly meals and shared groceries. Built with Next.js, Bun, Supabase and Drizzle.

```sh
mise install
mise run setup
bun run dev
bun run validate
bun test
```

Configure secrets in `.env.local` using `.env.example`; production secrets live in Vercel.

Edit `content/plan.json`, `content/meals.json`, or `content/members.json`. Production deploys migrate the database and overwrite its plan content; grocery checks are preserved. Run `bun run plan:sync` to sync manually.
