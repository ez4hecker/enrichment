export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "growthinfi-theme";

/**
 * Runs in <head> before the first paint, so a dark-mode user never sees the light dashboard
 * flash first. "system" (the default) follows the operating system. Keep it in sync with
 * applyTheme in theme-toggle.tsx.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;
