// Daily scheduled publish trigger.
//
// GitHub Actions' own `on.schedule` cron gives no SLA and can silently delay
// or drop runs (observed multi-hour delays and fully missed days on this
// repo). Netlify Scheduled Functions are backed by a more reliable external
// scheduler, so this function fires daily and dispatches the site's CI
// workflow via the GitHub REST API instead of relying on GitHub's cron.
//
// Required environment variable (Netlify → Site configuration → Env vars):
//   GITHUB_PAT  — existing GitHub PAT. For a fine-grained token this must
//                 have the "Actions" repository permission set to "Read and
//                 write" (read-only returns a 403) on sourcier/sourcier.uk;
//                 for a classic token, "repo" or "public_repo" scope.

import type { Config } from "@netlify/functions";

const REPO = "sourcier/sourcier.uk";
const WORKFLOW_FILE = "ci.yml";

// V2 scheduled function: the legacy `schedule()` wrapper from
// `@netlify/functions` is a runtime no-op (it just returns the handler
// unchanged) and relies on Netlify's build-time static analysis to pick up
// the cron string, which was not registering this function as scheduled
// (confirmed via zero invocations and an empty `function_schedules` array
// on deploys). The `export default` + `config.schedule` form below is the
// currently documented way to declare a scheduled function and shows up
// with a "Scheduled" badge on the Functions page once deployed.
export default async () => {
  const token = process.env.GITHUB_PAT;

  if (!token) {
    console.error("trigger-scheduled-publish: GITHUB_PAT is not set");
    return new Response(null, { status: 500 });
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { environment: "prod", triggered_by: "scheduled-publish" },
      }),
    },
  );

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(
      `trigger-scheduled-publish: GitHub API error ${res.status}: ${errorBody}`,
    );
    return new Response(null, { status: 502 });
  }

  return new Response(null, { status: 200 });
};

// Runs daily at 07:45 UTC — matches the previous GitHub Actions cron slot.
export const config: Config = {
  schedule: "45 7 * * *",
};
