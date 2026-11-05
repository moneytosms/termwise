// Server-safe half of settings: the layout inlines SETTINGS_BOOT in <head> so the preset applies before first paint.
export const SETTINGS_KEY = "termwise:settings";

export const SETTINGS_BOOT = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||"{}"),d=document.documentElement.dataset;d.preset=s.preset||"default";d.density=s.density||"comfortable";d.motion=s.reduceMotion?"reduce":"full"}catch(e){}`;
