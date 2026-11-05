"use client";

import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mark } from "@/components/mark";
import { FeatureShowcase } from "./feature-showcase";

const client = createAuthClient();

const DEMO = [
  { label: "Faculty", email: "faculty@termwise.demo" },
  { label: "Office admin", email: "admin@termwise.demo" },
];
const PORTAL = [
  { label: "Student", href: "/demo/student" },
  { label: "Parent", href: "/demo/parent" },
];

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await client.signIn.email({ email, password });
    if (error) {
      setError(error.status === 401 ? "That email or password is wrong." : error.status === 429 ? "Too many tries. Wait a few seconds and try again." : "Couldn't sign in. Check your connection and try again.");
      setBusy(false);
      return;
    }
    window.location.href = "/home";
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_minmax(28rem,36rem)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-muted px-10 py-10 lg:flex xl:px-16" aria-label="About Termwise">
        <p className="flex items-center gap-2.5 text-[0.95rem] font-semibold tracking-tight"><Mark />Termwise</p>
        <FeatureShowcase />
        <p className="text-sm text-muted-foreground">One student record, from admission to graduation.</p>
      </section>

      <section className="flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <p className="mb-10 flex items-center gap-2.5 text-[0.95rem] font-semibold tracking-tight lg:hidden"><Mark />Termwise</p>
          <h1 className="text-2xl leading-tight font-semibold tracking-[-0.02em]">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use your college account.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
          </form>
          <div className="mt-8 rounded-xl bg-card p-4 text-sm shadow-sheet">
            <p className="font-medium">Demo accounts</p>
            <p className="mt-0.5 text-muted-foreground">Password: termwise-demo</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO.map((d) => (
                <Button key={d.email} type="button" variant="outline" className="h-10" onClick={() => { setEmail(d.email); setPassword("termwise-demo"); }}>
                  {d.label}
                </Button>
              ))}
              {PORTAL.map((d) => (
                <Button key={d.href} variant="outline" className="h-10" nativeButton={false} render={<a href={d.href} />}>
                  {d.label}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">No password: opens the portal link they&apos;d get by message.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

