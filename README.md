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

Web Push reminders are scheduled daily for 8:30 pm IST (Vercel Hobby may run them anytime between 8:30 and 9:29 pm IST). Enable them from the bell on each device; iPhones must open the app from the Home Screen.
