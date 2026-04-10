/**
 * @file useAccountActivation.ts
 * @description Hook managing the state and API calls for the account activation flow.
 * @module features/auth/hooks
 */

import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { authService } from "../api/auth.service";

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
    handleSubmit,
  };
};
