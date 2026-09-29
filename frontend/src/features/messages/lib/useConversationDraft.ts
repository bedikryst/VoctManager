/**
 * @file useConversationDraft.ts
 * @description The composer's text, and the way an undelivered reply gets back
 * into it. Shared by the thread and the channel pane so both treat a failed
 * send the same way.
 * @architecture Enterprise SaaS 2026
 * @module features/messages/lib
 */

import { useCallback, useState } from "react";

export interface ConversationDraft {
  draft: string;
  setDraft: (value: string) => void;
  /**
   * Puts a reply the server never took back in front of whatever the reader
   * has typed since: it was written first, and nothing typed after it is lost.
   */
  restoreUndelivered: (body: string) => void;
}

export const useConversationDraft = (): ConversationDraft => {
  const [draft, setDraft] = useState("");

  const restoreUndelivered = useCallback((body: string) => {
    setDraft((current) => (current.trim() ? `${body}\n\n${current}` : body));
  }, []);

  return { draft, setDraft, restoreUndelivered };
};
