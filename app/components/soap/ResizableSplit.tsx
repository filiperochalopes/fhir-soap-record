import { useCallback, useEffect, useRef, useState } from "react";

const HANDLE_WIDTH = 8;
const MIN_RIGHT = 280;
const MAX_RIGHT = 640;
const DEFAULT_RIGHT = 380;

function readStorage(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function ResizableSplit(props: {
  defaultRightWidth?: number;
  left: React.ReactNode;
  maxRightWidth?: number;
  minRightWidth?: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  right: React.ReactNode;
  storageKey: string;
}) {
  const {
    defaultRightWidth = DEFAULT_RIGHT,
    left,
    maxRightWidth = MAX_RIGHT,
    minRightWidth = MIN_RIGHT,
    open,
    right,
    storageKey,
  } = props;

  const [isXl, setIsXl] = useState(false);
  const [rightWidth, setRightWidth] = useState(defaultRightWidth);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRightWidth(readStorage(`${storageKey}:width`, defaultRightWidth));

    const mq = window.matchMedia("(min-width: 1280px)");
    setIsXl(mq.matches);
    setHydrated(true);

    const listener = (e: MediaQueryListEvent) => setIsXl(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [storageKey, defaultRightWidth]);

  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const clamp = useCallback(
    (w: number) => Math.min(maxRightWidth, Math.max(minRightWidth, w)),
    [minRightWidth, maxRightWidth],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = rightWidth;
      (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    },
    [rightWidth],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX;
      const next = clamp(startWidth.current + delta);
      setRightWidth(next);
    },
    [clamp],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      dragging.current = false;
      const delta = startX.current - e.clientX;
      const next = clamp(startWidth.current + delta);
      writeStorage(`${storageKey}:width`, String(next));
    },
    [clamp, storageKey],
  );

  const onHandleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = 16;
      if (e.key === "ArrowLeft") {
        const next = clamp(rightWidth + step);
        setRightWidth(next);
        writeStorage(`${storageKey}:width`, String(next));
      } else if (e.key === "ArrowRight") {
        const next = clamp(rightWidth - step);
        setRightWidth(next);
        writeStorage(`${storageKey}:width`, String(next));
      }
    },
    [clamp, rightWidth, storageKey],
  );

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <div>{right}</div>
        <div>{left}</div>
      </div>
    );
  }

  if (!isXl) {
    return (
      <div className="space-y-6">
        <div>{right}</div>
        <div>{left}</div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 items-start" ref={containerRef}>
      <div className="min-w-0 flex-1">{left}</div>

      {open ? (
        <>
          <div
            aria-label="Resize sidebar"
            aria-orientation="vertical"
            className="group relative mx-0.5 flex shrink-0 cursor-col-resize select-none items-center justify-center self-stretch"
            onKeyDown={onHandleKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            role="separator"
            style={{ width: HANDLE_WIDTH }}
            tabIndex={0}
          >
            <div className="h-16 w-0.5 rounded-full bg-[color:var(--panel-border)] transition group-hover:bg-[color:var(--accent)] group-focus:bg-[color:var(--accent)]" />
          </div>

          <div className="shrink-0" style={{ width: rightWidth }}>
            {right}
          </div>
        </>
      ) : null}
    </div>
  );
}
