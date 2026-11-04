# Deployment

Repository: https://github.com/moneytosms/termwise
Live app: _added once deployed_

## Run it locally

Needs Node 24 or later, pnpm 12, and Docker.

```bash
git clone https://github.com/moneytosms/termwise && cd termwise
pnpm install
docker compose up -d db          # Postgres 18 on localhost:54329
cp env.example .env.local        # local-only values, no real secrets
set -a; . ./env.example; set +a  # the scripts below read the same values
pnpm db:migrate                  # tables, assistant views and read-only role
pnpm db:seed                     # synthetic sample data and demo logins
pnpm dev                         # http://localhost:3000
```

To start over with fresh sample data:

```bash
psql "$DATABASE_URL" -c "drop schema if exists drizzle cascade; drop schema public cascade; create schema public;"
pnpm db:migrate && pnpm db:seed
```

Or run the whole stack in containers: `docker compose up --build` (migrates and seeds on start).

### Checks

```bash
pnpm typecheck && pnpm lint && pnpm test   # unit tests
pnpm build && E2E=1 pnpm e2e               # end-to-end tests on a phone viewport, on a freshly seeded database
```

The plain-English assistant and AI-worded risk reasons need an LLM key. Without one the assistant says no provider is configured, and risk reasons use the rule's own wording.

## How it is deployed

One Docker web service and one Postgres database on Render, defined in `render.yaml`.

1. Render dashboard, **New > Blueprint**, pick this repository. Render creates the `termwise` web service and the `termwise-db` database.
2. Fill the prompted values:
   - `BETTER_AUTH_URL`: the service's public URL.
   - `ASSISTANT_DATABASE_URL`: the database's internal URL with the user and password replaced by `termwise_assistant` and a new random password. The migration sets that password on the read-only role.
   - `GOOGLE_GENERATIVE_AI_API_KEY`: a Gemini API key.
3. The container migrates and seeds on start (the seed skips an already seeded database).
4. Daily job: in GitHub repository settings, add secrets `APP_URL` (the public URL) and `CRON_SECRET` (copy from the Render service). The `Daily job` workflow calls it at 06:00 IST; run it by hand from the Actions tab.

CI (`.github/workflows/ci.yml`) runs type checks, lint, unit tests, build and the end-to-end tests against Postgres on every push to `main`.

Free tier limits: the web service sleeps when idle, so the first request takes about a minute. The free database expires after 30 days.

## Environment variables

Names only. `env.example` holds local-only defaults.

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | App database connection |
| `ASSISTANT_DATABASE_URL` | Read-only role the assistant's queries run as |
| `BETTER_AUTH_SECRET` | Signs sessions and parent links |
| `BETTER_AUTH_URL` | Public URL of the app |
| `CRON_SECRET` | Shared secret for the daily job endpoint |
| `LLM_PROVIDER` | `google` (Gemini) or `groq` |
| `LLM_DAILY_CAP` | Maximum LLM calls per day across the app |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini key, when `LLM_PROVIDER=google` |
| `GROQ_API_KEY` | Groq key, when `LLM_PROVIDER=groq` |

## Demo logins

Password for every account: `termwise-demo`. All data is synthetic.

| Email | Role | Campus |
| --- | --- | --- |
| `faculty@termwise.demo` | Faculty, B.Tech CSE | Engineering College |
| `faculty2@termwise.demo` | Faculty, B.Tech CSE | Engineering College |
| `me.faculty@termwise.demo` | Faculty, B.Tech Mechanical | Engineering College |
| `admin@termwise.demo` | Office admin | Engineering College |
| `mba.admin@termwise.demo` | Office admin | Management School |
| `mba.faculty@termwise.demo` | Faculty, MBA | Management School |

Try first: sign in as `faculty@termwise.demo` on a phone, open a class from Home, turn on airplane mode, mark it, and turn the network back on. Then sign in as `admin@termwise.demo` to see the sheet, lock marks, record a fee payment and open the at-risk list.
