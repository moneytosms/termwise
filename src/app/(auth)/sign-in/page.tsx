"use client";

import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxGroup, ComboboxInput, ComboboxItem, ComboboxLabel, ComboboxList } from "@/components/ui/combobox";
import { Mark } from "@/components/mark";
import { FeatureShowcase } from "./feature-showcase";
import { PERSONAS, type Persona } from "./personas";

const client = createAuthClient();

// One group per campus and role, in the order personas are listed.
const GROUPS = PERSONAS.reduce<{ value: string; items: Persona[] }[]>((groups, p) => {
  const value = `${p.campus} · ${p.role}`;
  const group = groups.find((g) => g.value === value);
  if (group) group.items.push(p);
  else groups.push({ value, items: [p] });
  return groups;
}, []);

// Typed text matches a persona's name, email, role or campus.
function matches(p: Persona, query: string) {
  const q = query.trim().toLowerCase();
  return [p.name, p.email, p.role, p.campus].some((s) => s.toLowerCase().includes(q));
}

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
    // Full reload on purpose: picks up the new session cookie everywhere.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/home";
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_minmax(28rem,36rem)]">
      <section className="relative hidden flex-col justify-center gap-8 overflow-hidden bg-muted px-10 py-10 lg:flex xl:px-16" aria-label="About Termwise">
        <FeatureShowcase />
        <p className="text-sm text-muted-foreground">One student record, from admission to graduation.</p>
      </section>

      <section className="flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <p className="mb-6 flex items-center gap-3 text-xl font-semibold tracking-tight"><Mark className="size-10" />Termwise</p>
          <h1 className="text-2xl leading-tight font-semibold tracking-[-0.02em]">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use your college account.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
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
          <div className="mt-6 rounded-xl bg-card p-4 text-sm shadow-sheet">
            <p className="font-medium">Demo accounts</p>
            <p className="mt-0.5 text-muted-foreground">Password: termwise-demo. Every student and parent has one too, as firstname.lastname@termwise.demo.</p>
            <Combobox<Persona>
              items={GROUPS}
              filter={matches}
              itemToStringLabel={(p) => p.name}
              isItemEqualToValue={(a, b) => a.email === b.email}
              onValueChange={(p) => { if (!p) return; setEmail(p.email); setPassword("termwise-demo"); }}
            >
              <ComboboxInput aria-label="Demo login" placeholder="Search by name, role or campus" className="mt-3 h-11 w-full" />
              <ComboboxContent>
                <ComboboxEmpty>No demo login matches.</ComboboxEmpty>
                <ComboboxList>
                  {(group: (typeof GROUPS)[number]) => (
                    <ComboboxGroup key={group.value} items={group.items}>
                      <ComboboxLabel>{group.value}</ComboboxLabel>
                      <ComboboxCollection>
                        {(p: Persona) => (
                          <ComboboxItem key={p.email} value={p}>
                            <span className="font-medium">{p.name}</span>
                            <span className="text-muted-foreground">{p.role}, {p.campus}</span>
                          </ComboboxItem>
                        )}
                      </ComboboxCollection>
                    </ComboboxGroup>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        </div>
      </section>
    </main>
  );
}

