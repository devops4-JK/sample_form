import { createContext, useContext, useEffect, useMemo, useState } from "react";

/** The accent colour: the CompanyStore logo red (#E01E23). Any other
    colour saved earlier (such as green) falls back to red. */
export const ACCENTS = [{ id: "red", label: "Red", swatch: "#e01e23" }];

const ACCENT_IDS = ACCENTS.map((a) => a.id);

const read = (key, fallback) => {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    // Private window with storage blocked: fall back for this session only.
    return fallback;
  }
};

const write = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* nothing to do: the choice just won't outlive the tab */
  }
};

const ThemeContext = createContext({
  theme: "light",
  toggleTheme: () => {},
  accent: "red",
  setAccent: () => {},
});

/**
 * Holds the appearance choices: light or dark, and the accent colour (always
 * the logo red).
 *
 * Both are applied to <html> here, so every page keeps them, and both are
 * read back from localStorage on load, so a refresh looks the same.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = read("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [accent, setAccentState] = useState(() => {
    const saved = read("accent");
    return ACCENT_IDS.includes(saved) ? saved : "red";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    write("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
    write("accent", accent);
  }, [accent]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((t) => (t === "light" ? "dark" : "light")),
      setTheme: (next) => setTheme(next === "dark" ? "dark" : "light"),
      accent,
      setAccent: (id) => setAccentState(ACCENT_IDS.includes(id) ? id : "red"),
    }),
    [theme, accent]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);