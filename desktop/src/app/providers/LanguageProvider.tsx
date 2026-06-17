import React, { createContext, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  appLanguages,
  resolveAppLanguage,
  type AppLanguage,
} from "@/shared/i18n";

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  supportedLanguages: readonly AppLanguage[];
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { i18n } = useTranslation();

  const value = useMemo<LanguageContextValue>(
    () => ({
      language: resolveAppLanguage(i18n.resolvedLanguage ?? i18n.language),
      setLanguage: async (language) => {
        await i18n.changeLanguage(language);
      },
      supportedLanguages: appLanguages,
    }),
    [i18n, i18n.language, i18n.resolvedLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguagePreferences = () => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguagePreferences must be used within a LanguageProvider");
  }

  return context;
};
