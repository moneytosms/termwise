"use client";

import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const client = createAuthClient();

const DEMO = [
  { label: "Faculty", email: "faculty@termwise.demo" },
  { label: "Office admin", email: "admin@termwise.demo" },
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
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Termwise</h1>
        <p className="mt-1 text-sm text-muted-foreground">Use your college account.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        </form>
        <div className="mt-8 rounded-xl border bg-card p-4 text-sm">
          <p className="font-medium">Demo accounts</p>
          <p className="mt-0.5 text-muted-foreground">Password: <span className="font-mono">termwise-demo</span></p>
          <div className="mt-3 flex gap-2">
            {DEMO.map((d) => (
              <Button key={d.email} type="button" variant="outline" size="sm" onClick={() => { setEmail(d.email); setPassword("termwise-demo"); }}>
                {d.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
