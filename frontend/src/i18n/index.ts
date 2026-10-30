import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import si from "./si.json";

const STORAGE_KEY = "samudura_lang";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    si: { translation: si },
  },
  lng: localStorage.getItem(STORAGE_KEY) ?? "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export const changeLanguage = (lng: "en" | "si") => {
  i18n.changeLanguage(lng);
  localStorage.setItem(STORAGE_KEY, lng);
};
