/**
 * @file PracticeDiagnosticsOverlay.tsx
 * @description On-screen readout of the practice engine's diagnostics log,
 * rendered only while the log is switched on (see practicePlayerDiagnostics).
 * It sits at the top of the screen so a second phone filming this one records
 * the counters beside the sound they explain; the full log leaves through the
 * share sheet as a text file. Developer tooling that choristers never reach,
 * so its labels stay untranslated English, like the log itself.
 */
import React, { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { practiceDiagnostics } from "./practicePlayerDiagnostics";

const formatDrift = (drift: number | null): string =>
  drift === null ? "–" : `${Math.round(drift * 1000)}ms`;

/** Hands the log to the share sheet as a file, then as text, else copies it. */
const shareLog = async (): Promise<string> => {
  const text = practiceDiagnostics.exportText();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = new File([text], `practice-diagnostics-${stamp}.txt`, {
    type: "text/plain",
  });
  try {
    if ("canShare" in navigator && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return "shared";
    }
    if ("share" in navigator) {
      await navigator.share({ text });
      return "shared";
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") return "cancelled";
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "share failed";
  }
};

const OverlayButton = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}): React.JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    className="rounded border border-ink-on-inverse/30 px-2 py-1 active:opacity-60"
  >
    <Eyebrow size="overline-sm" color="ink-on-inverse">
      {label}
    </Eyebrow>
  </button>
);

export const PracticeDiagnosticsOverlay = (): React.JSX.Element | null => {
  const { mode, counters, recent } = useSyncExternalStore(
    practiceDiagnostics.subscribe,
    practiceDiagnostics.getSnapshot,
  );
  const [status, setStatus] = useState<string | null>(null);

  if (mode === "off") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-0 z-toast px-2 pt-[env(safe-area-inset-top)]">
      <div className="pointer-events-auto mx-auto mt-1 max-w-xl rounded-lg bg-surface-inverse/90 p-2 shadow-glass-solid">
        <div className="flex flex-wrap items-center gap-1.5">
          <Eyebrow color="ink-on-inverse" className="mr-auto">
            {`diag · ${mode}`}
          </Eyebrow>
          <OverlayButton
            label={mode === "observe" ? "allow resync" : "no resync"}
            onClick={() =>
              practiceDiagnostics.setMode(mode === "observe" ? "log" : "observe")
            }
          />
          <OverlayButton
            label={status ?? "share"}
            onClick={() => {
              void shareLog().then((result) => {
                setStatus(result);
                window.setTimeout(() => setStatus(null), 2500);
              });
            }}
          />
          <OverlayButton label="clear" onClick={() => practiceDiagnostics.clear()} />
          <OverlayButton label="off" onClick={() => practiceDiagnostics.setMode("off")} />
        </div>
        <Text
          as="div"
          size="sm"
          weight="semibold"
          color="ink-on-inverse"
          className="mt-1 font-mono tabular-nums"
        >
          {`resync ${counters.resyncs} · over ${counters.overTolerance} · stall ${counters.stalls} · drift ${formatDrift(counters.lastDrift)} · settle ${counters.lastSettleMs === null ? "–" : `${counters.lastSettleMs}ms`}`}
        </Text>
        <Text
          as="pre"
          size="xs"
          color="ink-on-inverse-muted"
          className="mt-1 whitespace-pre-wrap break-all font-mono leading-snug"
        >
          {recent.join("\n")}
        </Text>
      </div>
    </div>,
    document.body,
  );
};
