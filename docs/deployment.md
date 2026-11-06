# Deployment

Repository: https://github.com/moneytosms/termwise
Live app: https://termwise-s1vj.onrender.com

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
pnpm tsx scripts/confirm-race.mts          # two concurrent admissions get consecutive roll numbers; a repeat confirm is refused
```

The race script confirms applicants in the seeded database, so reset the database (above) before using the demo again.

### Load test

Simulates 7,800 students reading results at once, with one signed-in session reused for every request. Start the server first, with `E2E=1` so the sign-in rate limiter is off and `BETTER_AUTH_URL` set to the same origin the script calls:

```bash
pnpm build
E2E=1 BETTER_AUTH_URL=http://localhost:3000 pnpm start
BASE=http://localhost:3000 EMAIL=ankit.panda@termwise.demo N=7800 C=200 pnpm tsx scripts/load-results.mts
```

The script reads four optional inputs: `BASE` (default `http://localhost:3000`), `EMAIL` (default `ankit.panda@termwise.demo`), `N` (requests, default 7800) and `C` (concurrency, default 200). They are script inputs, not app settings. It signs in with the demo password.

The plain-English assistant and AI-worded risk reasons need an LLM key. Without one the assistant says no provider is configured, and risk reasons use the rule's own wording.

## How it is deployed

One Docker web service and one Postgres database on Render, defined in `render.yaml`.

1. Render dashboard, **New > Blueprint**, pick this repository. Render creates the `termwise` web service and the `termwise-db` database.
2. Fill the prompted values:
   - `BETTER_AUTH_URL`: the service's public URL.
   - `ASSISTANT_DATABASE_URL`: the database's internal URL with the user and password replaced by `termwise_assistant` and a new random password. The migration sets that password on the read-only role.
   - `GOOGLE_GENERATIVE_AI_API_KEY`: a Gemini API key.
3. The container migrates and seeds on start. On a seeded database the sample data is skipped, but portal logins and the marks scheme backfill still run; both are idempotent.
4. Daily job: in GitHub repository settings, add secrets `APP_URL` (the public URL) and `CRON_SECRET` (copy from the Render service). The `Daily job` workflow calls it at 06:00 IST; run it by hand from the Actions tab.

No new service or variable for receipts: the QR code is drawn on the server by the `qrcode` package, so no outside service is called.

CI (`.github/workflows/ci.yml`) runs type checks, lint, unit tests, build and the end-to-end tests against Postgres on every push to `main`.

Free tier limits: the web service sleeps when idle, so the first request takes about a minute. The free database expires after 30 days.

## Environment variables

Names only. `env.example` holds local-only defaults.

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | App database connection |
| `ASSISTANT_DATABASE_URL` | Read-only role the assistant's queries run as |
| `BETTER_AUTH_SECRET` | Signs sessions and receipt verification hashes. Changing it makes issued receipts fail verification |
| `BETTER_AUTH_URL` | Public URL of the app |
| `CRON_SECRET` | Shared secret for the daily job endpoint |
| `LLM_PROVIDER` | `google` (Gemini) or `groq` |
| `LLM_DAILY_CAP` | Maximum LLM calls per day across the app |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini key, when `LLM_PROVIDER=google` |
| `GROQ_API_KEY` | Groq key, when `LLM_PROVIDER=groq` |

## Demo logins

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

Try first: sign in as `cse.faculty@termwise.demo` on a phone, open a class from Home, turn on airplane mode, mark it, and turn the network back on. Then sign in as `eng.admin@termwise.demo` to see the sheet, lock marks, record a fee payment and open the at-risk list.

Admissions and staff leave:

- **Confirm an admission (admin).** Sign in as `eng.admin@termwise.demo` and open **Applicants**. The seeded applicant **Ritika Nayak** has every required document verified, so she is ready to confirm. Open her panel and choose **Confirm admission**. The student gets the next roll number in the batch, two fee instalments and a guardian login with the demo password. The other seeded applicants show what is missing, and one applicant can be rejected with a reason.
- **Import applicants (admin).** On **Applicants**, choose **Import CSV**, pick the batch and a file (the template downloads from the dialog). Any bad line stops the whole file, and the dialog lists each line's error.
- **Staff leave (faculty).** Sign in as `cse.faculty@termwise.demo` and open **Leave**. Apply for leave, and see the balances and history. Withdraw the request while it is pending.
- **Approve staff leave (admin).** Sign in as `eng.admin@termwise.demo` and open **Leave**. Approve or reject the pending request from the Engineering campus, with a note. Nobody can decide their own leave.

To try the admission again, reset the database as above.
