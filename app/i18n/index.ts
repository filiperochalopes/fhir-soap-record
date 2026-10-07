import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ptBR from "~/i18n/locales/pt-BR";

export const DEFAULT_LOCALE = "pt-BR";

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    lng: DEFAULT_LOCALE,
    resources: { [DEFAULT_LOCALE]: { translation: ptBR } },
  });
}

export default i18n;
