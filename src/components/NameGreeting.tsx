'use client';

import { useLayoutEffect, useRef } from 'react';
import AeroPlaneIcon from './AeroPlaneIcon';

const FLAG = 'greeted';

// The dashboard greeting. The first time you open the app in a visit, your
// name writes itself in handwriting while a small plane flies along a line
// drawn underneath. After that (navigating around, coming back from a trip)
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
    <h1 ref={ref} className="greet flex items-end gap-2 text-gray-900 dark:text-gray-100" aria-label={`Hi ${name}`}>
      <span aria-hidden className="greet-hi pb-1 text-2xl font-semibold tracking-tight">Hi</span>
      <span aria-hidden className="greet-wrap relative inline-block pb-3">
        <span className="greet-name block font-hand text-[46px] leading-[0.9] text-gray-900" onAnimationEnd={markPlayed}>
          {name}
        </span>
        <svg className="greet-line absolute inset-x-0 bottom-0 h-3 w-full overflow-visible" viewBox="0 0 100 12" preserveAspectRatio="none">
          <path d="M0 8 Q 25 1 50 7 T 100 6" pathLength={1} fill="none" stroke="#dc2626" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="greet-plane absolute bottom-[1px] -ml-2 text-blue-600">
          <AeroPlaneIcon size={16} />
        </span>
      </span>
    </h1>
  );
}
