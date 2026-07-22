import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface StreamingTextRendererProps {
  text: string;
  isStreaming?: boolean;
  children: (visibleText: string) => ReactNode;
}

const INITIAL_VISIBLE_GRAPHEMES = 3;
const MAX_GRAPHEMES_PER_FRAME = 24;
const MAX_FRAME_DELTA_MS = 50;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const getGraphemesPerSecond = (remaining: number) => {
  if (remaining > 720) {
    return 240;
  }
  if (remaining > 360) {
    return 180;
  }
  if (remaining > 120) {
    return 120;
  }
  return 60;
};

const splitGraphemes = (text: string): string[] => {
  if (typeof Intl.Segmenter !== "function") {
    return Array.from(text);
  }

  const segmenter = new Intl.Segmenter("zh-CN", {
    granularity: "grapheme",
  });
  return Array.from(segmenter.segment(text), ({ segment }) => segment);
};

const getPrefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(REDUCED_MOTION_QUERY).matches;

/**
 * Keeps canonical streamed text intact while exposing a frame-paced visible
 * prefix to a caller-owned renderer. It adds no wrapper element and knows
 * nothing about Markdown, chat messages, or transport events.
 */
export function StreamingTextRenderer({
  text,
  isStreaming = false,
  children,
}: StreamingTextRendererProps) {
  const graphemes = useMemo(() => splitGraphemes(text), [text]);
  const targetRef = useRef(graphemes);
  targetRef.current = graphemes;

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    getPrefersReducedMotion,
  );
  const initialVisibleCount =
    isStreaming && !prefersReducedMotion
      ? Math.min(INITIAL_VISIBLE_GRAPHEMES, graphemes.length)
      : graphemes.length;
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);
  const visibleCountRef = useRef(initialVisibleCount);
  const previousTextRef = useRef(text);
  const previousStreamingRef = useRef(isStreaming);
  const frameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const frameBudgetRef = useRef(0);

  const cancelFrame = () => {
    if (frameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    lastFrameTimeRef.current = null;
    frameBudgetRef.current = 0;
  };

  const commitVisibleCount = (nextCount: number) => {
    visibleCountRef.current = nextCount;
    setVisibleCount(nextCount);
  };

  const scheduleFrame = () => {
    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame((frameTime) => {
      frameRef.current = null;
      const targetLength = targetRef.current.length;
      const remaining = targetLength - visibleCountRef.current;
      const elapsedMs = Math.min(
        MAX_FRAME_DELTA_MS,
        lastFrameTimeRef.current === null
          ? 1000 / 60
          : Math.max(0, frameTime - lastFrameTimeRef.current),
      );
      lastFrameTimeRef.current = frameTime;
      frameBudgetRef.current +=
        (elapsedMs * getGraphemesPerSecond(remaining)) / 1000;

      const frameStep = Math.min(
        MAX_GRAPHEMES_PER_FRAME,
        Math.floor(frameBudgetRef.current),
      );
      if (frameStep > 0) {
        frameBudgetRef.current -= frameStep;
        commitVisibleCount(
          Math.min(targetLength, visibleCountRef.current + frameStep),
        );
      }

      if (visibleCountRef.current < targetLength) {
        scheduleFrame();
      } else {
        lastFrameTimeRef.current = null;
        frameBudgetRef.current = 0;
      }
    });
  };

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  useLayoutEffect(() => {
    const previousText = previousTextRef.current;
    const wasStreaming = previousStreamingRef.current;
    const isAppend = text.startsWith(previousText);
    const shouldShowImmediately =
      prefersReducedMotion || !isAppend || (isStreaming && !wasStreaming);

    previousTextRef.current = text;
    previousStreamingRef.current = isStreaming;

    if (shouldShowImmediately) {
      cancelFrame();
      commitVisibleCount(graphemes.length);
      return;
    }

    if (
      wasStreaming &&
      previousText.length === 0 &&
      visibleCountRef.current === 0
    ) {
      commitVisibleCount(
        Math.min(INITIAL_VISIBLE_GRAPHEMES, graphemes.length),
      );
    }

    const remaining = graphemes.length - visibleCountRef.current;
    if (remaining <= 0) {
      return;
    }

    scheduleFrame();
  }, [graphemes.length, isStreaming, prefersReducedMotion, text]);

  useEffect(
    () => () => {
      cancelFrame();
    },
    [],
  );

  const safeVisibleCount = Math.min(visibleCount, graphemes.length);
  return children(graphemes.slice(0, safeVisibleCount).join(""));
}

export default StreamingTextRenderer;
