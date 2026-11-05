// Simulates 7,800 students reading results concurrently: one signed-in session is reused for every request.
// Documented assumption: a shared cookie stands in for many students, so this measures the route and the database, not sign-in.
// Usage: BASE=http://localhost:3000 EMAIL=ankit.panda@termwise.demo N=7800 C=200 pnpm tsx scripts/load-results.mts
const BASE = process.env.BASE ?? "http://localhost:3000";
const EMAIL = process.env.EMAIL ?? "ankit.panda@termwise.demo";
const N = Number(process.env.N ?? 7800);
const C = Number(process.env.C ?? 200);

const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: "termwise-demo" }),
});
if (!signIn.ok) throw new Error(`Sign-in failed: ${signIn.status}`);
const cookie = signIn.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

const latencies: number[] = [];
let errors = 0;
let next = 0;

async function worker() {
  while (next < N) {
    next++;
    const started = performance.now();
    try {
      const res = await fetch(`${BASE}/api/results`, { headers: { cookie } });
      await res.arrayBuffer();
      if (!res.ok) errors++;
    } catch {
      errors++;
    }
    latencies.push(performance.now() - started);
  }
}

const started = performance.now();
await Promise.all(Array.from({ length: C }, worker));
const seconds = (performance.now() - started) / 1000;

latencies.sort((a, b) => a - b);
const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.ceil(p * latencies.length) - 1)].toFixed(1);
console.log(`requests: ${N}, concurrency: ${C}, errors: ${errors}`);
console.log(`total time: ${seconds.toFixed(2)} s, req/s: ${(N / seconds).toFixed(1)}`);
console.log(`latency ms p50: ${pct(0.5)}, p95: ${pct(0.95)}, p99: ${pct(0.99)}`);
