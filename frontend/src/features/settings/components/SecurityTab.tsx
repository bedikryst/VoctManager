/**
 * @file SecurityTab.tsx
 * @description "Bezpieczeństwo i logowanie" pane: password rotation with
 * visibility toggles, a live strength read and confirm-match validation, plus
 * the e-mail change flow (re-auth with current password) that the backend
 * always supported but the UI never exposed. Field-level errors mirror the
 * backend error codes (invalid_current_password, email_in_use).
 * @architecture Enterprise SaaS 2026
 * @module features/settings/components/SecurityTab
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AtSign,
  CheckCircle2,
  KeyRound,
  Mail,
  ShieldCheck,
} from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

import { GlassCard } from "@ui/composites/GlassCard";
import { SectionHeader } from "@ui/composites/SectionHeader";
import { Input } from "@ui/primitives/Input";
import { PasswordInput } from "@ui/primitives/PasswordInput";
import { PasswordStrengthMeter } from "@ui/composites/PasswordStrengthMeter";
import { Button } from "@ui/primitives/Button";
import { Text, Caption } from "@ui/primitives/typography";
import { DURATION, EASE } from "@ui/kinematics/motion-presets";
import {
  useChangeEmail,
  useChangePassword,
  useSettingsData,
} from "../api/settings.queries";
import type { ApiErrorResponse } from "../types/settings.dto";

/* ── Pane ───────────────────────────────────────────────────────── */

