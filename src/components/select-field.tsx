"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string };

/**
 * The app's one dropdown. Works controlled (`value` + `onValueChange`) or inside a form (`name` + `defaultValue`).
 * `searchable` turns it into a type-to-filter combobox for long lists (faculty, subjects).
 * Empty string means "none picked"; a filter's "all" option should use value "".
 */
export function SelectField({ options, value, defaultValue, onValueChange, name, required, placeholder = "Select", searchable, active, size, className, ...aria }: {
  options: Option[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  placeholder?: string;
  searchable?: boolean;
  /** Filled style, for a filter that is narrowing a list. */
  active?: boolean;
  size?: "sm" | "default";
  className?: string;
  "aria-label"?: string;
  id?: string;
}) {
  const find = (v: string | undefined) => (v === undefined ? undefined : options.find((o) => o.value === v) ?? null);

  if (searchable) {
    return (
      <Combobox<Option> items={options} value={find(value)} defaultValue={find(defaultValue)} name={name} required={required}
        itemToStringLabel={(o) => o.label} itemToStringValue={(o) => o.value} isItemEqualToValue={(a, b) => a.value === b.value}
        onValueChange={(o) => onValueChange?.(o?.value ?? "")}>
        <ComboboxInput placeholder={placeholder} className={cn("h-9 bg-card", className)} {...aria} />
        <ComboboxContent>
          <ComboboxEmpty>No matches.</ComboboxEmpty>
          <ComboboxList>{(o: Option) => <ComboboxItem key={o.value} value={o}>{o.label}</ComboboxItem>}</ComboboxList>
        </ComboboxContent>
      </Combobox>
    );
  }

  return (
    <Select items={options} value={value} defaultValue={defaultValue} name={name} required={required}
      onValueChange={(v) => onValueChange?.((v as string | null) ?? "")}>
      <SelectTrigger size={size} id={aria.id} aria-label={aria["aria-label"]}
        className={cn("min-w-32", active && "bg-foreground text-background shadow-none [&_svg]:text-background", className)}>
        {/* Base UI treats "" as no value, so the "all" option's label doubles as the placeholder. */}
        <SelectValue placeholder={options.find((o) => o.value === "")?.label ?? placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start" className="w-auto min-w-(--anchor-width)">
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
