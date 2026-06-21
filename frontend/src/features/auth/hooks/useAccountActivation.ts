/**
 * @file useAccountActivation.ts
 * @description Hook managing the state and API calls for the account activation flow.
 * @module features/auth/hooks
 */

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { isAxiosError } from "axios";
import { authService } from "../api/auth.service";
import { changeAppLanguage } from "@/shared/config/i18n";

/** Mirrors i18n `supportedLngs` — guards what we'll adopt from an untrusted link. */
const SUPPORTED_LANGS = new Set(["pl", "en", "fr"]);

const getActivationErrorMessage = (error: unknown): string => {
  if (isAxiosError(error) && error.response?.data) {
    const { error_code, validation_errors, message } = error.response.data;
    const passwordErrors = validation_errors?.new_password;

    if (Array.isArray(passwordErrors) && passwordErrors.length > 0) {
      return passwordErrors[0];
    }

    if (error_code === "expired_activation_link") {
      return "auth.activate.errors.expired_link";
    }

    if (error_code === "invalid_activation_link") {
      return "auth.activate.errors.invalid_link";
    }

    return message || "auth.activate.errors.activation_failed";
  }

  return "auth.activate.errors.activation_failed";
};

export const useAccountActivation = () => {
  const [searchParams] = useSearchParams();
  const { i18n } = useTranslation();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [activatedData, setActivatedData] = useState<{
    email: string;
  } | null>(null);

  const activationContext = useMemo(
    () => ({
      uidb64: searchParams.get("uid") ?? searchParams.get("uidb64") ?? "",
      token: searchParams.get("token") ?? "",
    }),
    [searchParams],
  );

  const hasActivationParams =
    activationContext.uidb64.length > 0 && activationContext.token.length > 0;

  // The invited member's chosen language drives this whole pre-login threshold.
  // Adopt it instantly from the link (no English flash before any request),
  // persisting it to localStorage — so the post-activation screen and the login
  // page that follow stay in it. After sign-in, AuthProvider re-adopts the
  // server's profile.language as the lasting source of truth.
  const urlLang = searchParams.get("lang");
  useEffect(() => {
    if (urlLang && SUPPORTED_LANGS.has(urlLang)) {
      changeAppLanguage(urlLang);
    }
  }, [urlLang]);

  // Resolve the invitee's name from the signed link so the screen can greet
  // them before they set a password. Read-only; failure falls back to generic.
  const previewQuery = useQuery({
    queryKey: ["activation-preview", activationContext.uidb64, activationContext.token],
    queryFn: () => authService.previewActivation(activationContext),
    enabled: hasActivationParams,
    retry: false,
    staleTime: Infinity,
  });

  const invitee = previewQuery.data;

  // Reaffirm from the server's authoritative value once the preview resolves —
  // covers a missing/tampered ?lang= on the link.
  const inviteeLang = invitee?.language;
  useEffect(() => {
    if (inviteeLang && SUPPORTED_LANGS.has(inviteeLang)) {
      changeAppLanguage(inviteeLang);
    }
  }, [inviteeLang]);

  const resolvedName = invitee
    ? i18n.language?.startsWith("pl")
      ? invitee.first_name_vocative || invitee.first_name
      : invitee.first_name
    : "";
  const inviteeName = resolvedName.trim() || null;

  const activationMutation = useMutation({
    mutationFn: authService.activateAccount,
    onSuccess: (data) => {
      setActivatedData({ email: data.email });
      setFormError(null);
    },
    onError: (error: unknown) => {
      setFormError(getActivationErrorMessage(error));
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasActivationParams) {
      setFormError("auth.activate.errors.incomplete_link");
      return;
    }

    if (password.length < 8) {
      setFormError("auth.activate.errors.password_too_short");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("auth.activate.errors.password_mismatch");
      return;
    }

    setFormError(null);
    await activationMutation.mutateAsync({
      uidb64: activationContext.uidb64,
      token: activationContext.token,
      new_password: password,
    });
  };

  return {
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    formError,
    activatedData,
    isSubmitting: activationMutation.isPending,
    hasActivationParams,
    inviteeName,
    handleSubmit,
  };
};
