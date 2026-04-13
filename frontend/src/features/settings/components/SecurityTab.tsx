/**
 * @file SecurityTab.tsx
 * @description Secure interface for changing passwords and sensitive account data.
 * Fully type-safe error handling to prevent runtime UI crashes.
 * @module features/settings/components
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound, ShieldCheck } from "lucide-react";
import axios from "axios";

import { GlassCard } from "@ui/composites/GlassCard";
import { Input } from "@ui/primitives/Input";
import { Button } from "@ui/primitives/Button";
import { useChangePassword } from "../api/settings.queries";
import type { ApiErrorResponse } from "../types/settings.dto";

export default function SecurityTab() {
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
      // Clean up sensitive state immediately after success
      setPasswords({ old_password: "", new_password: "" });
    } catch (error: unknown) {
      // Type-safe error extraction (Zero Tolerance for 'any')
      if (axios.isAxiosError<ApiErrorResponse>(error)) {
        setErrorCode(error.response?.data?.error_code || "unknown_error");
      } else {
        setErrorCode("unknown_error");
      }
    }
  };

  return (
    <GlassCard>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-stone-900">
          {t("settings.security.title", "Bezpieczeństwo")}
        </h2>
        <p className="text-sm text-stone-500">
          {t(
            "settings.security.subtitle",
            "Zarządzaj hasłem i zabezpieczeniami konta.",
          )}
        </p>
      </div>

      <form onSubmit={handlePasswordChange} className="max-w-md space-y-6">
        <Input
          type="password"
          placeholder={t("settings.security.oldPassword", "Obecne hasło")}
          value={passwords.old_password}
          onChange={(e) =>
            setPasswords({ ...passwords, old_password: e.target.value })
          }
          leftIcon={<KeyRound className="w-4 h-4" />}
          hasError={errorCode === "invalid_current_password"}
          required
        />
        {errorCode === "invalid_current_password" && (
          <p className="text-xs text-red-500 font-medium pl-1 mt-1">
            {t(
              "settings.errors.invalid_current_password",
              "Błędne obecne hasło.",
            )}
          </p>
        )}

        <Input
          type="password"
          placeholder={t("settings.security.newPassword", "Nowe hasło")}
          value={passwords.new_password}
          onChange={(e) =>
            setPasswords({ ...passwords, new_password: e.target.value })
          }
          leftIcon={<ShieldCheck className="w-4 h-4" />}
          required
        />

        {success && (
          <div className="p-3 bg-green-50 text-green-700 text-sm rounded-xl border border-green-200">
            {t(
              "settings.security.success",
              "Hasło zostało pomyślnie zmienione.",
            )}
          </div>
        )}

        <div className="pt-2">
          <Button type="submit" isLoading={isPending} variant="secondary">
            {t("settings.security.updatePassword", "Zmień Hasło")}
          </Button>
        </div>
      </form>
    </GlassCard>
  );
}
