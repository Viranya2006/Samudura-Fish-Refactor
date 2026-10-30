import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n from "i18next";

export type Theme = "light" | "dark";
export type Language = "en" | "si";

const STORAGE_KEY = "samudura-settings";

interface SettingsState {
  theme: Theme;
  language: Language;
  setTheme: (theme: Theme) => void;
  setLanguage: (lang: Language) => void;
  toggleTheme: () => void;
  hydrateFromStorage: () => void;
  initialize: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "light",
      language: "en",
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.toggle("dark", theme === "dark");
      },
      setLanguage: (lang) => {
        set({ language: lang });
        i18n.changeLanguage(lang);
      },
      toggleTheme: () =>
        set((state) => {
          const next = state.theme === "light" ? "dark" : "light";
          document.documentElement.classList.toggle("dark", next === "dark");
          return { theme: next };
        }),
      hydrateFromStorage: () => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const parsed = raw ? (JSON.parse(raw) as { state?: { theme?: Theme; language?: Language } }) : null;
          const theme = parsed?.state?.theme ?? "light";
          const language = parsed?.state?.language ?? "en";
          document.documentElement.classList.toggle("dark", theme === "dark");
          set({ theme, language });
        } catch {
          set({ theme: "light", language: "en" });
        }
      },
      initialize: () => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          const parsed = raw ? (JSON.parse(raw) as { state?: { theme?: Theme; language?: Language } }) : null;
          const theme = parsed?.state?.theme ?? "light";
          const language = parsed?.state?.language ?? "en";
          document.documentElement.classList.toggle("dark", theme === "dark");
          import("i18next").then(({ default: i18n }) => i18n.changeLanguage(language));
        } catch {
          document.documentElement.classList.remove("dark");
        }
      },
    }),
    {
      name: "samudura-settings",
      partialize: (state) => ({ theme: state.theme, language: state.language }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          document.documentElement.classList.toggle("dark", state.theme === "dark");
        }
      },
    }
  )
);
