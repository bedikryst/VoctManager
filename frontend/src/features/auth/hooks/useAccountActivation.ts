/**
 * @file useAccountActivation.ts
 * @description Hook managing the state and API calls for the account activation flow.
 * @module features/auth/hooks
 */

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { parseApiError } from "@/shared/api/errors";
import { authService } from "../api/auth.service";
import { LEGAL_DOCS_VERSION } from "../components/LegalContent";
import { changeAppLanguage } from "@/shared/config/i18n";

/** Mirrors i18n `supportedLngs` — guards what we'll adopt from an untrusted link. */
const SUPPORTED_LANGS = new Set(["pl", "en", "fr"]);

/**
 * What we know about the link the member arrived on. `checking` is a real state
 * and not a variant of `ok`: until the signed preview answers we do not know
 * whose invitation this is, nor whether it is still alive, so the screen must
 * not paint a password form that a dead link will yank away a moment later.
 */
export type ActivationLinkStatus = "checking" | "ok" | "expired" | "invalid";

export const useAccountActivation = () => {
  const [searchParams] = useSearchParams();
  const { i18n } = useTranslation();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Three separate slots, because they are read in three places: the two field
  // messages sit under the fields they judge, and `formError` is the banner for
  // whatever the server refused.
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
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

  // A signed preview that comes back rejected tells us the link itself is dead
  // *before* the member wastes effort on the password form. Only the two
  // definitive link codes gate the form; a transient failure (offline, 500)
  // stays "ok" so they can still try to submit and get a precise error then.
  // A link with no parameters at all is simply an invalid link — it used to
  // render the whole form, disabled, under an advisory box.
  const previewErrorCode = previewQuery.error
    ? parseApiError(previewQuery.error).code
    : null;
  const linkStatus: ActivationLinkStatus = !hasActivationParams
    ? "invalid"
    : previewQuery.isLoading
      ? "checking"
      : previewErrorCode === "expired_activation_link"
        ? "expired"
        : previewErrorCode === "invalid_activation_link"
          ? "invalid"
          : "ok";

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

  // The address the invitation was sent to — stated while the password is being
  // set, because it is the login half of the credential the member is creating.
  const inviteeEmail = invitee?.email?.trim() || null;

  const activationMutation = useMutation({
    mutationFn: authService.activateAccount,
    onSuccess: (data) => {
      setActivatedData({ email: data.email });
      setFormError(null);
    },
    onError: (error: unknown) => {
      const { code, fieldErrors, serverMessage } = parseApiError(error);

      // A server-side password rule is a verdict on one field, so it belongs
      // under that field rather than in the banner.
      if (fieldErrors.new_password) {
        setPasswordError(fieldErrors.new_password);
        return;
      }
      if (code === "expired_activation_link") {
        setFormError("auth.activate.errors.expired_link");
        return;
      }
      if (code === "invalid_activation_link") {
        setFormError("auth.activate.errors.invalid_link");
        return;
      }
      setFormError(serverMessage ?? "auth.activate.errors.activation_failed");
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Every failing rule is named at once: a form that reveals its objections
    // one refusal at a time makes the member guess how many are left.
    const nextPasswordError =
      password.length < 8 ? "auth.activate.errors.password_too_short" : null;
    const nextConfirmError =
      !nextPasswordError && password !== confirmPassword
        ? "auth.activate.errors.password_mismatch"
        : null;
    const nextTermsError = termsAccepted
      ? null
      : "auth.activate.errors.terms_required";

    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    setTermsError(nextTermsError);
    setFormError(null);

    if (nextPasswordError || nextConfirmError || nextTermsError) return;

    // Consent is enforced right above, so reaching the mutation means the
    // member accepted the version of the documents this build displays.
    await activationMutation.mutateAsync({
      uidb64: activationContext.uidb64,
      token: activationContext.token,
      new_password: password,
      terms_version: LEGAL_DOCS_VERSION,
    });
  };

  return {
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    termsAccepted,
    setTermsAccepted,
    passwordError,
    confirmError,
    termsError,
    formError,
    activatedData,
    isSubmitting: activationMutation.isPending,
    inviteeName,
    inviteeEmail,
    linkStatus,
    handleSubmit,
  };
};
