# mealprep.party

Weekly meals and shared groceries. Built with Next.js, Bun, Supabase and Drizzle.

```sh
mise install
mise run setup
bun run dev
mise run check
```

Configure secrets in `.env.local` using `.env.example`; production secrets live in Vercel.

Edit `content/plan.json` and `content/meals.json` and run `bun run plan:sync` to update meals in the database.
