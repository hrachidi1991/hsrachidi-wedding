'use client';

import { useEffect, useState } from 'react';

// Returns true when the viewport is at/below the breakpoint (default 768px).
// SSR-safe: starts false, corrects on mount (admin pages show a skeleton first).
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);
  return isMobile;
}
