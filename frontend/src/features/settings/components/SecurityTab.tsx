import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound, ShieldCheck, CheckCircle2 } from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

import { GlassCard } from "@ui/composites/GlassCard";
import { SectionHeader } from "@ui/composites/SectionHeader";
import { Input } from "@ui/primitives/Input";
import { Button } from "@ui/primitives/Button";
import { Text, Caption } from "@ui/primitives/typography";
import { DURATION, EASE } from "@ui/kinematics/motion-presets";
import { useChangePassword } from "../api/settings.queries";
import type { ApiErrorResponse } from "../types/settings.dto";

export const SecurityTab = () => {
  const { t } = useTranslation();
  const { mutateAsync: changePassword, isPending } = useChangePassword();

  const [passwords, setPasswords] = useState({
    old_password: "",
    new_password: "",
  });
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorCode(null);
    setSuccess(false);

    try {
      await changePassword(passwords);
      setSuccess(true);
      setPasswords({ old_password: "", new_password: "" });
    } catch (error: unknown) {
      if (axios.isAxiosError<ApiErrorResponse>(error)) {
        setErrorCode(error.response?.data?.error_code ?? "unknown_error");
      } else {
        setErrorCode("unknown_error");
      }
    }
  };

  return (
    <GlassCard variant="light" isHoverable={false}>
      <SectionHeader
        title={t("settings.security.title", "Bezpieczeństwo")}
        icon={<ShieldCheck className="w-5 h-5" />}
      />
      <Text color="muted" className="mt-1 mb-6">
        {t(
          "settings.security.subtitle",
          "Zarządzaj hasłem i zabezpieczeniami konta.",
        )}
      </Text>

      <form onSubmit={handlePasswordChange} className="max-w-md space-y-5">
        <div className="space-y-1.5">
          <Input
            type="password"
            label={t("settings.security.oldPassword", "Obecne hasło")}
            placeholder="••••••••"
            value={passwords.old_password}
            onChange={(e) =>
              setPasswords({ ...passwords, old_password: e.target.value })
            }
            leftIcon={<KeyRound className="w-4 h-4" />}
            hasError={errorCode === "invalid_current_password"}
            required
          />
          <AnimatePresence>
            {errorCode === "invalid_current_password" && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: DURATION.fast, ease: EASE.buttery }}
              >
                <Caption color="crimson" className="pl-1">
                  {t(
                    "settings.errors.invalid_current_password",
                    "Błędne obecne hasło.",
                  )}
                </Caption>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Input
          type="password"
          label={t("settings.security.newPassword", "Nowe hasło")}
          placeholder="••••••••"
          value={passwords.new_password}
          onChange={(e) =>
            setPasswords({ ...passwords, new_password: e.target.value })
          }
          leftIcon={<ShieldCheck className="w-4 h-4" />}
          required
        />

        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: DURATION.fast, ease: EASE.buttery }}
              className="overflow-hidden"
            >
              <GlassCard variant="outline" padding="sm" isHoverable={false}>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-ethereal-sage shrink-0" />
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

          {errorCode && errorCode !== "invalid_current_password" && (
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

        <div className="pt-2">
          <Button type="submit" isLoading={isPending} variant="secondary">
            {t("settings.security.updatePassword", "Zmień Hasło")}
          </Button>
        </div>
      </form>
    </GlassCard>
  );
};
