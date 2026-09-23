import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en";
import vi from "./vi";
import { mapVi, mapEn } from "./map";
import { additionalVi, additionalEn } from "./additional";
import { accountVi, accountEn } from "./account";
import { bookingVi, bookingEn } from "./booking";

const storageKey = "tablenow-language";
let savedLanguage: string | null = null;
try {
  savedLanguage = localStorage.getItem(storageKey);
} catch {
  // Storage may be unavailable; language switching still works in memory.
}

i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
  try {
    localStorage.setItem(storageKey, language);
  } catch {
    // A blocked storage API must not prevent rendering.
  }
});

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { ...en.translation, ...additionalEn, ...mapEn, ...accountEn, ...bookingEn } },
    vi: { translation: { ...vi.translation, ...additionalVi, ...mapVi, ...accountVi, ...bookingVi } },
  },
  lng: savedLanguage === "en" ? "en" : "vi",
  fallbackLng: "vi",
  supportedLngs: ["vi", "en"],
  keySeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
