import { test } from "bun:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("Vercel migrates only production and never builds after a failed migration", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "mealprep-build-"));
  const script = new URL("../scripts/vercel-build.ts", import.meta.url)
    .pathname;
  const run = async (environment: string, failure = false) => {
    await Bun.write(
      path.join(cwd, "package.json"),
      JSON.stringify({
        scripts: {
          "db:migrate": `bun -e 'console.log("migrated"); process.exit(${failure ? 1 : 0})'`,
          build: "bun -e 'console.log(\"built\")'",
        },
      })
    );
    const child = Bun.spawn([process.execPath, script], {
      cwd,
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://localhost/test",
        DIRECT_URL: "postgresql://localhost/test",
        VERCEL_ENV: environment,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    return {
      output: await new Response(child.stdout).text(),
      code: await child.exited,
    };
  };
  try {
    assert.deepEqual(await run("production"), {
      output: "migrated\nbuilt\n",
      code: 0,
    });
    assert.deepEqual(await run("preview"), { output: "built\n", code: 0 });
    assert.deepEqual(await run("development"), { output: "built\n", code: 0 });
    const failure = await run("production", true);
    assert.notEqual(failure.code, 0);
    assert.equal(failure.output, "migrated\n");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
