"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY, type ThemePreference } from "./theme";

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Colors fade for a moment while the theme changes, then transitions are removed again.
let switchingTimer: ReturnType<typeof setTimeout> | undefined;

function applyTheme(preference: ThemePreference, animate: boolean) {
  const root = document.documentElement;
  const theme = preference === "dark" || (preference === "system" && systemPrefersDark()) ? "dark" : "light";
  if (root.getAttribute("data-theme") === theme) return;
  if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.setAttribute("data-theme-switching", "");
    clearTimeout(switchingTimer);
    switchingTimer = setTimeout(() => root.removeAttribute("data-theme-switching"), 260);
  }
  root.setAttribute("data-theme", theme);
}

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function ThemeToggle() {
  // Rendered as "system" on the server; the real choice is read after mount.
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPreference(readPreference());
    setMounted(true);
  }, []);

  // While following the system, follow it live when the OS switches (e.g. at sunset).
  useEffect(() => {
    if (!mounted) return;
    applyTheme(preference, true);
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system", true);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference, mounted]);

  const choose = (value: ThemePreference) => {
    setPreference(value);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // Private windows may block storage; the choice still applies for this visit.
    }
  };

  const selectedIndex = OPTIONS.findIndex(option => option.value === preference);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="relative grid grid-cols-3 p-1 mb-2 bg-gray-100 rounded-lg"
    >
      {/* Sliding highlight behind the chosen option. */}
      <span
        aria-hidden
        className={`absolute top-1 bottom-1 left-1 rounded-md bg-white shadow-sm transition-transform duration-200 ease-out ${mounted ? "opacity-100" : "opacity-0"}`}
        style={{ width: "calc((100% - 0.5rem) / 3)", transform: `translateX(${selectedIndex * 100}%)` }}
      />
      {OPTIONS.map(({ value, label, icon: OptionIcon }) => {
        const active = mounted && preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => choose(value)}
            className={`relative z-10 flex items-center justify-center h-7 rounded-md transition-colors ${
              active ? "text-gray-900" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <OptionIcon className="w-4 h-4" />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
