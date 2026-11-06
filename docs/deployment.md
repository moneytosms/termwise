# Deployment

Repository: https://github.com/moneytosms/termwise

You can rebuild everything locally with the steps below, or open the live deployment at https://termwise-s1vj.onrender.com (same demo logins).

## 1. Prerequisites

1. Node 24 or later (CI uses 24, the Dockerfile uses 26). `package.json` has no `engines` field.
2. pnpm 12.15.0 (`packageManager` in `package.json`).
3. Docker with the compose plugin, and git.

```bash
node -v                      # v24 or later
npm install -g pnpm@12.15.0
pnpm -v                      # 12.15.0
docker compose version
git --version
```

## 2. Run locally

```bash
git clone https://github.com/moneytosms/termwise && cd termwise
pnpm install
cp env.example .env.local        # local-only values, no real secrets
set -a; . ./env.example; set +a  # tsx scripts do not read .env.local, so export the same values
docker compose up -d db          # Postgres 18 on localhost:54329
docker compose ps db             # wait until STATUS shows (healthy)
pnpm db:migrate                  # tables, assistant views, read-only role termwise_assistant
pnpm db:seed                     # synthetic data and demo logins
pnpm dev                         # then open http://localhost:3000
```

Open http://localhost:3000 and sign in with a login from section 4.

Assistant role: no manual setup. `db:migrate` runs `sql/assistant.sql` (creates the read-only role and views) and sets the role's password from `ASSISTANT_DATABASE_URL`. `env.example` already points at `termwise_assistant` on the same database.