export const SecurityTab = () => {
  const { t } = useTranslation();
  const { data: user } = useSettingsData();
  const { mutateAsync: changePassword, isPending: isChangingPassword } =
    useChangePassword();
  const { mutateAsync: changeEmail, isPending: isChangingEmail } =
    useChangeEmail();

  const [passwords, setPasswords] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordErrorCode, setPasswordErrorCode] = useState<string | null>(
    null,
  );
  const [mismatch, setMismatch] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [emailForm, setEmailForm] = useState({ new_email: "", password: "" });
  const [emailErrorCode, setEmailErrorCode] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorCode(null);
    setPasswordSuccess(false);

    if (passwords.new_password !== passwords.confirm_password) {
      setMismatch(true);
      return;
    }
    setMismatch(false);

    try {
      await changePassword({
        old_password: passwords.old_password,
        new_password: passwords.new_password,
      });
      setPasswordSuccess(true);
      setPasswords({ old_password: "", new_password: "", confirm_password: "" });
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (error: unknown) {
      if (axios.isAxiosError<ApiErrorResponse>(error)) {
        setPasswordErrorCode(
          error.response?.data?.error_code ?? "unknown_error",
        );
      } else {
        setPasswordErrorCode("unknown_error");
      }
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailErrorCode(null);
    setEmailSuccess(false);

    try {
      await changeEmail(emailForm);
      setEmailSuccess(true);
      setEmailForm({ new_email: "", password: "" });
      setTimeout(() => setEmailSuccess(false), 4000);
    } catch (error: unknown) {
      if (axios.isAxiosError<ApiErrorResponse>(error)) {
        setEmailErrorCode(error.response?.data?.error_code ?? "unknown_error");
      } else {
        setEmailErrorCode("unknown_error");
      }
    }
  };

  const confirmError = mismatch
    ? t(
        "settings.security.password_mismatch",
        "Hasła różnią się od siebie. Wpisz je ponownie.",
      )
    : undefined;

  return (
    <GlassCard variant="light" isHoverable={false}>
      <SectionHeader
        title={t("settings.security.title", "Bezpieczeństwo i logowanie")}
        icon={<ShieldCheck className="h-5 w-5" />}
      />
      <Text color="muted" className="mb-6 mt-1">
        {t(
          "settings.security.subtitle",
          "Zarządzaj hasłem oraz adresem e-mail, którym logujesz się do platformy.",
        )}
      </Text>

      {/* ── Password rotation ─────────────────────────── */}
      <div className="space-y-5">
        <SectionHeader
          title={t("settings.security.password_section", "Zmiana hasła")}
          icon={<KeyRound className="h-4 w-4" />}
          withFluidDivider
        />

        <form
          onSubmit={handlePasswordChange}
          className="max-w-md space-y-5"
          aria-label={t("settings.security.password_section", "Zmiana hasła")}
        >
          <PasswordInput
            label={t("settings.security.oldPassword", "Obecne hasło")}
            value={passwords.old_password}
            onChange={(value) =>
              setPasswords((prev) => ({ ...prev, old_password: value }))
            }
            autoComplete="current-password"
            disabled={isChangingPassword}
            error={
              passwordErrorCode === "invalid_current_password"
                ? t(
                    "settings.errors.invalid_current_password",
                    "Błędne obecne hasło.",
                  )
                : undefined
            }
          />

          <div className="space-y-0.5">
            <PasswordInput
              label={t("settings.security.newPassword", "Nowe hasło")}
              value={passwords.new_password}
              onChange={(value) => {
                setPasswords((prev) => ({ ...prev, new_password: value }));
                setMismatch(false);
              }}
              autoComplete="new-password"
              disabled={isChangingPassword}
            />
            <PasswordStrengthMeter password={passwords.new_password} />
          </div>

          <PasswordInput
            label={t("settings.security.confirmPassword", "Powtórz nowe hasło")}
            value={passwords.confirm_password}
            onChange={(value) => {
              setPasswords((prev) => ({ ...prev, confirm_password: value }));
              setMismatch(false);
            }}
            autoComplete="new-password"
            disabled={isChangingPassword}
            error={confirmError}
          />

          <AnimatePresence>
            {passwordSuccess && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: DURATION.fast, ease: EASE.buttery }}
                className="overflow-hidden"
              >
                <GlassCard variant="outline" padding="sm" isHoverable={false}>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-ethereal-sage" />
                    <Text size="sm" color="sage">
                      {t(
                        "settings.security.success",
                        "Hasło zostało pomyślnie zmienione.",
                      )}
                    </Text>
                  </div>
                </GlassCard>
              </motion.div>
            )}

            {passwordErrorCode &&
              passwordErrorCode !== "invalid_current_password" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: DURATION.fast, ease: EASE.buttery }}
                  className="overflow-hidden"
                >
                  <GlassCard variant="outline" padding="sm" isHoverable={false}>
                    <Text size="sm" color="crimson">
                      {t(
                        "settings.errors.unknown_error",
                        "Wystąpił błąd. Spróbuj ponownie.",
                      )}
                    </Text>
                  </GlassCard>
                </motion.div>
              )}
          </AnimatePresence>

          <div className="pt-1">
            <Button
              type="submit"
              isLoading={isChangingPassword}
              variant="secondary"
            >
              {t("settings.security.updatePassword", "Zmień hasło")}
            </Button>
          </div>
        </form>
      </div>

      {/* ── E-mail change ─────────────────────────────── */}
      <div className="mt-10 space-y-5">
        <SectionHeader
          title={t("settings.security.email_section", "Adres e-mail")}
          icon={<Mail className="h-4 w-4" />}
          withFluidDivider
        />

        <Text size="sm" color="muted" className="max-w-md leading-relaxed">
          {t("settings.security.email_desc", {
            defaultValue:
              "Obecny adres logowania: {{email}}. Zmiana wymaga potwierdzenia obecnym hasłem.",
            email: user?.email ?? "—",
          })}
        </Text>

        <form
          onSubmit={handleEmailChange}
          className="max-w-md space-y-5"
          aria-label={t("settings.security.email_section", "Adres e-mail")}
        >
          <div className="flex w-full flex-col gap-1.5">
            <Input
              type="email"
              label={t("settings.security.new_email", "Nowy adres e-mail")}
              placeholder={t(
                "settings.security.new_email_placeholder",
                "nowy@adres.pl",
              )}
              value={emailForm.new_email}
              onChange={(e) =>
                setEmailForm((prev) => ({ ...prev, new_email: e.target.value }))
              }
              leftIcon={<AtSign className="h-4 w-4" />}
              hasError={emailErrorCode === "email_in_use"}
              disabled={isChangingEmail}
              autoComplete="email"
              required
            />
            <AnimatePresence>
              {emailErrorCode === "email_in_use" && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: DURATION.fast, ease: EASE.buttery }}
                >
                  <Caption color="crimson" className="pl-1">
                    {t(
                      "settings.errors.email_in_use",
                      "Ten adres e-mail jest już zajęty.",
                    )}
                  </Caption>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <PasswordInput
            label={t(
              "settings.security.email_password",
              "Potwierdź obecnym hasłem",
            )}
            value={emailForm.password}
            onChange={(value) =>
              setEmailForm((prev) => ({ ...prev, password: value }))
            }
            autoComplete="current-password"
            disabled={isChangingEmail}
            error={
              emailErrorCode === "invalid_current_password"
                ? t(
                    "settings.errors.invalid_current_password",
                    "Błędne obecne hasło.",
                  )
                : undefined
            }
          />

          <AnimatePresence>
            {emailSuccess && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: DURATION.fast, ease: EASE.buttery }}
                className="overflow-hidden"
              >
                <GlassCard variant="outline" padding="sm" isHoverable={false}>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-ethereal-sage" />
                    <Text size="sm" color="sage">
                      {t(
                        "settings.security.email_success",
                        "Adres e-mail został zaktualizowany. Od teraz loguj się nowym adresem.",
                      )}
                    </Text>
                  </div>
                </GlassCard>
              </motion.div>
            )}

            {emailErrorCode &&
              emailErrorCode !== "invalid_current_password" &&
              emailErrorCode !== "email_in_use" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: DURATION.fast, ease: EASE.buttery }}
                  className="overflow-hidden"
                >
                  <GlassCard variant="outline" padding="sm" isHoverable={false}>
                    <Text size="sm" color="crimson">
                      {t(
                        "settings.errors.unknown_error",
                        "Wystąpił błąd. Spróbuj ponownie.",
                      )}
                    </Text>
                  </GlassCard>
                </motion.div>
              )}
          </AnimatePresence>

          <div className="pt-1">
            <Button
              type="submit"
              isLoading={isChangingEmail}
              variant="secondary"
            >
              {t("settings.security.update_email", "Zmień adres e-mail")}
            </Button>
          </div>
        </form>
      </div>
    </GlassCard>
  );
};
