## Agent skills

### Issue tracker

Issues live in GitHub Issues (moneytosms/termwise) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Assignment

Client brief: `Problem.md`. Submission rules and scoring: `docs/assignment-rules.md`. Deadline 2026-11-09.

## Reference material

Local notes live in `.scratch/references/` (gitignored). In anything tracked or published (code, docs, issues, commits, TDD), call them "existing open-source solutions" and ask before naming one.

## Deploy

Hosted on Render: web service `termwise` (`srv-dblrgk8m7kps73c3uki0`, https://termwise-s1vj.onrender.com) and Postgres `termwise-db`, defined in `render.yaml`. The Render CLI is installed and logged in (`render`); use it to deploy and check deploys, not the dashboard:

- Push `main`: the service auto-deploys it. To force one: `render deploys create srv-dblrgk8m7kps73c3uki0 --wait --confirm -o text`
- Watch: `render deploys list srv-dblrgk8m7kps73c3uki0 -o text`. Logs: `render logs -r srv-dblrgk8m7kps73c3uki0 -o text --limit 100`
- The container runs `db:migrate && db:seed` on every start, so commit new drizzle migrations (`pnpm db:generate`) with the schema change.
- After a deploy, `curl -s https://termwise-s1vj.onrender.com/api/health`: it lists which env vars are set (booleans, never values) and pings both databases. Render's health check uses it, so a deploy missing a required var or the database never goes live.
- The CLI can't edit env vars. Use the REST API with the CLI's token (`key` in `~/.render/cli.yaml`, never print it): `PUT https://api.render.com/v1/services/<id>/env-vars/<KEY>` with body `{"value": "..."}`, then redeploy.
- Termy models: Groq (`GROQ_API_KEY`, default GPT-OSS 120B) and Gemini (`GOOGLE_GENERATIVE_AI_API_KEY`, often "high demand"). The picker lists only models whose key is set, and a failed call falls back through the others (`src/server/llm.ts`). Local keys live in `.env.local` (gitignored).

## Demo product

Termwise is a demo for the assignment, not a production system. Favor features and polish over hardening: skip rate limiting, abuse protection and defensive edge cases unless the brief scores them. Still keep real secrets out of git and keep role access checks (they are part of the brief).
