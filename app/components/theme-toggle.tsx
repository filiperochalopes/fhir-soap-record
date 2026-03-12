import { useEffect, useState } from "react";

const storageKey = "theme-preference";

type ThemePreference = "light" | "dark" | "system";

function applyTheme(theme: ThemePreference) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle(
    "dark",
    theme === "dark" || (theme === "system" && systemDark),
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    const stored = (localStorage.getItem(storageKey) as ThemePreference | null) ?? "system";
    setTheme(stored);
    applyTheme(stored);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const current = (localStorage.getItem(storageKey) as ThemePreference | null) ?? "system";
      if (current === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <span className="hidden text-[color:var(--muted)] sm:inline">Theme</span>
      <select
        aria-label="Theme"
        className="min-w-28"
        value={theme}
        onChange={(event) => {
          const nextTheme = event.target.value as ThemePreference;
          setTheme(nextTheme);
          localStorage.setItem(storageKey, nextTheme);
          applyTheme(nextTheme);
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}

