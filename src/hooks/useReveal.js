import { useEffect, useRef, useState } from 'react';

/**
 * useReveal — IntersectionObserver scroll-reveal.
 * Returns [ref, visible]. Once visible, stays visible.
 * Respects prefers-reduced-motion (reveals immediately, no animation).
 * (JSX-free on purpose: vite parses .js without the JSX transform.)
 */
export function useReveal({ threshold = 0.15, rootMargin = '0px 0px -40px 0px' } = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        }
      },
      { threshold, rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, rootMargin]);

  return [ref, visible];
}

export default useReveal;
