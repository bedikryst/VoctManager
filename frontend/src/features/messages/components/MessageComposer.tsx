/**
 * @file MessageComposer.tsx
 * @description The one composer both conversation panes use — a thread and a
 * channel had a copy each.
 *
 * Three things it settles. The field grows with what is being written instead of
 * standing two rows tall while empty and scrolling internally once full. It
 * carries `resize-none`: `Textarea`'s drag handle is a pointer affordance and on
 * a phone it is a grab target in the corner of the one control that matters.
 * And Enter sends only where there is a keyboard to press it on — on touch the
 * return key writes a second paragraph, which is the only way to write one.
 *
 * It wears the conversation's own type scale rather than the form shell's: the
 * reading size the member picked is the size they write at too.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/components
 */

import React, { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Textarea } from "@/shared/ui/primitives/Textarea";
import { Text } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";
import { useIsFinePointer } from "@/shared/lib/dom/useMediaQuery";
import { MESSAGE_BODY_TEXT, useMessageTextStep } from "../lib/messageTextScale";

/**
 * A share of the screen, not a line count: about six lines at the default touch
 * size and fewer as the reader raises it. Past this the composer would be eating
 * the conversation it is a reply to; the field scrolls inside itself instead.
 */
const MAX_FIELD_HEIGHT_PX = 168;

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder: string;
  /** Stated above the field when sending would change the conversation's state. */
  hint?: string;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  value,
  onChange,
  onSend,
  placeholder,
  hint,
}) => {
  const { t } = useTranslation();
  const isFinePointer = useIsFinePointer();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  // Not read, only depended on: a taller type scale rewraps what is already
  // typed, and a height measured at the old size is wrong from that instant on.
  const textStep = useMessageTextStep();

  // Measured, not counted: the height depends on the wrapped line count, which
  // only the browser knows. Reset to `auto` first or `scrollHeight` can never
  // report a shrink — and add the border back, because Preflight makes every box
  // `border-box` while `scrollHeight` reports the padding box: assigning it
  // straight leaves the field permanently two pixels short of its own content.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    const borderHeight = field.offsetHeight - field.clientHeight;
    field.style.height = `${Math.min(
      field.scrollHeight + borderHeight,
      MAX_FIELD_HEIGHT_PX,
    )}px`;
  }, [value, textStep]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isFinePointer) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  const sendLabel = t("messages.send", "Wyślij");
  const isEmpty = !value.trim();

  return (
    <div className="shrink-0 border-t border-hairline-strong p-3">
      {hint && (
        <Text size="xs" color="muted" className="mb-2 px-1">
          {hint}
        </Text>
      )}
      <div className="flex items-end gap-2">
        {/* min-w-0 defeats the textarea's intrinsic `cols` width, which would
            otherwise keep the composer wider than a phone. */}
        <div className="min-w-0 flex-1">
          <Textarea
            ref={fieldRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={placeholder}
            aria-label={placeholder}
            // The shell's own scale is replaced, not overlaid: reading size IS
            // writing size, so the field grows with the bubbles above it. That
            // replacement takes the shell's line-height with it — tailwind-merge
            // resolves a font-size as owning one — so the leading is restated
            // here, unitless so it follows the step, and AFTER the size or the
            // same rule would delete it too.
            className={cn(
              "resize-none overflow-y-auto",
              MESSAGE_BODY_TEXT,
              "leading-normal",
            )}
          />
        </div>
        {isFinePointer ? (
          <Button
            type="button"
            onClick={onSend}
            disabled={isEmpty}
            leftIcon={<Send size={14} />}
          >
            {sendLabel}
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            onClick={onSend}
            disabled={isEmpty}
            aria-label={sendLabel}
            title={sendLabel}
            className="shrink-0"
          >
            <Send size={18} />
          </Button>
        )}
      </div>
    </div>
  );
};

MessageComposer.displayName = "MessageComposer";
