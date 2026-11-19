'use client';

import { useLayoutEffect, useRef } from 'react';
import AeroPlaneIcon from './AeroPlaneIcon';

const FLAG = 'greeted';

// The dashboard greeting. The first time you open the app in a visit, your
// name writes itself in while a small plane flies along a straight line
// drawn underneath (the line then fades away). After that (navigating around, coming back from a trip)
// it just sits there, finished.
export default function NameGreeting({ name }: { name: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  // Before the first paint, so a repeat visit never flashes the animation.
  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(FLAG)) ref.current?.classList.add('greet-skip');
    } catch {
      /* storage blocked — just play it */
    }
  }, []);

  const markPlayed = () => {
    try {
      sessionStorage.setItem(FLAG, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <h1 ref={ref} className="greet mb-3 flex items-baseline gap-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100" aria-label={`Hi ${name}`}>
      <span aria-hidden className="greet-hi">Hi</span>
      <span aria-hidden className="greet-wrap relative inline-block">
        <span className="greet-name block" onAnimationEnd={markPlayed}>
          {name}
        </span>
        <svg className="greet-line absolute inset-x-0 -bottom-2 h-3 w-full overflow-visible" viewBox="0 0 100 12" preserveAspectRatio="none">
          <path d="M0 6 H100" pathLength={1} fill="none" stroke="#dc2626" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="greet-plane absolute -bottom-[10px] -ml-2 text-blue-600">
          <AeroPlaneIcon size={16} />
        </span>
      </span>
    </h1>
  );
}
