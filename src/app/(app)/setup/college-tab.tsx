"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { SectionHeading } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCollege } from "./college-actions";
import { Field } from "./shared";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const LOGO_MAX = 200 * 1024;

type College = {
  legalName: string | null; tagline: string | null; addressLine1: string | null; addressLine2: string | null;
  city: string | null; state: string | null; pincode: string | null; phone: string | null; email: string | null;
  website: string | null; affiliation: string | null; registrationNo: string | null; gstin: string | null;
  logoDataUrl: string | null; receiptFooter: string | null;
};

export function CollegeTab({ campus }: { campus: College }) {
  const [busy, start] = useTransition();
  const [logo, setLogo] = useState(campus.logoDataUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return toast.error("Logo must be a PNG, JPEG, SVG or WebP image.");
    if (file.size > LOGO_MAX) return toast.error(`Logo is ${Math.round(file.size / 1024)} KB. Use an image under 200 KB.`);
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  }

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("logoDataUrl", logo ?? "");
    start(async () => {
      const r = await saveCollege(fd);
      if (r.error) toast.error(r.error);
      else toast.success("College profile saved.");
    });
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-muted-foreground">
        Printed on fee receipts. Leave a field blank to hide it.
      </p>
      <form onSubmit={save} className="mt-4 grid gap-4">
        <SectionHeading title="Logo" />
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid size-24 place-items-center rounded-md border bg-card p-2">
            {logo ? <img src={logo} alt="College logo preview" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">No logo</span>}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose logo</Button>
            {logo && <Button type="button" variant="ghost" size="sm" onClick={() => setLogo(null)}>Remove logo</Button>}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" onChange={pickLogo} aria-label="College logo file" />
          <p className="basis-full text-sm text-muted-foreground">PNG, JPEG, SVG or WebP, under 200 KB.</p>
        </div>

        <SectionHeading title="Identity" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Legal name"><Input name="legalName" defaultValue={campus.legalName ?? ""} /></Field>
          <Field label="Tagline"><Input name="tagline" defaultValue={campus.tagline ?? ""} /></Field>
          <Field label="Affiliation"><Input name="affiliation" defaultValue={campus.affiliation ?? ""} /></Field>
          <Field label="Registration no"><Input name="registrationNo" defaultValue={campus.registrationNo ?? ""} /></Field>
          <Field label="GSTIN"><Input name="gstin" maxLength={15} defaultValue={campus.gstin ?? ""} /></Field>
        </div>

        <SectionHeading title="Address and contact" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Address line 1"><Input name="addressLine1" defaultValue={campus.addressLine1 ?? ""} /></Field>
          <Field label="Address line 2"><Input name="addressLine2" defaultValue={campus.addressLine2 ?? ""} /></Field>
          <Field label="City"><Input name="city" defaultValue={campus.city ?? ""} /></Field>
          <Field label="State"><Input name="state" defaultValue={campus.state ?? ""} /></Field>
          <Field label="Pincode"><Input name="pincode" defaultValue={campus.pincode ?? ""} /></Field>
          <Field label="Phone"><Input name="phone" defaultValue={campus.phone ?? ""} /></Field>
          <Field label="Email"><Input name="email" type="email" defaultValue={campus.email ?? ""} /></Field>
          <Field label="Website"><Input name="website" defaultValue={campus.website ?? ""} /></Field>
        </div>

        <SectionHeading title="Receipt" />
        <Field label="Receipt footer" hint="Shown at the bottom of every fee receipt.">
          <Textarea name="receiptFooter" rows={3} defaultValue={campus.receiptFooter ?? ""} />
        </Field>

        <div>
          <Button type="submit" disabled={busy}>Save college profile</Button>
        </div>
      </form>
    </div>
  );
}
