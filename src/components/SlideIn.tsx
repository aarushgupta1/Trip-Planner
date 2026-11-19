'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SLIDE_MS = 300;

// A right-hand side panel that slides in and out smoothly, and can be made
// wider or narrower by dragging its left edge. The chosen width is
// remembered. On phones it simply fills the screen.
export default function SlideIn({
  open,
  label,
  storageKey,
  defaultWidth,
  minWidth,
  children,
}: {
  open: boolean;
  label: string;
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  children: React.ReactNode;
}) {
  // The panel stays on screen while it slides away (`leaving`), and `shown`
  // drives the slide itself.
  const [prevOpen, setPrevOpen] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const [shown, setShown] = useState(false);
  // The panel renders nothing until first opened (after load), so reading the
  // remembered width here can't disagree with the server's HTML.
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(typeof window === 'undefined' ? 0 : localStorage.getItem(`panel-width:${storageKey}`));
      return saved >= minWidth ? saved : defaultWidth;
    } catch {
      return defaultWidth;
    }
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    setLeaving(!open);
  }
  const mounted = open || leaving;

  useEffect(() => {
    // Wait a frame so the browser first paints the panel off-screen, then slide.
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(open)));
    const done = open ? null : setTimeout(() => setLeaving(false), SLIDE_MS);
    return () => {
      cancelAnimationFrame(raf);
      if (done) clearTimeout(done);
    };
  }, [open]);

  const clamp = useCallback(
    (w: number) => Math.round(Math.min(Math.max(w, minWidth), Math.max(minWidth, window.innerWidth - 120))),
    [minWidth]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = true;
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setWidth(clamp(window.innerWidth - e.clientX));
  };
  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = false;
    setDragging(false);
    try {
      localStorage.setItem(`panel-width:${storageKey}`, String(width));
    } catch {
      /* ignore */
    }
  };

  if (!mounted) return null;

  return (
    <aside
      aria-label={label}
      style={{ ['--panel-w' as string]: `${width}px`, transitionDuration: `${SLIDE_MS}ms` } as React.CSSProperties}
      className={[
        'fixed right-0 top-14 bottom-0 z-40 flex w-full flex-col border-l border-t-2 border-gray-200 border-t-blue-600 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900',
        'sm:w-[var(--panel-w)] sm:max-w-[calc(100vw-120px)]',
        'transition-transform ease-out motion-reduce:transition-none',
        shown ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
    >
      {/* Drag this edge to resize. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={[
          'absolute -left-1 top-0 bottom-0 z-10 hidden w-2 cursor-col-resize touch-none sm:block',
          dragging ? 'bg-blue-600/30' : 'hover:bg-blue-600/20',
        ].join(' ')}
      />
      <div className={['flex h-full min-h-0 flex-col', dragging ? 'select-none' : ''].join(' ')}>{children}</div>
    </aside>
  );
}
