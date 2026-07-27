/**
 * @file AuthAlert.tsx
 * @description The threshold's one alarm surface: a collapsing crimson banner
 * for a failure the member can act on — a rejected sign-in, a dead link, a
 * server that did not answer. It owns its own live region, so every auth screen
 * announces a failure the same way and a call site is a single element.
 * Field-level problems do NOT come here: a message that belongs to one field
 * goes to that field's `error` prop, which tints it and prints the sentence
 * beneath it.
 * @architecture Enterprise SaaS 2026
 * @module features/auth/components/AuthAlert
 */

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { Text } from "@/shared/ui/primitives/typography";
import { EASE } from "@/shared/ui/kinematics/motion-presets";

interface AuthAlertProps {
  /** Already-translated sentence; a falsy value collapses the banner. */
  readonly message?: string | null;
}

export const AuthAlert = ({ message }: AuthAlertProps): React.JSX.Element => (
  <div aria-live="polite">
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: EASE.buttery }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-3 rounded-nested border border-ethereal-crimson/20 bg-ethereal-crimson/5 p-4">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-ethereal-crimson"
              aria-hidden="true"
            />
            <Text size="sm" color="crimson" className="leading-6">
              {message}
            </Text>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
