/**
 * @file RecordActions.tsx
 * @description Inline creation and confirmed removal of child records.
 */

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { InlineConfirmAction } from "../components/InlineConfirmAction";
import type { PieceAutosave } from "./usePieceAutosave";

export const RecordRemove = ({ label, remove, autosave }: {
  label: string;
  remove: () => Promise<unknown>;
  autosave: PieceAutosave;
}) => {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);
  return (
    <InlineConfirmAction
      icon={Trash2}
      label={label}
      confirmLabel={t("archive.review.delete")}
      isPending={pending}
      onConfirm={() => {
        setPending(true);
        void autosave.enqueue(remove).catch(autosave.showSaveError).finally(() => setPending(false));
      }}
    />
  );
};

export const RecordAdd = ({ label, disabled, children, onSubmit, onOpenChange }: {
  label: string;
  disabled?: boolean;
  children: ReactNode;
  onSubmit: (data: FormData) => Promise<unknown> | string;
  onOpenChange?: (open: boolean) => void;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    onOpenChange?.(false);
    setError(undefined);
    requestAnimationFrame(() => trigger.current?.focus());
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const result = onSubmit(new FormData(event.currentTarget));
    if (typeof result === "string") {
      setError(result);
      return;
    }
    setError(undefined);
    setPending(true);
    void result.then(close, () => setError(t("archive.review.save_failed"))).finally(() => setPending(false));
  };
  return open ? (
    <form className="space-y-2 border-t border-hairline py-3" onSubmit={submit}>
      <fieldset disabled={disabled || pending} className="space-y-2">
        {children}
      </fieldset>
      {error && <Text size="sm" role="alert" color="crimson">{error}</Text>}
      <div className="flex flex-wrap gap-1">
        <Button type="submit" casing="sentence" size="sm" variant="outline" isLoading={pending} disabled={disabled}>
          {t("archive.review.save_row")}
        </Button>
        <Button type="button" casing="sentence" size="sm" variant="ghost" onClick={close} disabled={pending}>
          {t("common.actions.cancel")}
        </Button>
      </div>
    </form>
  ) : (
    <Button
      ref={trigger}
      type="button"
      casing="sentence"
      size="sm"
      variant="ghost"
      disabled={disabled}
      leftIcon={<Plus size={16} aria-hidden="true" />}
      onClick={() => {
        setOpen(true);
        onOpenChange?.(true);
      }}
    >
      {label}
    </Button>
  );
};

export const formText = (data: FormData, field: string) => String(data.get(field) ?? "").trim();
