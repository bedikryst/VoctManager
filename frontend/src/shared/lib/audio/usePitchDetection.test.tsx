/**
 * @file usePitchDetection.test.tsx
 * @description The one promise the capture makes: a microphone is never left
 * live. Every way a capture can end is driven here against a stubbed
 * `getUserMedia` and audio graph, and each asserts the tracks were stopped.
 * The paths that matter most are the ones nobody sees on a screen: a grant
 * that arrives after the singer cancelled, a graph that throws after the
 * grant, and a track the system ends mid-capture.
 *
 * The pitch analysis itself is real (`pitchy`): the stubbed analyser feeds it
 * a sine, so the hold test also proves a sung A3 comes back as MIDI 57.
 * @module shared/lib/audio/usePitchDetection
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

import {
  openToneContext,
  releaseToneSession,
} from "@/shared/lib/audio/toneContext";

import { usePitchDetection } from "./usePitchDetection";

vi.mock("@/shared/lib/audio/toneContext", () => ({
  openToneContext: vi.fn(),
  releaseToneSession: vi.fn(),
}));

const SAMPLE_RATE = 48000;
const A3_HZ = 220;
const A3_MIDI = 57;
const WINDOW = { low: 48, high: 72 };

/** The frequency the stubbed analyser hears, or null for silence. */
let singingHz: number | null = null;

class FakeNode {
  readonly disconnect = vi.fn();
  connect<T>(target: T): T {
    return target;
  }
}

class FakeAnalyser extends FakeNode {
  fftSize = 2048;
  getFloatTimeDomainData(buffer: Float32Array): void {
    for (let i = 0; i < buffer.length; i += 1) {
      buffer[i] =
        singingHz === null
          ? 0
          : 0.5 * Math.sin((2 * Math.PI * singingHz * i) / SAMPLE_RATE);
    }
  }
}

class FakeGain extends FakeNode {
  readonly gain = { value: 1 };
}

const makeContext = (graphThrows: boolean): AudioContext =>
  ({
    sampleRate: SAMPLE_RATE,
    destination: new FakeNode(),
    createMediaStreamSource: () => {
      if (graphThrows) {
        throw new DOMException("sample-rate mismatch", "NotSupportedError");
      }
      return new FakeNode();
    },
    createAnalyser: () => new FakeAnalyser(),
    createGain: () => new FakeGain(),
  }) as unknown as AudioContext;

interface FakeTrack {
  readonly stop: ReturnType<typeof vi.fn>;
  readonly addEventListener: (type: string, listener: () => void) => void;
  /** What the system does on a call or a revoked permission. */
  readonly endBySystem: () => void;
}

const makeTrack = (): FakeTrack => {
  const onEnded: (() => void)[] = [];
  return {
    stop: vi.fn(),
    addEventListener: (type, listener) => {
      if (type === "ended") onEnded.push(listener);
    },
    endBySystem: () => onEnded.forEach((listener) => listener()),
  };
};

const streamOf = (track: FakeTrack): MediaStream =>
  ({ getTracks: () => [track] }) as unknown as MediaStream;

/** Each `getUserMedia` call waits until the test grants or refuses it. */
interface PendingRequest {
  readonly grant: (stream: MediaStream) => void;
  readonly refuse: (error: unknown) => void;
}
let requests: PendingRequest[] = [];

/** Frames run only when the test steps them, with its own timestamps. */
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;
let clock = 0;

const stepFrames = (durationMs: number, stepMs = 16): void => {
  const until = clock + durationMs;
  while (clock < until && frames.size > 0) {
    clock += stepMs;
    const due = [...frames.values()];
    frames.clear();
    due.forEach((callback) => callback(clock));
  }
};

/** Lets the `getUserMedia` answer and everything chained on it settle. */
const settle = (): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, 0));

const renderCapture = (onHeld: (midi: number) => void = () => undefined) =>
  renderHook(() => usePitchDetection(WINDOW, onHeld));

type Rendered = ReturnType<typeof renderCapture>;

/** Starts a capture, grants it a stream with one track, and waits out the
 *  analysis loading after the grant. */
const listen = async (
  rendered: Rendered,
  track: FakeTrack = makeTrack(),
): Promise<FakeTrack> => {
  act(() => rendered.result.current.start());
  act(() => requests[requests.length - 1].grant(streamOf(track)));
  // The first test pays for transforming `pitchy`; the default second is tight.
  await waitFor(
    () => expect(rendered.result.current.status).not.toBe("starting"),
    { timeout: 5000 },
  );
  return track;
};

