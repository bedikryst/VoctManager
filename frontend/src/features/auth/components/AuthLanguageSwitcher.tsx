/**
 * @file AuthLanguageSwitcher.tsx
 * @description Compact 3-button language selector for unauthenticated auth pages.
 * Persists to localStorage via i18next's built-in LanguageDetector.
 * No API calls needed — the user is not yet authenticated.
 * @architecture Enterprise SaaS 2026
 * @module features/auth/components/AuthLanguageSwitcher
 */

import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Globe } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const SUPPORTED_LANGUAGES = ["pl", "en", "fr"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const buttonVariants = cva(
  [
    "relative px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
    "transition-colors duration-150 rounded-lg",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/60",
  ],
  {
    variants: {
      active: {
        true: "text-ethereal-gold",
        false:
          "text-ethereal-graphite/50 hover:text-ethereal-graphite transition-colors",
      },
    },
    defaultVariants: { active: false },
  },
);

interface AuthLanguageSwitcherProps {
  className?: string;
}

export const AuthLanguageSwitcher: React.FC<AuthLanguageSwitcherProps> = ({
  className,
}) => {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language as SupportedLanguage;

  const handleChange = useCallback(
    (lang: SupportedLanguage) => {
      if (lang === currentLang) return;
      void i18n.changeLanguage(lang);
      document.documentElement.lang = lang;
    },
    [i18n, currentLang],
  );

  return (
    <nav
      aria-label={t("auth.language_switcher.aria_label")}
      className={cn("flex items-center gap-1", className)}
    >
      <Globe
        className="h-3 w-3 text-ethereal-graphite/40 mr-0.5 shrink-0"
        aria-hidden="true"
      />

      {SUPPORTED_LANGUAGES.map((lang, index) => (
        <React.Fragment key={lang}>
          <button
            type="button"
            onClick={() => handleChange(lang)}
            aria-label={t(`auth.language_switcher.${lang}_full`)}
            aria-current={currentLang === lang ? "true" : undefined}
            className={buttonVariants({ active: currentLang === lang })}
          >
            {currentLang === lang && (
              <motion.span
                layoutId="lang-indicator"
                className="absolute inset-0 rounded-lg bg-ethereal-gold/12"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                aria-hidden="true"
              />
            )}
            <span className="relative">
              {t(`auth.language_switcher.${lang}`)}
            </span>
          </button>

          {index < SUPPORTED_LANGUAGES.length - 1 && (
            <span
              className="text-[10px] text-ethereal-graphite/20 select-none"
              aria-hidden="true"
            >
              /
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
