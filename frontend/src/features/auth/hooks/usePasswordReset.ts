/**
 * @file usePasswordReset.ts
 * @description State + API for the two-sided password-reset flow: the public
 * "request a link" side (enumeration-safe) and the signed-link "set a new
 * password" side. Mode is derived from the presence of uid+token in the URL,
 * mirroring `useAccountActivation`.
 * @module features/auth/hooks
 */

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { parseApiError } from "@/shared/api/errors";
import { authService } from "../api/auth.service";

// Returns either an i18n key (translated by the page) or, for a server-provided
// password rule, the message verbatim. Reads the canonical error envelope via
// `parseApiError`, so it survives the `message` → `detail` field transition.
const getResetErrorMessage = (error: unknown): string => {
  const { code, fieldErrors, serverMessage } = parseApiError(error);

  if (fieldErrors.new_password) return fieldErrors.new_password;
  if (code === "expired_reset_link") return "auth.reset.errors.expired_link";
  if (code === "invalid_reset_link") return "auth.reset.errors.invalid_link";

  return serverMessage ?? "auth.reset.errors.reset_failed";
};

export const usePasswordReset = () => {
  const [searchParams] = useSearchParams();

  const resetContext = useMemo(
    () => ({
      uidb64: searchParams.get("uid") ?? searchParams.get("uidb64") ?? "",
      token: searchParams.get("token") ?? "",
    }),
    [searchParams],
  );

  const hasResetParams =
    resetContext.uidb64.length > 0 && resetContext.token.length > 0;
  const mode: "request" | "confirm" = hasResetParams ? "confirm" : "request";

  /* ── Request side (forgot password) ─────────────────────────────── */
  const [email, setEmail] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  const requestMutation = useMutation({
    mutationFn: authService.requestPasswordReset,
    onSuccess: () => {
      setRequestSubmitted(true);
      setRequestError(null);
    },
    onError: () => {
      setRequestError("auth.reset.errors.request_failed");
    },
  });

  const handleRequestSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!email.trim()) {
      setRequestError("auth.reset.errors.email_required");
      return;
    }
    setRequestError(null);
    await requestMutation.mutateAsync({ email: email.trim() });
  };

  /* ── Confirm side (set a new password) ──────────────────────────── */
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [resetData, setResetData] = useState<{ email: string } | null>(null);

  const confirmMutation = useMutation({
    mutationFn: authService.confirmPasswordReset,
    onSuccess: (data) => {
      setResetData({ email: data.email });
      setFormError(null);
    },
    onError: (error: unknown) => {
      setFormError(getResetErrorMessage(error));
    },
  });

  const handleConfirmSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!hasResetParams) {
      setFormError("auth.reset.errors.incomplete_link");
      return;
    }
    if (password.length < 8) {
      setFormError("auth.reset.errors.password_too_short");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("auth.reset.errors.password_mismatch");
      return;
    }

    setFormError(null);
    await confirmMutation.mutateAsync({
      uidb64: resetContext.uidb64,
      token: resetContext.token,
      new_password: password,
    });
  };

  return {
    mode,
    hasResetParams,
    // request
    email,
    setEmail,
    requestError,
    requestSubmitted,
    isRequesting: requestMutation.isPending,
    handleRequestSubmit,
    // confirm
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    formError,
    resetData,
    isConfirming: confirmMutation.isPending,
    handleConfirmSubmit,
  };
};