let graphThrows = false;

beforeEach(() => {
  singingHz = null;
  graphThrows = false;
  requests = [];
  frames = new Map();
  nextFrame = 1;
  clock = 0;
  vi.mocked(openToneContext).mockImplementation(() => makeContext(graphThrows));
  vi.mocked(releaseToneSession).mockClear();
  Object.defineProperty(window.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: () =>
        new Promise<MediaStream>((grant, refuse) => {
          requests.push({ grant, refuse });
        }),
    },
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextFrame;
    nextFrame += 1;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
});

afterEach(() => {
  // Unmounted here, while the stubbed frames still exist, rather than by the
  // shared cleanup that runs after these stubs are gone.
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window.navigator, "mediaDevices");
  Reflect.deleteProperty(document, "visibilityState");
});

describe("usePitchDetection", () => {
  it("stops the microphone before reporting a held note", async () => {
    const track = makeTrack();
    let stoppedBeforeHeld = false;
    const onHeld = vi.fn(() => {
      stoppedBeforeHeld = track.stop.mock.calls.length > 0;
    });
    const rendered = renderCapture(onHeld);
    await listen(rendered, track);
    expect(rendered.result.current.status).toBe("listening");

    singingHz = A3_HZ;
    act(() => stepFrames(1000));

    expect(onHeld).toHaveBeenCalledTimes(1);
    expect(onHeld).toHaveBeenCalledWith(A3_MIDI);
    expect(stoppedBeforeHeld).toBe(true);
    expect(rendered.result.current.status).toBe("idle");
    expect(rendered.result.current.cursor).toBeNull();
    expect(frames.size).toBe(0);
    expect(releaseToneSession).toHaveBeenCalledTimes(1);
  });

  it("stops the microphone on cancel", async () => {
    const rendered = renderCapture();
    const track = await listen(rendered);

    act(() => rendered.result.current.cancel());

    expect(track.stop).toHaveBeenCalled();
    expect(rendered.result.current.status).toBe("idle");
    expect(frames.size).toBe(0);
    expect(releaseToneSession).toHaveBeenCalledTimes(1);
  });

  it("stops the microphone on unmount", async () => {
    const rendered = renderCapture();
    const track = await listen(rendered);

    rendered.unmount();

    expect(track.stop).toHaveBeenCalled();
    expect(frames.size).toBe(0);
    expect(releaseToneSession).toHaveBeenCalledTimes(1);
  });

  it("stops the microphone when the page is hidden", async () => {
    const rendered = renderCapture();
    const track = await listen(rendered);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(track.stop).toHaveBeenCalled();
    expect(rendered.result.current.status).toBe("idle");
    expect(releaseToneSession).toHaveBeenCalledTimes(1);
  });

  it("stops a grant that arrives after the capture was cancelled", async () => {
    const rendered = renderCapture();
    act(() => rendered.result.current.start());
    act(() => rendered.result.current.cancel());

    const track = makeTrack();
    await act(async () => {
      requests[0].grant(streamOf(track));
      await settle();
    });

    expect(track.stop).toHaveBeenCalled();
    expect(rendered.result.current.status).toBe("idle");
    expect(frames.size).toBe(0);
    expect(releaseToneSession).toHaveBeenCalledTimes(1);
  });

  it("stops the microphone when wiring the analysis throws", async () => {
    graphThrows = true;
    const rendered = renderCapture();
    const track = await listen(rendered);

    expect(track.stop).toHaveBeenCalled();
    expect(rendered.result.current.status).toBe("unavailable");
    expect(frames.size).toBe(0);
    expect(releaseToneSession).toHaveBeenCalledTimes(1);
  });

  it("stops listening when the system ends the track", async () => {
    const rendered = renderCapture();
    const track = await listen(rendered);

    act(() => track.endBySystem());

    expect(rendered.result.current.status).toBe("idle");
    expect(frames.size).toBe(0);
    expect(releaseToneSession).toHaveBeenCalledTimes(1);
  });

  it("says denied on a refusal and holds no session", async () => {
    const rendered = renderCapture();
    act(() => rendered.result.current.start());
    await act(async () => {
      requests[0].refuse(new DOMException("refused", "NotAllowedError"));
      await settle();
    });

    expect(rendered.result.current.status).toBe("denied");
    expect(releaseToneSession).toHaveBeenCalledTimes(1);
  });
});
