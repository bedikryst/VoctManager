/**
 * @file useAccountActivation.ts
 * @description Hook managing the state and API calls for the account activation flow.
 * @module features/auth/hooks
 */

import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { authService } from "../api/auth.service";

const getActivationErrorMessage = (error: any): string => {
  const errorCode = error?.response?.data?.error_code;
  const passwordErrors = error?.response?.data?.validation_errors?.new_password;

  if (Array.isArray(passwordErrors) && passwordErrors.length > 0) {
    return passwordErrors[0];
  }

  if (errorCode === "expired_activation_link") {
    return "This activation link has expired. Request a fresh invitation from the administrator.";
  }

  if (errorCode === "invalid_activation_link") {
    return "This activation link is invalid. Verify the full URL or request a new invitation.";
  }

  return (
    error?.response?.data?.message ||
    "Account activation failed. Verify the link details and try again."
  );
};

export const useAccountActivation = () => {
  const [searchParams] = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [activatedData, setActivatedData] = useState<{
    email: string;
    username: string;
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

  const activationMutation = useMutation({
    mutationFn: authService.activateAccount,
    onSuccess: (data) => {
      setActivatedData({ email: data.email, username: data.username });
      setFormError(null);
    },
    onError: (error) => {
      setFormError(getActivationErrorMessage(error));
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasActivationParams) {
      setFormError(
        "The activation link is incomplete. Open the latest invitation email and try again.",
      );
      return;
    }

    if (password.length < 8) {
      setFormError("Use a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("The password confirmation does not match.");
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
    handleSubmit,
  };
};
