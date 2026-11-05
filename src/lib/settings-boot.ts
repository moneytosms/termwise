// Server-safe half of settings: the root layout inlines SETTINGS_BOOT in <head> so the preset applies
// before first paint, and the save action validates against PRESETS.
export const PRESETS = [
  { id: "default", label: "Register" },
  { id: "catppuccin", label: "Catppuccin" },
  { id: "nord", label: "Nord" },
  { id: "tokyo-night", label: "Tokyo Night" },
  { id: "rose-pine", label: "Rosé Pine" },
] as const;

export const SETTINGS_KEY = "termwise:settings";

export const SETTINGS_BOOT = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||"{}"),d=document.documentElement.dataset;d.preset=s.preset||"default";d.density=s.density||"comfortable";d.motion=s.reduceMotion?"reduce":"full"}catch(e){}`;