Env var names (values for local runs come from `env.example`; never commit real secrets):

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | App database (set in `env.example`) |
| `ASSISTANT_DATABASE_URL` | yes | Read-only role the assistant runs as: same database, user `termwise_assistant`. Migration sets the role's password from it |
| `BETTER_AUTH_SECRET` | yes | Signs sessions and receipt hashes. Changing it breaks verification of issued receipts |
| `BETTER_AUTH_URL` | yes | Public URL of the app as the browser sees it (`http://localhost:3000` locally) |
| `CRON_SECRET` | for the daily job | Bearer secret for `/api/cron/daily` (blank in `env.example`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | optional (one LLM key is enough) | Gemini key (blank in `env.example`) |
| `GROQ_API_KEY` | optional (one LLM key is enough) | Groq key (blank in `env.example`) |
| `LLM_PROVIDER` | optional | Preferred provider, `groq` or `google`. If its key is missing, the other keyed provider is used |
| `LLM_DAILY_CAP` | optional | Max LLM calls per day |

Without an LLM key the app runs; only the plain-English assistant and AI-worded risk reasons are unavailable. The assistant says no provider is configured and risk reasons use the rule's own wording.

Health check: `/api/health` returns 200 only when the app database answers and every required var is set, otherwise 503. The body lists each var as a boolean (never values), plus `db`, `assistantDb`, `llm` and `missing`.

Daily job (optional): in GitHub repository settings add secrets `APP_URL` (public URL) and `CRON_SECRET` (the same value as above). The `Daily job` workflow calls `POST /api/cron/daily` at 06:00 IST and can be run by hand from the Actions tab.

Start over with fresh sample data (wipes the volume):

```bash
docker compose down -v
docker compose up -d db
docker compose ps db             # wait for (healthy)
pnpm db:migrate && pnpm db:seed
```

Or run the whole stack in containers (migrates and seeds on start, app on http://localhost:3000):

```bash
docker compose up --build
```

## 3. Verify

Run in the shell where the env was exported (section 2), on a freshly seeded database.

```bash
pnpm lint
pnpm typecheck                              # tsc --noEmit
pnpm test                                   # vitest run (unit tests)
pnpm build
pnpm exec playwright install chromium       # add --with-deps on a bare Linux machine
E2E=1 pnpm e2e                              # desktop specs, then phone specs, against pnpm start -p 3100
pnpm tsx scripts/confirm-race.mts           # concurrent admissions get consecutive roll numbers; a repeat confirm is refused
```

Expected: each command exits 0; vitest and Playwright report all tests passed (counts are in `docs/tdd.md`). The e2e specs and `confirm-race.mts` change seeded data (admissions, attendance), so reset the database (section 2) before re-running or demoing.

Load test (7,800 students reading results at once). Start the server with `E2E=1` so the sign-in rate limiter is off, then in a second terminal:

```bash
E2E=1 BETTER_AUTH_URL=http://localhost:3000 pnpm start     # terminal 1
BASE=http://localhost:3000 EMAIL=ankit.panda@termwise.demo N=7800 C=200 pnpm tsx scripts/load-results.mts   # terminal 2
```

`BASE`, `EMAIL`, `N`, `C` are optional script inputs (defaults shown), not app settings.

CI (`.github/workflows/ci.yml`) runs the same steps against Postgres 18 on every push to `main` and on pull requests.

## 4. Demo logins

Password for every account: `termwise-demo`. All data is synthetic.

| Email | Name | Role | Campus |
| --- | --- | --- | --- |
| `eng.admin@termwise.demo` | Sunita Rath | Office admin | Engineering College |
| `cse.faculty@termwise.demo` | Bibhu Prasad Sahoo | Faculty | Engineering College |
| `cse.faculty2@termwise.demo` | Madhusmita Nayak | Faculty | Engineering College |
| `me.faculty@termwise.demo` | Ranjan Kumar Jena | Faculty | Engineering College |
| `subhashree.mohanty@termwise.demo` | Subhashree Mohanty | Student | Engineering College |
| `prakash.mohanty@termwise.demo` | Prakash Mohanty | Parent | Engineering College |
| `ankit.panda@termwise.demo` | Ankit Panda | Student | Engineering College |
| `sarat.panda@termwise.demo` | Sarat Panda | Parent | Engineering College |
| `pallavi.jena@termwise.demo` | Pallavi Jena | Parent | Engineering College |
| `mgt.admin@termwise.demo` | Lopamudra Das | Office admin | Management School |
| `mba.faculty@termwise.demo` | Sandeep Mishra | Faculty | Management School |
| `farheen.ali@termwise.demo` | Farheen Ali | Student | Management School |
| `imran.ali@termwise.demo` | Imran Ali | Parent | Management School |
| `phr.admin@termwise.demo` | Sasmita Behera | Office admin | Pharmacy College |
| `phr.faculty@termwise.demo` | Debasis Mohapatra | Faculty | Pharmacy College |
| `phr.faculty2@termwise.demo` | Itishree Swain | Faculty | Pharmacy College |
| `visiting.faculty@termwise.demo` | Prakash Chandra Rout | Visiting faculty | Engineering + Management |
| `dual.role@termwise.demo` | Anjali Mohanty | Faculty + office admin | Engineering + Pharmacy |
| `eng.admissions@termwise.demo` | Smita Pattnaik | Admissions | Engineering College |
| `eng.exams@termwise.demo` | Nirakar Behera | Exams | Engineering College |
| `eng.accounts@termwise.demo` | Jyotirmayee Sahu | Accounts | Engineering College |
| `eng.hr@termwise.demo` | Bikash Chandra Dash | HR | Engineering College |
| `mgt.admissions@termwise.demo` | Gitanjali Mohapatra | Admissions | Management School |
| `mgt.exams@termwise.demo` | Rabindra Nath Satpathy | Exams | Management School |
| `mgt.accounts@termwise.demo` | Manasi Routray | Accounts | Management School |
| `mgt.hr@termwise.demo` | Tapan Kumar Swain | HR | Management School |
| `phr.admissions@termwise.demo` | Pratyusha Nanda | Admissions | Pharmacy College |
| `phr.exams@termwise.demo` | Santosh Kumar Barik | Exams | Pharmacy College |
| `phr.accounts@termwise.demo` | Sumitra Pradhan | Accounts | Pharmacy College |
| `phr.hr@termwise.demo` | Alok Ranjan Mahapatra | HR | Pharmacy College |
| `cse.hod@termwise.demo` | Dr. Soumya Ranjan Panigrahi | Head of department | Engineering College |
| `me.hod@termwise.demo` | Dr. Bhabani Shankar Nayak | Head of department | Engineering College |
| `mba.hod@termwise.demo` | Dr. Smita Rani Pattnaik | Head of department | Management School |
| `phr.hod@termwise.demo` | Dr. Ashok Kumar Sahu | Head of department | Pharmacy College |
| `trust@termwise.demo` | Bijay Mishra | Trust | All campuses |

Every student and guardian has a login too, `firstname.lastname@termwise.demo` (a number is added when a name is taken), for example `ankit.panda@termwise.demo` for the student and `sarat.panda@termwise.demo` for the parent. The guardian `pallavi.jena@termwise.demo` (parent of Amrita Jena, ENG-24-CSE-0001) receives messages in Odia: sign in and open Messages to read them.

### What to try first

- **Office admin:** `eng.admin@termwise.demo` confirms an applicant from **Applicants**, and advances a batch from College setup.
- **Faculty:** `cse.faculty@termwise.demo` marks attendance offline on a phone.
- **Head of department:** `cse.hod@termwise.demo` lists the department's students and approves a CSE leave request.
- **Admissions, exams, accounts and HR:** `eng.admissions@termwise.demo`, `eng.exams@termwise.demo`, `eng.accounts@termwise.demo` or `eng.hr@termwise.demo` each see only their narrow menu; `eng.accounts@termwise.demo` awards a scholarship on the fees page.
- **Visiting and dual-role:** `visiting.faculty@termwise.demo` and `dual.role@termwise.demo` switch the active campus in the sidebar.
- **Trust:** `trust@termwise.demo` compares campuses on the overview and opens the NAAC page.
- **Student and parent:** `ankit.panda@termwise.demo` or `sarat.panda@termwise.demo` opens fees and receipts on the portal.

Try first: sign in as `cse.faculty@termwise.demo` on a phone, open a class from Home, turn on airplane mode, mark it, and turn the network back on. Then sign in as `eng.admin@termwise.demo` to see the sheet, lock marks, record a fee payment and open the at-risk list.

Admissions and staff leave:

- **Confirm an admission (admin).** Sign in as `eng.admin@termwise.demo` and open **Applicants**. The seeded applicant **Ritika Nayak** has every required document verified, so she is ready to confirm. Open her panel and choose **Confirm admission**. The student gets the next roll number in the batch, two fee instalments and a guardian login with the demo password. The other seeded applicants show what is missing, and one applicant can be rejected with a reason.
- **Import applicants (admin).** On **Applicants**, choose **Import CSV**, pick the batch and a file (the template downloads from the dialog). Any bad line stops the whole file, and the dialog lists each line's error.
- **Staff leave (faculty).** Sign in as `cse.faculty@termwise.demo` and open **Leave**. Apply for leave, and see the balances and history. Withdraw the request while it is pending.
- **Approve staff leave (admin).** Sign in as `eng.admin@termwise.demo` and open **Leave**. Approve or reject the pending request from the Engineering campus, with a note. Nobody can decide their own leave.

To try the admission again, reset the database as above.

## 5. Troubleshooting

1. `pnpm db:migrate` fails with `ECONNREFUSED` or an undefined `DATABASE_URL`: the db is not up or the env is not exported. Run `docker compose ps db` (wait for healthy), then `set -a; . ./env.example; set +a`.
2. Port 54329 or 3000 already in use: stop the other process, or `docker compose down` and retry. Playwright uses port 3100.
3. Sign-in rejected or redirected to the wrong host: `BETTER_AUTH_URL` must equal the URL in the browser (`http://localhost:3000` locally).
4. Playwright or the load test hits rate limits or stale data: run with `E2E=1` (rate limiter off) and reset the database first (section 2).
5. `pnpm exec playwright install chromium` fails on missing libraries: rerun with `--with-deps`.
6. Assistant says no provider is configured: expected without an LLM key. Set `GOOGLE_GENERATIVE_AI_API_KEY` or `GROQ_API_KEY` and restart.
