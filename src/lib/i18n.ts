// Minimal i18n scaffolding (currently English-only; ready to extend).
import { useEffect, useState } from "react";
import { prefsStore } from "./prefs-store";

const DICT: Record<string, Record<string, string>> = {
  en: {},
  hi: { Dashboard: "डैशबोर्ड", Settings: "सेटिंग्स", Profile: "प्रोफ़ाइल", "New Request": "नया अनुरोध" },
  ta: { Dashboard: "முகப்பு", Settings: "அமைப்புகள்", Profile: "சுயவிவரம்" },
};

export function useLang() {
  const [lang, setLang] = useState<string>(() => (typeof window === "undefined" ? "en" : prefsStore.get().language));
  useEffect(() => {
    const f = () => setLang(prefsStore.get().language);
    window.addEventListener("prefs-updated", f);
    return () => window.removeEventListener("prefs-updated", f);
  }, []);
  return { lang, t: (k: string) => DICT[lang]?.[k] ?? k };
}
